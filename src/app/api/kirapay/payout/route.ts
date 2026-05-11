import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CreatePayoutResponse } from '@/types/kirapay';

const Schema = z.object({
  dealId: z.string().uuid(),
});

export async function POST(req: Request): Promise<NextResponse<CreatePayoutResponse | { error: string }>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  // TODO(kirapay): only valid when status === 'attested'; load deal,
  // call lib/kirapay/payout.createPayout with the exporter's chain/token/address,
  // and on success transition to 'released'.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
