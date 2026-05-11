import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/kirapay/webhook-verify';
import type { KiraPayWebhookEvent } from '@/types/kirapay';

export async function POST(req: Request): Promise<NextResponse<{ ok: true } | { error: string }>> {
  // TODO(kirapay): confirm signature header name with docs.kira-pay.com.
  const signature = req.headers.get('x-kirapay-signature');
  const raw = await req.text();

  let verified = false;
  try {
    verified = verifyWebhookSignature(raw, signature);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Verification failed' }, { status: 500 });
  }
  if (!verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: KiraPayWebhookEvent;
  try {
    event = JSON.parse(raw) as KiraPayWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // TODO(kirapay): on payment.completed, transition the matching deal to 'funded'
  // and double-check vault ATA balance via lib/solana/balance.getVaultBalance.
  // On payout.completed, transition to 'released'.
  void event;
  return NextResponse.json({ ok: true });
}
