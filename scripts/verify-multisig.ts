/**
 * End-to-end verification of the SPL multisig custody layer on Solana devnet.
 *
 *   1. Generate keypairs (importer + 3 verifiers) and a test USDC mint.
 *   2. Airdrop SOL to all four (with feePayer fallback if devnet rate-limits).
 *   3. Mint 1 USDC to the importer; create the deal multisig (3-of-4).
 *   4. Importer transfers 1 USDC into the vault ATA; verify balance.
 *   5. Build a release transaction; collect 3 separate signatures
 *      (importer + 2 verifiers); submit; confirm.
 *   6. Verify the exporter received 1 USDC and the vault is empty.
 *
 * Run with `npm run verify:multisig` or `npx tsx scripts/verify-multisig.ts`.
 */

import 'dotenv/config';
import bs58 from 'bs58';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from '@solana/spl-token';

import { createDealMultisig, getMultisigInfo } from '../src/lib/solana/multisig';
import {
  buildReleaseTransaction,
  collectAndSubmitSignatures,
  simulateRelease,
} from '../src/lib/solana/transfer';
import { getVaultBalance } from '../src/lib/solana/balance';

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

const USDC_DECIMALS = 6;
const ONE_USDC = 1_000_000n;

function loadFeePayer(): Keypair {
  const secret = process.env.FEE_PAYER_PRIVATE_KEY;
  if (secret) {
    return Keypair.fromSecretKey(bs58.decode(secret));
  }
  console.log('  FEE_PAYER_PRIVATE_KEY not set — generating an ephemeral fee payer for this run.');
  return Keypair.generate();
}

function generateAndPrintKeypair(): void {
  const kp = Keypair.generate();
  const secretB58 = bs58.encode(kp.secretKey);
  console.log('Generated fee-payer keypair:');
  console.log('');
  console.log(`  Public key:   ${kp.publicKey.toBase58()}`);
  console.log(`  Secret (b58): ${secretB58}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Add to .env.local:   FEE_PAYER_PRIVATE_KEY=' + secretB58.slice(0, 12) + '...');
  console.log('  2. Fund the public key with ~1 SOL on devnet:');
  console.log(`       https://faucet.solana.com/?address=${kp.publicKey.toBase58()}`);
  console.log('  3. Re-run `npm run verify:multisig`');
}

async function tryAirdrop(connection: Connection, target: PublicKey, lamports: number): Promise<boolean> {
  // Devnet faucet is rate-limited and frequently 429s with "Internal error".
  // Try the requested amount, then half, then quarter, with backoff between.
  const tiers = [lamports, Math.floor(lamports / 2), Math.floor(lamports / 4)].filter((n) => n > 0);
  for (let attempt = 0; attempt < tiers.length; attempt++) {
    const amount = tiers[attempt];
    try {
      const sig = await connection.requestAirdrop(target, amount);
      await connection.confirmTransaction(sig, 'confirmed');
      return true;
    } catch {
      // Backoff before next tier.
      if (attempt < tiers.length - 1) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
  }
  return false;
}

async function ensureSol(
  connection: Connection,
  payer: Keypair,
  target: PublicKey,
  desiredSol: number,
): Promise<void> {
  const need = Math.ceil(desiredSol * LAMPORTS_PER_SOL);
  const current = await connection.getBalance(target);
  if (current >= need) return;
  const delta = need - current;

  // If target IS the payer, only airdrop is an option.
  if (target.equals(payer.publicKey)) {
    const ok = await tryAirdrop(connection, target, delta);
    if (!ok) {
      throw new Error(
        `Devnet airdrop is rate-limited for this IP and failed for ${target.toBase58()}.\n\n` +
          `Fix (one-time):\n` +
          `  1. Run: npx tsx scripts/verify-multisig.ts --generate-keypair\n` +
          `  2. Paste the printed FEE_PAYER_PRIVATE_KEY into .env.local\n` +
          `  3. Fund the public key with ~1 SOL via https://faucet.solana.com (web)\n` +
          `  4. Re-run: npm run verify:multisig\n\n` +
          `The web faucet uses captcha rather than the rate-limited RPC, so it almost ` +
          `always works when the RPC airdrop does not.`,
      );
    }
    return;
  }

  // For sub-keypairs, transfer from payer if payer has the SOL.
  const payerBalance = await connection.getBalance(payer.publicKey);
  if (payerBalance >= delta + 5000) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: target,
        lamports: delta,
      }),
    );
    await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
    return;
  }

  // Last resort: airdrop directly to the sub-keypair.
  const ok = await tryAirdrop(connection, target, delta);
  if (!ok) {
    throw new Error(`Could not fund ${target.toBase58()} (${desiredSol} SOL): both airdrop and payer transfer failed`);
  }
}

function fmtUsdc(amount: bigint): string {
  const whole = amount / ONE_USDC;
  const frac = amount % ONE_USDC;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}

