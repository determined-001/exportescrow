import { createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { withRetry } from './retry';

export interface BuildReleaseTransactionParams {
  connection: Connection;
  multisigAddress: PublicKey;
  vaultAta: PublicKey;
  destinationAta: PublicKey;
  amount: bigint;
  signerPubkeys: PublicKey[];
  feePayer: PublicKey;
}

/**
 * Build an unsigned release transaction. The SPL multisig transfer instruction
 * lists every required multisig signer as a Solana-level signer account, so
 * the caller must collect signatures from each of `signerPubkeys` plus the
 * feePayer before broadcast.
 */
export async function buildReleaseTransaction(
  params: BuildReleaseTransactionParams,
): Promise<Transaction> {
  if (params.signerPubkeys.length === 0) {
    throw new Error('At least one multisig signer required');
  }
  if (params.amount <= 0n) {
    throw new Error('Amount must be positive');
  }

  const ix = createTransferInstruction(
    params.vaultAta,
    params.destinationAta,
    params.multisigAddress,
    params.amount,
    params.signerPubkeys,
    TOKEN_PROGRAM_ID,
  );

  const { blockhash, lastValidBlockHeight } = await withRetry(
    () => params.connection.getLatestBlockhash('confirmed'),
    { label: 'getLatestBlockhash' },
  );

  const tx = new Transaction({ feePayer: params.feePayer, blockhash, lastValidBlockHeight });
  tx.add(ix);
  return tx;
}

export interface CollectedSignature {
  pubkey: PublicKey;
  signature: Buffer;
}

/**
 * Attach externally-collected signatures to a Transaction and broadcast it.
 * The Transaction must already be primed with feePayer + blockhash, and may
 * carry a partial signature (typically the feePayer's). Each `signatures[]`
 * entry is added via tx.addSignature, which matches by pubkey.
 *
 * Waits for `confirmed` commitment before returning.
 */
export async function collectAndSubmitSignatures(
  tx: Transaction,
  signatures: CollectedSignature[],
  connection: Connection,
): Promise<string> {
  for (const { pubkey, signature } of signatures) {
    if (signature.length !== 64) {
      throw new Error(`Signature for ${pubkey.toBase58()} must be 64 bytes`);
    }
    tx.addSignature(pubkey, signature);
  }
  if (!tx.verifySignatures()) {
    throw new Error('Transaction has missing or invalid signatures');
  }

  const raw = tx.serialize();
  const txSignature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3,
  });
  if (!tx.recentBlockhash || tx.lastValidBlockHeight == null) {
    throw new Error('Transaction missing recentBlockhash or lastValidBlockHeight');
  }
  await connection.confirmTransaction(
    {
      signature: txSignature,
      blockhash: tx.recentBlockhash,
      lastValidBlockHeight: tx.lastValidBlockHeight,
    },
    'confirmed',
  );
  return txSignature;
}

export interface SimulationResult {
  logs: string[];
  unitsConsumed: number | null;
}

/**
 * Dry-run the (signed) release transaction against the cluster. Surfaces
 * SPL-Token program errors before broadcast. Throws with attached logs on
 * any non-null `err`.
 */
export async function simulateRelease(
  tx: Transaction,
  connection: Connection,
): Promise<SimulationResult> {
  const result = await withRetry(() => connection.simulateTransaction(tx), {
    label: 'simulateTransaction',
  });
  const logs = result.value.logs ?? [];
  if (result.value.err) {
    throw new Error(
      `Release simulation failed: ${JSON.stringify(result.value.err)}\n${logs.join('\n')}`,
    );
  }
  return { logs, unitsConsumed: result.value.unitsConsumed ?? null };
}
