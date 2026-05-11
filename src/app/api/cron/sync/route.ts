import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse<{ reconciled: number } | { error: string }>> {
  // TODO(cron): for each deal where status === 'created', check vault ATA balance
  // via lib/solana/balance.getVaultBalance. If balance >= amount_usdc, transition
  // to 'funded' and emit an event. Schedule via Vercel cron or external cron hitting this route.
  return NextResponse.json({ reconciled: 0 });
}
