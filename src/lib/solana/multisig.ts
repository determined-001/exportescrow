import {
  createMultisig,
  getMultisig,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  type Multisig,
} from '@solana/spl-token';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { withRetry } from './retry';

export interface CreateDealMultisigParams {
  connection: Connection;
  payer: Keypair;
  importerPubkey: PublicKey;
  verifierPubkeys: PublicKey[];
  threshold: number;
  mint: PublicKey;
}

export interface CreateDealMultisigResult {
  multisigAddress: PublicKey;
  vaultAta: PublicKey;
  signers: PublicKey[];
  threshold: number;
}

/**
 * Threshold model
 * ---------------
 * One SPL Token multisig per deal. Signers are
 *   [importer, verifier1, verifier2, verifier3]   (n = 4)
 * Threshold m = 3, so 3-of-4 can authorize transfers from the vault ATA.
 *
 *   Normal release : importer + 2 verifiers       (3 sigs)
 *   Dispute refund : all 3 verifiers              (3 sigs, no importer)
 *
 * This single-multisig design supports both release and refund paths without
 * provisioning two separate on-chain accounts per deal.
 */
export async function createDealMultisig(
  params: CreateDealMultisigParams,
): Promise<CreateDealMultisigResult> {
  if (params.verifierPubkeys.length === 0) {
    throw new Error('At least one verifier required');
  }
  const signers = [params.importerPubkey, ...params.verifierPubkeys];
  if (signers.length > 11) {
    throw new Error('SPL multisig supports at most 11 signers');
  }
  if (params.threshold < 1 || params.threshold > signers.length) {
    throw new Error(`Threshold ${params.threshold} out of range for ${signers.length} signers`);
  }

  // createMultisig handles tx build + submit + confirm + internal retry.
  const multisigAddress = await createMultisig(
    params.connection,
    params.payer,
    signers,
    params.threshold,
    Keypair.generate(),
    undefined,
    TOKEN_PROGRAM_ID,
  );

  // The vault is an ATA owned by the multisig. The multisig pubkey is off the
  // ed25519 curve, so we must pass allowOwnerOffCurve = true.
  const vaultAccount = await getOrCreateAssociatedTokenAccount(
    params.connection,
    params.payer,
    params.mint,
    multisigAddress,
    true,
  );

  return {
    multisigAddress,
    vaultAta: vaultAccount.address,
    signers,
    threshold: params.threshold,
  };
}

/**
 * Returns (and creates on chain if needed) the ATA for a given mint owned by
 * the multisig. Deterministic — same multisig + mint always resolves to the
 * same ATA.
 */
export async function deriveVaultAta(
  connection: Connection,
  payer: Keypair,
  multisigAddress: PublicKey,
  mint: PublicKey,
): Promise<PublicKey> {
  const account = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    multisigAddress,
    true,
  );
  return account.address;
}

export interface MultisigInfo {
  m: number;
  n: number;
  signers: PublicKey[];
}

/**
 * Read the on-chain SPL multisig account and return its threshold + signer set.
 * Useful for verifying that a deal's stored multisig_address still matches the
 * verifier set we expected when the deal was created.
 */
export async function getMultisigInfo(
  connection: Connection,
  multisigAddress: PublicKey,
): Promise<MultisigInfo> {
  const multisig: Multisig = await withRetry(() => getMultisig(connection, multisigAddress), {
    label: 'getMultisig',
  });
  const allSlots: PublicKey[] = [
    multisig.signer1,
    multisig.signer2,
    multisig.signer3,
    multisig.signer4,
    multisig.signer5,
    multisig.signer6,
    multisig.signer7,
    multisig.signer8,
    multisig.signer9,
    multisig.signer10,
    multisig.signer11,
  ];
  const signers = allSlots.slice(0, multisig.n);
  return { m: multisig.m, n: multisig.n, signers };
}
