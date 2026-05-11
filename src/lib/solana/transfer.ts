import type { PublicKey, Transaction } from '@solana/web3.js';

export interface BuildReleaseTransferParams {
  multisig: PublicKey;
  vaultAta: PublicKey;
  destinationAta: PublicKey;
  signers: PublicKey[];
  amount: bigint;
  feePayer: PublicKey;
}

// TODO(transfer): assemble a multi-signer Transfer instruction from the SPL multisig vault.
// Caller collects threshold-many partial signatures, then submits.
export async function buildReleaseTransfer(_params: BuildReleaseTransferParams): Promise<Transaction> {
  throw new Error('Not implemented');
}

export interface BuildFundTransferParams {
  source: PublicKey;
  sourceAta: PublicKey;
  vaultAta: PublicKey;
  amount: bigint;
}

// TODO(transfer): build the importer-funded deposit into the multisig vault ATA.
export async function buildFundTransfer(_params: BuildFundTransferParams): Promise<Transaction> {
  throw new Error('Not implemented');
}
