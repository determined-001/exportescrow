import { Connection } from '@solana/web3.js';
import { env, solanaServerConfig } from '@/lib/env';

// Client-facing connection. Also used by the wallet adapter ConnectionProvider.
export const solanaConnection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');

// Server-only connection — may point at a different (paid) RPC endpoint.
// Use this from API routes and scripts that do heavy on-chain work.
export const solanaServerConnection = new Connection(solanaServerConfig.rpcUrl, 'confirmed');