function abbrev(pubkey: PublicKey): string {
  const s = pubkey.toBase58();
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/**
 * Produce a detached ed25519 signature for `tx` from `signer` without mutating
 * `tx`. Mirrors what a wallet would do on a remote machine: sign a copy of the
 * transaction message locally, return only the signature bytes, never the key.
 */
function detachedSign(tx: Transaction, signer: Keypair): Buffer {
  const cloned = Transaction.from(tx.serialize({ requireAllSignatures: false, verifySignatures: false }));
  cloned.partialSign(signer);
  const entry = cloned.signatures.find((s) => s.publicKey.equals(signer.publicKey));
  if (!entry?.signature) {
    throw new Error(`partialSign produced no signature for ${signer.publicKey.toBase58()}`);
  }
  return Buffer.from(entry.signature);
}

async function main(): Promise<void> {
  if (process.argv.includes('--generate-keypair')) {
    generateAndPrintKeypair();
    return;
  }

  const connection = new Connection(RPC_URL, 'confirmed');
  console.log(`▸ RPC: ${RPC_URL}`);
  const slot = await connection.getSlot();
  console.log(`▸ Cluster reachable (slot ${slot})\n`);

  // ─── Step 0 ───────────────────────────────────────────────────────────
  console.log('Step 0: load fee payer + ensure SOL');
  const feePayer = loadFeePayer();
  console.log(`  Fee payer: ${feePayer.publicKey.toBase58()}`);
  await ensureSol(connection, feePayer, feePayer.publicKey, 1);
  console.log(`  Fee payer balance: ${(await connection.getBalance(feePayer.publicKey)) / LAMPORTS_PER_SOL} SOL\n`);

  // ─── Step 1: keypairs ────────────────────────────────────────────────
  console.log('Step 1: generate test keypairs');
  const importer = Keypair.generate();
  const verifier1 = Keypair.generate();
  const verifier2 = Keypair.generate();
  const verifier3 = Keypair.generate();
  const exporter = Keypair.generate();
  console.log(`  Importer:   ${importer.publicKey.toBase58()}`);
  console.log(`  Verifier 1: ${verifier1.publicKey.toBase58()}`);
  console.log(`  Verifier 2: ${verifier2.publicKey.toBase58()}`);
  console.log(`  Verifier 3: ${verifier3.publicKey.toBase58()}`);
  console.log(`  Exporter:   ${exporter.publicKey.toBase58()}\n`);

  // ─── Step 2: airdrop SOL ─────────────────────────────────────────────
  console.log('Step 2: ensure SOL for all test keypairs');
  for (const [label, kp, sol] of [
    ['importer', importer, 0.05],
    ['verifier1', verifier1, 0.02],
    ['verifier2', verifier2, 0.02],
    ['verifier3', verifier3, 0.02],
  ] as const) {
    await ensureSol(connection, feePayer, kp.publicKey, sol);
    console.log(`  ${label}: funded`);
  }
  console.log();

  // ─── Step 3: test mint + 1 USDC to importer ─────────────────────────
  console.log('Step 3: create test USDC mint and seed importer balance');
  const mint = await createMint(connection, feePayer, feePayer.publicKey, null, USDC_DECIMALS);
  console.log(`  Mint: ${mint.toBase58()} (${USDC_DECIMALS} decimals)`);
  const importerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    feePayer,
    mint,
    importer.publicKey,
  );
  await mintTo(connection, feePayer, mint, importerAta.address, feePayer, ONE_USDC);
  console.log(`  Minted ${fmtUsdc(ONE_USDC)} USDC to importer ATA ${abbrev(importerAta.address)}\n`);

  // ─── Step 4: create deal multisig ───────────────────────────────────
  console.log('Step 4: createDealMultisig (3-of-4)');
  const multisig = await createDealMultisig({
    connection,
    payer: feePayer,
    importerPubkey: importer.publicKey,
    verifierPubkeys: [verifier1.publicKey, verifier2.publicKey, verifier3.publicKey],
    threshold: 3,
    mint,
  });
  console.log(`  Multisig: ${multisig.multisigAddress.toBase58()}`);
  console.log(`  Vault ATA: ${multisig.vaultAta.toBase58()}`);

  // Verify on-chain state matches what we asked for.
  const onChain = await getMultisigInfo(connection, multisig.multisigAddress);
  assert(onChain.m === 3, `multisig.m should be 3, got ${onChain.m}`);
  assert(onChain.n === 4, `multisig.n should be 4, got ${onChain.n}`);
  const expectedSigners = [
    importer.publicKey,
    verifier1.publicKey,
    verifier2.publicKey,
    verifier3.publicKey,
  ];
  for (let i = 0; i < expectedSigners.length; i++) {
    assert(
      onChain.signers[i].equals(expectedSigners[i]),
      `signer[${i}] mismatch: expected ${expectedSigners[i].toBase58()}, got ${onChain.signers[i].toBase58()}`,
    );
  }
  console.log(`  Verified on-chain: m=${onChain.m}, n=${onChain.n}, signers match\n`);

  // ─── Step 5: importer funds the vault ───────────────────────────────
  console.log('Step 5: importer transfers 1 USDC into the vault');
  const fundingTxSig = await transfer(
    connection,
    feePayer,
    importerAta.address,
    multisig.vaultAta,
    importer,
    ONE_USDC,
  );
  console.log(`  Funding tx: ${fundingTxSig}`);

  const vaultAfterFund = await getVaultBalance(connection, multisig.vaultAta);
  assert(vaultAfterFund === ONE_USDC, `vault should hold ${ONE_USDC}, got ${vaultAfterFund}`);
  console.log(`  Vault balance: ${fmtUsdc(vaultAfterFund)} USDC ✓\n`);

  // ─── Step 6: build release transaction ──────────────────────────────
  console.log('Step 6: build release transaction (vault → exporter)');
  const exporterAta = await getOrCreateAssociatedTokenAccount(
    connection,
    feePayer,
    mint,
    exporter.publicKey,
  );
  console.log(`  Exporter ATA: ${exporterAta.address.toBase58()}`);

  // 3-of-4 signers for the release: importer + 2 verifiers.
  const releaseSigners = [importer, verifier1, verifier2];
  const releaseTx = await buildReleaseTransaction({
    connection,
    multisigAddress: multisig.multisigAddress,
    vaultAta: multisig.vaultAta,
    destinationAta: exporterAta.address,
    amount: ONE_USDC,
    signerPubkeys: releaseSigners.map((s) => s.publicKey),
    feePayer: feePayer.publicKey,
  });

  // ─── Step 7: collect signatures separately, merge, simulate, submit ─
  console.log('Step 7: collect signatures from each signer independently');
  // Fee payer signs the tx the normal way (it's the Solana-level transaction signer).
  releaseTx.partialSign(feePayer);

  // Each multisig signer signs independently — mirrors the production flow
  // where verifiers sign on their own machines and only return the signature.
  const collected = releaseSigners.map((kp) => ({
    pubkey: kp.publicKey,
    signature: detachedSign(releaseTx, kp),
  }));
  console.log(`  Collected ${collected.length} signatures from multisig signers`);

  // Pre-flight: dry-run via simulateTransaction. Attach signatures to a clone
  // so we don't double-add them to releaseTx.
  const simClone = Transaction.from(
    releaseTx.serialize({ requireAllSignatures: false, verifySignatures: false }),
  );
  for (const { pubkey, signature } of collected) {
    simClone.addSignature(pubkey, signature);
  }
  const sim = await simulateRelease(simClone, connection);
  console.log(`  Simulation succeeded (${sim.unitsConsumed ?? '?'} compute units consumed)`);

  // Submit the real transaction.
  const releaseTxSig = await collectAndSubmitSignatures(releaseTx, collected, connection);
  console.log(`  Release tx: ${releaseTxSig}\n`);

  // ─── Step 8: verify destination balance + vault drained ─────────────
  console.log('Step 8: verify final balances');
  const exporterBalance = await getVaultBalance(connection, exporterAta.address);
  const vaultAfterRelease = await getVaultBalance(connection, multisig.vaultAta);
  assert(
    exporterBalance === ONE_USDC,
    `exporter should hold ${ONE_USDC}, got ${exporterBalance}`,
  );
  assert(
    vaultAfterRelease === 0n,
    `vault should be empty after release, holds ${vaultAfterRelease}`,
  );
  console.log(`  Exporter balance: ${fmtUsdc(exporterBalance)} USDC ✓`);
  console.log(`  Vault balance:    ${fmtUsdc(vaultAfterRelease)} USDC ✓\n`);

  // ─── Summary table ─────────────────────────────────────────────────
  const summary = [
    '═'.repeat(80),
    '                       MULTISIG VERIFICATION SUMMARY',
    '═'.repeat(80),
    `Cluster:           ${RPC_URL}`,
    `Mint:              ${mint.toBase58()} (${USDC_DECIMALS} decimals)`,
    `Multisig:          ${multisig.multisigAddress.toBase58()} (${onChain.m}-of-${onChain.n})`,
    `Vault ATA:         ${multisig.vaultAta.toBase58()}`,
    `Fee payer:         ${feePayer.publicKey.toBase58()}`,
    '─'.repeat(80),
    'Signers (n = 4):',
    `  Importer         ${importer.publicKey.toBase58()}`,
    `  Verifier 1       ${verifier1.publicKey.toBase58()}`,
    `  Verifier 2       ${verifier2.publicKey.toBase58()}`,
    `  Verifier 3       ${verifier3.publicKey.toBase58()}`,
    '─'.repeat(80),
    `Funding tx:        ${fundingTxSig}`,
    `Release tx:        ${releaseTxSig}`,
    `Release signers:   importer + verifier1 + verifier2  (3-of-4)`,
    '─'.repeat(80),
    `Vault before:      ${fmtUsdc(ONE_USDC)} USDC`,
    `Vault after:       ${fmtUsdc(vaultAfterRelease)} USDC`,
    `Exporter final:    ${fmtUsdc(exporterBalance)} USDC`,
    '═'.repeat(80),
    '✓ All assertions passed.',
  ].join('\n');
  console.log(summary);
}

main().catch((err) => {
  console.error('\n✗ verify-multisig FAILED');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
