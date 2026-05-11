import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().url().default('https://api.devnet.solana.com'),
  NEXT_PUBLIC_SOLANA_NETWORK: z.enum(['devnet', 'mainnet-beta', 'testnet']).default('devnet'),
  NEXT_PUBLIC_USDC_MINT: z.string().default('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().default(''),
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(''),
  PRIVY_APP_SECRET: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  KIRAPAY_API_KEY: z.string().default(''),
  KIRAPAY_API_BASE_URL: z.string().default('https://api.kira-pay.com'),
  KIRAPAY_WEBHOOK_SECRET: z.string().default(''),
  PINATA_JWT: z.string().default(''),
  PINATA_GATEWAY: z.string().default(''),
  PLATFORM_FEE_PAYER_PRIVATE_KEY: z.string().default(''),
});

export type Env = z.infer<typeof schema>;

// Next.js inlines NEXT_PUBLIC_* vars only when referenced by literal name, so we
// list each key explicitly rather than passing process.env wholesale.
function loadEnv(): Env {
  return schema.parse({
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK,
    NEXT_PUBLIC_USDC_MINT: process.env.NEXT_PUBLIC_USDC_MINT,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    KIRAPAY_API_KEY: process.env.KIRAPAY_API_KEY,
    KIRAPAY_API_BASE_URL: process.env.KIRAPAY_API_BASE_URL,
    KIRAPAY_WEBHOOK_SECRET: process.env.KIRAPAY_WEBHOOK_SECRET,
    PINATA_JWT: process.env.PINATA_JWT,
    PINATA_GATEWAY: process.env.PINATA_GATEWAY,
    PLATFORM_FEE_PAYER_PRIVATE_KEY: process.env.PLATFORM_FEE_PAYER_PRIVATE_KEY,
  });
}

export const env: Env = loadEnv();

export function requireServerEnv<K extends keyof Env>(key: K): string {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing required server env: ${String(key)}`);
  }
  return value as string;
}
