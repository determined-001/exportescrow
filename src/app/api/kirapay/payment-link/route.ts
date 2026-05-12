import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/db';
import { createAndStorePaymentLink } from '@/lib/deals';
import { getPaymentLink } from '@/lib/kirapay/payment-link';
import { KiraPayError } from '@/lib/kirapay/client';
import type { Deal } from '@/types/deal';

export const runtime = 'nodejs';

const Schema = z.object({
  dealId: z.string().uuid(),
});

interface PaymentLinkPayload {
  paymentLinkId: string;
  paymentUrl: string;
  expiresAt: string;
}

export async function POST(
  req: Request,
): Promise<NextResponse<PaymentLinkPayload | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { dealId } = parsed.data;

  const supabase = supabaseServer();

  const { data: dealRow, error: dealErr } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (dealErr || !dealRow) {
    return NextResponse.json({ error: `Deal not found: ${dealErr?.message ?? dealId}` }, { status: 404 });
  }

  const deal = dealRow as Deal;

  if (deal.status !== 'created') {
    return NextResponse.json(
      { error: `Deal is in status '${deal.status}' — payment links can only be created for 'created' deals` },
      { status: 409 },
    );
  }

  // Idempotency: if link already exists, return it
  if (deal.kirapay_payment_link_id) {
    try {
      const existing = await getPaymentLink(deal.kirapay_payment_link_id);
      return NextResponse.json({
        paymentLinkId: existing.paymentLinkId,
        paymentUrl: existing.paymentUrl,
        expiresAt: existing.expiresAt.toISOString(),
      });
    } catch (err) {
      // If KIRAPAY returns an error for the stored ID, fall through and create a new one.
      // This handles stale/expired link IDs.
      console.warn(
        `[payment-link] failed to fetch existing link ${deal.kirapay_payment_link_id} for deal ${dealId}: ` +
          (err instanceof KiraPayError ? `${err.code} ${err.message}` : String(err)),
      );
    }
  }

  try {
    const result = await createAndStorePaymentLink(deal, supabase);
    return NextResponse.json({
      paymentLinkId: result.paymentLinkId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err) {
    const msg =
      err instanceof KiraPayError
        ? `KIRAPAY error [${err.code}]: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[payment-link] createPaymentLink failed for deal ${dealId}: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
