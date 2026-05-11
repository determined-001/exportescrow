export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  label?: string;
}

/**
 * Retry a Solana RPC read with exponential backoff. NOT for writes — sends
 * could double-submit; @solana/web3.js write helpers handle their own retries
 * internally via sendAndConfirmTransaction's `maxRetries`.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelay = options.baseDelayMs ?? 500;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      await sleep(baseDelay * 2 ** i);
    }
  }
  if (lastErr instanceof Error && options.label) {
    lastErr.message = `[${options.label}] ${lastErr.message}`;
  }
  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
