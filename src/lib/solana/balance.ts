import type { PublicKey } from '@solana/web3.js';

// TODO(balance): read the SPL token balance at an ATA via solanaConnection.getTokenAccountBalance.
export async function getTokenAccountBalance(_ata: PublicKey): Promise<bigint> {
  throw new Error('Not implemented');
}

// TODO(balance): used by the cron sync job to reconcile what we believe is funded
// against the on-chain vault balance. Returns the bigint balance in mint units.
export async function getVaultBalance(_vaultAta: PublicKey): Promise<bigint> {
  throw new Error('Not implemented');
}
