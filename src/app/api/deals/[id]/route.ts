import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { supabaseServer } from '@/lib/db';
import { solanaServerConnection } from '@/lib/solana/connection';
import { getVaultBalance } from '@/lib/solana/balance';
import type { Attestation, Deal, DealEvent } from '@/types/deal';

export const runtime = 'nodejs';

interface Ctx {
  params: Promise<{ id: string }>;
}

interface DealDetailResponse {
  deal: Deal;
  vault_balance: string;
  attestations: Attestation[];
  events: DealEvent[];
}

export async function GET(
  _req: Request,
  ctx: Ctx,
): Promise<NextResponse<DealDetailResponse | { error: string }>> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: deal, error: dealErr } = await supabase.from('deals').select('*').eq('id', id).single();
  if (dealErr || !deal) {
    return NextResponse.json({ error: `Deal not found: ${dealErr?.message ?? id}` }, { status: 404 });
  }

  // Read live vault balance from chain. Best-effort: if the chain read fails we
  // still return the deal row with a 0 balance and let the client surface a
  // stale-data hint via the eventually-consistent cron sync.
  let vaultBalance = 0n;
  const typedDeal = deal as Deal;
  if (typedDeal.vault_ata) {
    try {
      vaultBalance = await getVaultBalance(solanaServerConnection, new PublicKey(typedDeal.vault_ata));
    } catch (err) {
      console.error(`vault balance read failed for ${typedDeal.vault_ata}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const [{ data: attestations }, { data: events }] = await Promise.all([
    supabase.from('attestations').select('*').eq('deal_id', id).order('created_at', { ascending: true }),
    supabase.from('events').select('*').eq('deal_id', id).order('created_at', { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    deal: typedDeal,
    vault_balance: vaultBalance.toString(),
    attestations: (attestations ?? []) as Attestation[],
    events: (events ?? []) as DealEvent[],
  });
}
