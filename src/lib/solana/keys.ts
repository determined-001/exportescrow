import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { env } from '@/lib/env';

/**
 * Load the protocol fee-payer keypair from the base58-encoded secret key in
 * env. Throws if missing or malformed. Never logs the secret.
 */
export function getFeePayerKeypair(): Keypair {
  if (!env.FEE_PAYER_PRIVATE_KEY) {
    throw new Error('FEE_PAYER_PRIVATE_KEY not configured');
  }
  let secret: Uint8Array;
  try {
    secret = bs58.decode(env.FEE_PAYER_PRIVATE_KEY);
  } catch {
    throw new Error('FEE_PAYER_PRIVATE_KEY is not valid base58');
  }
  if (secret.length !== 64) {
    throw new Error(`FEE_PAYER_PRIVATE_KEY must decode to 64 bytes, got ${secret.length}`);
  }
  return Keypair.fromSecretKey(secret);
}
