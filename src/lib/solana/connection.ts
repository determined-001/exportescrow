import { Connection } from '@solana/web3.js';
import { env } from '@/lib/env';

export const solanaConnection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');
