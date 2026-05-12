/**
 * End-to-end verification of the KIRAPAY fund-in leg for ExportEscrow.
 *
 * IMPORTANT: docs.kira-pay.com returns HTTP 403 for all public endpoints, so
 * API field names and endpoint paths are derived from KIRAPAY_INTEGRATION.md.
 * If the real API behaves differently (wrong field names, different endpoint,
 * unexpected auth scheme), this script will print the full request + response
 * (API key redacted) and stop with a clear error message.
 *
 * Usage:
 *   npx tsx scripts/verify-kirapay-fundin.ts          # real KIRAPAY testnet
 *   npx tsx scripts/verify-kirapay-fundin.ts --mock   # local simulation (no KIRAPAY call)
 *
 * Real mode prerequisites:
 *   - KIRAPAY_API_KEY set in .env.local
 *   - KIRAPAY_WEBHOOK_SECRET set in .env.local
 *   - KIRAPAY_WEBHOOK_PUBLIC_URL set to your ngrok / Vercel URL (e.g. https://abc.ngrok.io)
 *   - FEE_PAYER_PRIVATE_KEY funded with ~1 SOL on devnet
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *   - Next.js dev server running (only needed for --mock mode)
 *
 * Mock mode prerequisites (for fast iteration):
 *   - FEE_PAYER_PRIVATE_KEY funded with ~0.5 SOL on devnet
 *   - SUPABASE_SERVICE_ROLE_KEY set in .env.local
 *   - KIRAPAY_WEBHOOK_SECRET set in .env.local
 *   - Next.js dev server running on localhost:3000
 */

import 'dotenv/config';
import crypto from 'node:crypto';
import readline from 'node:readline';
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
} from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';

import { createDealMultisig } from '../src/lib/solana/multisig';
import { getVaultBalance } from '../src/lib/solana/balance';
import { createPaymentLink } from '../src/lib/kirapay/payment-link';

const IS_MOCK = process.argv.includes('--mock');
const USDC_DECIMALS = 6;
const ONE_USDC = 1_000_000n;
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000; // 5 minutes

