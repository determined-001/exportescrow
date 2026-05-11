import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Deal } from '@/types/deal';

const CreateDealSchema = z.object({
  importerPubkey: z.string().min(1),
  exporterPayoutChain: z.string().min(1),
  exporterPayoutToken: z.string().min(1),
  exporterPayoutAddress: z.string().min(1),
  amountUsdc: z.number().int().positive(),
  deadline: z.string().datetime(),
  verifierSetId: z.string().uuid().optional(),
});

export async function GET(): Promise<NextResponse<{ deals: Deal[] } | { error: string }>> {
  // TODO(deals): query Supabase deals table; support ?status= and ?role=importer/exporter filters.
  return NextResponse.json({ deals: [] });
}

export async function POST(req: Request): Promise<NextResponse<{ deal: Deal } | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = CreateDealSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  // TODO(deals): insert into Supabase, kick off SPL multisig creation, return real deal.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
