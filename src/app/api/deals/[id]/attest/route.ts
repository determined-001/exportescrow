import { NextResponse } from 'next/server';
import { z } from 'zod';

const AttestSchema = z.object({
  approved: z.boolean(),
  reason: z.string().nullable().optional(),
  verifierPubkey: z.string().optional(),
  signature: z.string().optional(),
});

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, ctx: Ctx): Promise<NextResponse<{ ok: true } | { error: string }>> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = AttestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  // TODO(attest): verify Privy session, verify signature over (dealId, document_cid, approved),
  // insert into attestations table (unique on deal_id+verifier_pubkey), recompute deal status.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
