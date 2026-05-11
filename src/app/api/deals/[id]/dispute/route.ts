import { NextResponse } from 'next/server';
import { z } from 'zod';

const DisputeSchema = z.object({
  reason: z.string().min(1),
  raisedBy: z.enum(['importer', 'exporter', 'verifier']),
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
  const parsed = DisputeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  // TODO(dispute): transition status to 'disputed', emit event, notify counterparties.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
