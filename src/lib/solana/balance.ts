import {
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';
import { Connection, PublicKey } from '@solana/web3.js';
import { sleep, withRetry } from './retry';

/**
 * Read the SPL token balance at an ATA. Returns 0n if the account does not
 * exist yet (e.g. before the vault has been funded), rather than throwing.
 * Output is bigint in mint units — for USDC (6 decimals), 1_000_000n = 1 USDC.
 */
export async function getVaultBalance(
  connection: Connection,
  vaultAta: PublicKey,
): Promise<bigint> {
  try {
    const account = await withRetry(() => getAccount(connection, vaultAta), {
      label: 'getAccount',
    });
    return account.amount;
  } catch (err) {
    if (err instanceof TokenAccountNotFoundError || err instanceof TokenInvalidAccountOwnerError) {
      return 0n;
    }
    throw err;
  }
}

/**
 * Poll the vault balance every 2s until it reaches `expectedAmount` or the
 * timeout elapses. Used by the KIRAPAY webhook + cron sync paths to confirm
 * settlement before transitioning deal state.
 */
export async function waitForFunding(
  connection: Connection,
  vaultAta: PublicKey,
  expectedAmount: bigint,
  timeoutMs = 60_000,
): Promise<bigint> {
  const deadline = Date.now() + timeoutMs;
  let lastBalance = 0n;
  while (Date.now() < deadline) {
    lastBalance = await getVaultBalance(connection, vaultAta);
    if (lastBalance >= expectedAmount) return lastBalance;
    await sleep(2000);
  }
  throw new Error(
    `Funding timeout: vault balance ${lastBalance} < ${expectedAmount} after ${timeoutMs}ms`,
  );
}
