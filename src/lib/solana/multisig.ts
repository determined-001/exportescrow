import type { PublicKey, Transaction } from '@solana/web3.js';

export interface CreateMultisigParams {
  payer: PublicKey;
  signers: PublicKey[];
  threshold: number;
  usdcMint: PublicKey;
}

export interface CreateMultisigResult {
  multisigAddress: PublicKey;
  vaultAta: PublicKey;
  transaction: Transaction;
}

// TODO(multisig): use @solana/spl-token's createMultisig + getOrCreateAssociatedTokenAccount
// to build the transaction. The multisig account owns the vault ATA. Returned transaction
// should be unsigned — caller signs and sends.
export async function createSplMultisig(_params: CreateMultisigParams): Promise<CreateMultisigResult> {
  throw new Error('Not implemented');
}

// TODO(multisig): inspect an existing multisig account and return the threshold + signer set.
export async function fetchMultisig(_address: PublicKey): Promise<{ threshold: number; signers: PublicKey[] } | null> {
  throw new Error('Not implemented');
}