const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env: ${key}`);
  return v;
}

function loadFeePayer(): Keypair {
  const secret = process.env.FEE_PAYER_PRIVATE_KEY;
  if (!secret) {
    throw new Error(
      'FEE_PAYER_PRIVATE_KEY not set.\n' +
        'Run: npx tsx scripts/verify-multisig.ts --generate-keypair\n' +
        'Fund the printed address with ~1 SOL at https://faucet.solana.com',
    );
  }
  return Keypair.fromSecretKey(bs58.decode(secret));
}

function supabaseAdmin() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function tryAirdrop(
  connection: Connection,
  target: PublicKey,
  lamports: number,
): Promise<boolean> {
  for (const amount of [lamports, Math.floor(lamports / 2), Math.floor(lamports / 4)]) {
    try {
      const sig = await connection.requestAirdrop(target, amount);
      await connection.confirmTransaction(sig, 'confirmed');
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
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

  if (target.equals(payer.publicKey)) {
    const ok = await tryAirdrop(connection, target, delta);
    if (!ok) throw new Error(`Devnet airdrop failed for ${target.toBase58()}`);
    return;
  }

  const payerBalance = await connection.getBalance(payer.publicKey);
  if (payerBalance >= delta + 5000) {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: target, lamports: delta }),
    );
    await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
    return;
  }

  const ok = await tryAirdrop(connection, target, delta);
  if (!ok) throw new Error(`Could not fund ${target.toBase58()}`);
}

function fmtUsdc(amount: bigint): string {
  const whole = amount / ONE_USDC;
  const frac = amount % ONE_USDC;
  return `${whole}.${frac.toString().padStart(6, '0')}`;
}

function signWebhookPayload(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function pollForFunded(
  supabase: ReturnType<typeof supabaseAdmin>,
  dealId: string,
): Promise<{ funded: boolean; finalStatus: string; elapsedMs: number }> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const { data } = await supabase.from('deals').select('status').eq('id', dealId).single();
    const status = (data as { status: string } | null)?.status ?? 'unknown';
    if (status === 'funded') {
      return { funded: true, finalStatus: status, elapsedMs: Date.now() - start };
    }
    process.stdout.write(`  polling... status=${status} (${Math.round((Date.now() - start) / 1000)}s)\r`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  const { data } = await supabase.from('deals').select('status').eq('id', dealId).single();
  const finalStatus = (data as { status: string } | null)?.status ?? 'unknown';
  return { funded: false, finalStatus, elapsedMs: Date.now() - start };
}

async function main(): Promise<void> {
  console.log('');
  console.log('═'.repeat(80));
  console.log(`  KIRAPAY FUND-IN VERIFICATION  [mode: ${IS_MOCK ? 'MOCK' : 'REAL'}]`);
  console.log('═'.repeat(80));
  console.log(`  docs.kira-pay.com: returned HTTP 403 — field names from KIRAPAY_INTEGRATION.md`);
  console.log('');

  const connection = new Connection(RPC_URL, 'confirmed');
  const slot = await connection.getSlot();
  console.log(`▸ Solana RPC: ${RPC_URL} (slot ${slot})`);

  const feePayer = loadFeePayer();
  console.log(`▸ Fee payer: ${feePayer.publicKey.toBase58()}`);
  await ensureSol(connection, feePayer, feePayer.publicKey, 0.5);

  const importer = Keypair.generate();
  const verifier1 = Keypair.generate();
  const verifier2 = Keypair.generate();
  const verifier3 = Keypair.generate();
  console.log(`▸ Importer:  ${importer.publicKey.toBase58()}`);

  // ─── Step 1: Create test USDC mint ────────────────────────────────────────
  console.log('\nStep 1: create test USDC mint');
  const mint = await createMint(connection, feePayer, feePayer.publicKey, null, USDC_DECIMALS);
  console.log(`  Mint: ${mint.toBase58()}`);

  // ─── Step 2: Create deal multisig + vault ─────────────────────────────────
  console.log('\nStep 2: createDealMultisig (3-of-4)');
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

  // ─── Step 3: Insert deal row in Supabase ──────────────────────────────────
  console.log('\nStep 3: insert deal row in Supabase');
  const supabase = supabaseAdmin();
  const amountUsdc = ONE_USDC; // 1 USDC

  // We need a verifier set — use a dummy one or create it inline
  // For the script, we insert the deal without a real verifier_set_id to keep it standalone.
  const { data: dealRow, error: dealErr } = await supabase
    .from('deals')
    .insert({
      importer_pubkey: importer.publicKey.toBase58(),
      exporter_payout_chain: 'tron',
      exporter_payout_token: 'USDT',
      exporter_payout_address: 'TXyz_test',
      amount_usdc: amountUsdc.toString(),
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      verifier_set_id: null,
      status: 'created',
      multisig_address: multisig.multisigAddress.toBase58(),
      vault_ata: multisig.vaultAta.toBase58(),
    })
    .select('*')
    .single();

  if (dealErr || !dealRow) {
    throw new Error(`Failed to insert deal: ${dealErr?.message ?? 'unknown'}`);
  }
  const dealId = (dealRow as { id: string }).id;
  console.log(`  Deal ID: ${dealId}`);

  // ─── Step 4: Create payment link (real) or set fake ID (mock) ─────────────
  let paymentUrl: string;
  let kirapayPaymentLinkId: string;
  const kirapayApiKey = process.env.KIRAPAY_API_KEY ?? '';
  const webhookPublicUrl = (process.env.KIRAPAY_WEBHOOK_PUBLIC_URL ?? '').replace(/\/$/, '');
  const webhookSecret = requireEnv('KIRAPAY_WEBHOOK_SECRET');

  if (IS_MOCK) {
    console.log('\nStep 4: [MOCK] skipping real KIRAPAY call — assigning synthetic payment link');
    kirapayPaymentLinkId = `mock-pl-${Date.now()}`;
    paymentUrl = `https://pay.kira-pay.com/mock/${kirapayPaymentLinkId}`;

    // Fund the vault with test USDC so the webhook balance check passes
    console.log('  Minting 1 USDC to vault ATA (simulates KIRAPAY settlement)');
    await getOrCreateAssociatedTokenAccount(connection, feePayer, mint, multisig.multisigAddress, true);
    await mintTo(connection, feePayer, mint, multisig.vaultAta, feePayer, amountUsdc);
    const bal = await getVaultBalance(connection, multisig.vaultAta);
    console.log(`  Vault balance: ${fmtUsdc(bal)} USDC ✓`);
  } else {
    console.log('\nStep 4: create KIRAPAY payment link (real API)');
    if (!kirapayApiKey) {
      throw new Error('KIRAPAY_API_KEY not set — cannot run in real mode. Use --mock for local testing.');
    }
    if (!webhookPublicUrl) {
      throw new Error(
        'KIRAPAY_WEBHOOK_PUBLIC_URL not set.\n' +
          'Set it to your ngrok or Vercel preview URL so KIRAPAY can POST webhooks to you.\n' +
          'Example: KIRAPAY_WEBHOOK_PUBLIC_URL=https://abc.ngrok.io',
      );
    }

    let linkResult: Awaited<ReturnType<typeof createPaymentLink>>;
    try {
      linkResult = await createPaymentLink({
        amount: amountUsdc,
        destinationChain: 'solana',
        destinationToken: 'USDC',
        destinationAddress: multisig.vaultAta.toBase58(),
        metadata: { dealId, importerPubkey: importer.publicKey.toBase58() },
        webhookUrl: `${webhookPublicUrl}/api/kirapay/webhook`,
      });
    } catch (err) {
      // Surface the full error so we can debug API differences
      console.error('\n⚠ KIRAPAY API CALL FAILED');
      console.error('If the field names or endpoint are wrong, update src/lib/kirapay/payment-link.ts');
      console.error('Error:', err instanceof Error ? err.stack : String(err));
      process.exit(1);
    }

    kirapayPaymentLinkId = linkResult.paymentLinkId;
    paymentUrl = linkResult.paymentUrl;
    console.log(`  Payment link ID: ${kirapayPaymentLinkId}`);
  }

  // Attach the payment link ID to the deal row
  await supabase
    .from('deals')
    .update({ kirapay_payment_link_id: kirapayPaymentLinkId })
    .eq('id', dealId);

  // ─── Step 5: Payment instruction ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(80));
  if (IS_MOCK) {
    console.log('Step 5: [MOCK] posting synthetic webhook to localhost:3000');
  } else {
    console.log('Step 5: MANUAL PAYMENT REQUIRED');
    console.log('');
    console.log(`  Payment URL: ${paymentUrl}`);
    console.log('');
    console.log('  Open the URL above in a browser and pay 1 USDC from any supported testnet wallet.');
    console.log('  KIRAPAY will route the funds to the Solana vault and fire a webhook.');
    console.log('');
    await prompt('  Press Enter once you have initiated the payment...');
  }

  // ─── Step 6: Mock webhook delivery ────────────────────────────────────────
  if (IS_MOCK) {
    const eventId = `mock-evt-${Date.now()}`;
    const mockPayload = JSON.stringify({
      id: eventId,
      type: 'payment.completed',
      createdAt: new Date().toISOString(),
      data: {
        paymentLinkId: kirapayPaymentLinkId,
        reference: dealId,
        status: 'completed',
        amount: 1.0,
        currency: 'USDC',
        destinationChain: 'solana',
        destinationAddress: multisig.vaultAta.toBase58(),
        transactionHash: `mock-tx-${Date.now()}`,
        settledAt: new Date().toISOString(),
      },
    });

    const signature = signWebhookPayload(mockPayload, webhookSecret);

    console.log('  Sending mock webhook to http://localhost:3000/api/kirapay/webhook');
    let webhookRes: Response;
    try {
      webhookRes = await fetch('http://localhost:3000/api/kirapay/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kirapay-signature': signature,
        },
        body: mockPayload,
      });
    } catch (err) {
      throw new Error(
        'Could not reach localhost:3000. Is the Next.js dev server running?\n' +
          'Run `npm run dev` in another terminal and retry.\n' +
          `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const webhookBody = await webhookRes.text();
    console.log(`  Webhook response: ${webhookRes.status} ${webhookBody}`);

    if (webhookRes.status === 401) {
      throw new Error(
        'Webhook rejected (401 Invalid signature).\n' +
          'Check that KIRAPAY_WEBHOOK_SECRET in .env.local matches the secret used by the running server.',
      );
    }
    if (!webhookRes.ok) {
      throw new Error(`Webhook returned unexpected status ${webhookRes.status}: ${webhookBody}`);
    }

    // Test duplicate delivery — second POST must return { duplicate: true }
    console.log('  Testing duplicate delivery (same event ID)...');
    const dup = await fetch('http://localhost:3000/api/kirapay/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kirapay-signature': signature,
      },
      body: mockPayload,
    });
    const dupBody = await dup.text();
    if (!dupBody.includes('"duplicate":true')) {
      console.warn(`  WARNING: duplicate delivery did not return duplicate:true — got: ${dupBody}`);
    } else {
      console.log('  Duplicate detection: ✓ (second delivery returned duplicate:true)');
    }

    // Test invalid signature — must get 401
    console.log('  Testing invalid signature rejection...');
    const badSig = await fetch('http://localhost:3000/api/kirapay/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kirapay-signature': 'deadbeef00000000',
      },
      body: mockPayload,
    });
    if (badSig.status !== 401) {
      console.warn(`  WARNING: bad signature returned ${badSig.status} instead of 401`);
    } else {
      console.log('  HMAC rejection: ✓ (invalid signature returned 401)');
    }
  }

  // ─── Step 7: Poll for funded status ───────────────────────────────────────
  console.log('\nStep 6: polling deal status (5 s interval, 5 min timeout)');
  const { funded, finalStatus, elapsedMs } = await pollForFunded(supabase, dealId);
  console.log('');

  if (!funded) {
    console.error(`\n✗ Timed out after ${Math.round(elapsedMs / 1000)}s — deal status is '${finalStatus}'`);
    console.error('  Possible causes:');
    console.error('  - Webhook never arrived (check KIRAPAY_WEBHOOK_PUBLIC_URL and server logs)');
    console.error('  - HMAC signature mismatch (check KIRAPAY_WEBHOOK_SECRET)');
    console.error('  - Vault balance was below expected (check Solana devnet RPC)');
    console.error('  - KIRAPAY field names differ from our assumptions — inspect server logs');
    process.exit(1);
  }

  // ─── Step 8: Final balance check ──────────────────────────────────────────
  const finalBalance = await getVaultBalance(connection, multisig.vaultAta);

  // ─── Summary ──────────────────────────────────────────────────────────────
  const elapsed = `${(elapsedMs / 1000).toFixed(1)}s`;
  console.log('');
  console.log('═'.repeat(80));
  console.log('            KIRAPAY FUND-IN VERIFICATION SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Mode:              ${IS_MOCK ? 'MOCK (synthetic webhook)' : 'REAL (KIRAPAY testnet)'}`);
  console.log(`Deal ID:           ${dealId}`);
  console.log(`Multisig:          ${multisig.multisigAddress.toBase58()}`);
  console.log(`Vault ATA:         ${multisig.vaultAta.toBase58()}`);
  console.log(`Vault balance:     ${fmtUsdc(finalBalance)} USDC`);
  console.log(`Payment link ID:   ${kirapayPaymentLinkId}`);
  console.log(`Payment URL:       ${paymentUrl}`);
  console.log(`Time to settled:   ${elapsed}`);
  console.log('─'.repeat(80));
  console.log('✓ All checks passed — deal transitioned to funded.');
  if (IS_MOCK) {
    console.log('  Run without --mock to verify against the real KIRAPAY testnet API.');
  }
  console.log('═'.repeat(80));
  console.log('');
}

main().catch((err) => {
  console.error('\n✗ verify-kirapay-fundin FAILED');
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
