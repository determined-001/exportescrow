import { NextResponse } from 'next/server';
import type { Deal } from '@/types/deal';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Ctx): Promise<NextResponse<Deal | { error: string }>> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }
  // TODO(deals): select deal by id from Supabase; return 404 if missing.
  // Placeholder body so the route is navigable during scaffold.
  const placeholder: Deal = {
    id,
    importer_pubkey: '',
    exporter_payout_chain: 'solana',
    exporter_payout_token: 'USDC',
    exporter_payout_address: '',
    amount_usdc: 0,
    deadline: new Date().toISOString(),
    status: 'created',
    multisig_address: null,
    vault_ata: null,
    verifier_set_id: null,
    kirapay_payment_link_id: null,
    document_cid: null,
    document_filename: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return NextResponse.json(placeholder);
}
