import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { CreatePaymentLinkResponse } from '@/types/kirapay';

const Schema = z.object({
  dealId: z.string().uuid(),
  amount: z.number().positive(),
});

export async function POST(req: Request): Promise<NextResponse<CreatePaymentLinkResponse | { error: string }>> {
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
  // TODO(kirapay): load deal, call lib/kirapay/payment-link.createPaymentLink, persist
  // kirapay_payment_link_id on the deal, return the paymentUrl.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
