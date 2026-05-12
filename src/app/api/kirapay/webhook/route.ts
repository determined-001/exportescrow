import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '@/lib/kirapay/webhook-verify';
import { supabaseServer } from '@/lib/db';
import { requireServerEnv } from '@/lib/env';
import { assertTransition } from '@/lib/deal-state';
import { getVaultBalance } from '@/lib/solana/balance';
import { solanaServerConnection } from '@/lib/solana/connection';
import type { KiraPayWebhookEvent, KiraPayPaymentEventData } from '@/types/kirapay';
import type { Deal } from '@/types/deal';

export const runtime = 'nodejs';

// TODO(kirapay): confirm webhook signature header name against docs.kira-pay.com.
// Stub and KIRAPAY_INTEGRATION.md both use 'x-kirapay-signature'.
const SIGNATURE_HEADER = 'x-kirapay-signature';

export async function POST(req: Request): Promise<NextResponse> {
  // (a) Raw body BEFORE any JSON parse — HMAC must run on the exact byte stream KIRAPAY signed.
  const raw = await req.text();

  // (b) Extract signature header
  const signatureHeader = req.headers.get(SIGNATURE_HEADER) ?? '';

  // (c) Verify HMAC. Misconfigured secret = 500, invalid signature = 401.
  let webhookSecret: string;
  try {
    webhookSecret = requireServerEnv('KIRAPAY_WEBHOOK_SECRET');
  } catch {
    console.error('[webhook] KIRAPAY_WEBHOOK_SECRET not configured');
    return NextResponse.json({}, { status: 500 });
  }

  if (!verifyWebhookSignature(raw, signatureHeader, webhookSecret)) {
    // Do NOT include reason — oracle attack surface
    console.warn('[webhook] invalid signature — request dropped');
    return NextResponse.json({}, { status: 401 });
  }

  // (d) Parse JSON only after signature is verified
  let event: KiraPayWebhookEvent;
  try {
    event = JSON.parse(raw) as KiraPayWebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!event.id || !event.type) {
    return NextResponse.json({ error: 'Missing event id or type' }, { status: 400 });
  }

  const supabase = supabaseServer();

  // (e) Idempotency: check if this KIRAPAY event ID has already been processed.
  // The event ID is stored in events.payload->>'kirapay_event_id'.
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .filter('payload->>kirapay_event_id', 'eq', event.id)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // (f) Dispatch on event type
  switch (event.type) {
    case 'payment.completed':
      return handlePaymentCompleted(event, supabase);
    case 'payment.failed':
      return handlePaymentFailed(event, supabase);
    default:
      // (g) Unknown types must return 200 so KIRAPAY stops retrying
      console.log(`[webhook] unhandled event type '${event.type}' (id=${event.id}) — ignored`);
      return NextResponse.json({ received: true });
  }
}

async function resolveDeal(
  data: KiraPayPaymentEventData,
  supabase: SupabaseClient,
): Promise<Deal | null> {
  // TODO(kirapay): confirm the exact field name for the payment link ID in the webhook payload
  // against docs.kira-pay.com. Checking all common variants.
  const paymentLinkId =
    (data.paymentLinkId as string | undefined) ??
    (data.payment_link_id as string | undefined) ??
    (data.id as string | undefined);

  const referenceId = data.reference as string | undefined;

  if (paymentLinkId) {
    const { data: row } = await supabase
      .from('deals')
      .select('*')
      .eq('kirapay_payment_link_id', paymentLinkId)
      .maybeSingle();
    if (row) return row as Deal;
  }

  if (referenceId) {
    const { data: row } = await supabase
      .from('deals')
      .select('*')
      .eq('id', referenceId)
      .maybeSingle();
    if (row) return row as Deal;
  }

  return null;
}

async function insertEventRow(
  supabase: SupabaseClient,
  dealId: string,
  eventType: string,
  kirapayEventId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('events').insert({
    deal_id: dealId,
    event_type: eventType,
    payload: { ...payload, kirapay_event_id: kirapayEventId },
  });
  if (error) {
    console.error(`[webhook] event insert failed for deal ${dealId}: ${error.message}`);
  }
}

async function handlePaymentCompleted(
  event: KiraPayWebhookEvent,
  supabase: SupabaseClient,
): Promise<NextResponse> {
  const data = event.data;
  const deal = await resolveDeal(data, supabase);

  if (!deal) {
    console.error(
      `[webhook] payment.completed (${event.id}): no deal found — ` +
        `paymentLinkId=${String(data.paymentLinkId ?? data.payment_link_id ?? data.id)} ` +
        `reference=${String(data.reference)}`,
    );
    // Return 200 so KIRAPAY stops retrying an event we can't process
    return NextResponse.json({ received: true });
  }

  // Validate state machine before touching Solana
  try {
    assertTransition(deal.status, 'funded');
  } catch {
    // Already funded (e.g. via cron sync) — still record and return 200
    console.log(
      `[webhook] deal ${deal.id} is already '${deal.status}' — recording event, skipping transition`,
    );
    await insertEventRow(supabase, deal.id, event.type, event.id, { ...data });
    return NextResponse.json({ received: true });
  }

  if (!deal.vault_ata) {
    console.error(`[webhook] deal ${deal.id} has no vault_ata — cannot verify balance`);
    return NextResponse.json({ received: true });
  }

  // On-chain vault balance check before transitioning.
  // TODO(perf): if Solana RPC is slow, move the balance check + state transition to a
  // background job and return 200 immediately. For MVP this synchronous path is acceptable
  // since the webhook handler must complete in < 5 s and devnet RPC is typically < 1 s.
  let vaultBalance: bigint;
  try {
    const vaultPubkey = new PublicKey(deal.vault_ata);
    vaultBalance = await getVaultBalance(solanaServerConnection, vaultPubkey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] vault balance check failed for deal ${deal.id}: ${msg}`);
    // Return 200 — our Solana connectivity issues are not KIRAPAY's problem to retry
    return NextResponse.json({ received: true });
  }

  const expectedAmount = BigInt(deal.amount_usdc);
  if (vaultBalance < expectedAmount) {
    console.warn(
      `[webhook] vault balance ${vaultBalance} < expected ${expectedAmount} ` +
        `for deal ${deal.id} — not transitioning yet (cron sync will reconcile)`,
    );
    return NextResponse.json({ received: true });
  }

  // Atomic transition: optimistic lock on status='created' prevents double-transitions
  // if a concurrent request processes the same event.
  const { error: updateErr, data: updatedRows } = await supabase
    .from('deals')
    .update({ status: 'funded', updated_at: new Date().toISOString() })
    .eq('id', deal.id)
    .eq('status', 'created')
    .select('id');

  if (updateErr) {
    console.error(
      `[webhook] failed to transition deal ${deal.id} to funded: ${updateErr.message}`,
    );
    return NextResponse.json({ received: true });
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Another request won the race — still idempotent
    console.log(`[webhook] deal ${deal.id} transition race — already transitioned`);
  } else {
    console.log(
      `[webhook] deal ${deal.id} → funded (vault balance: ${vaultBalance}, event: ${event.id})`,
    );
  }

  await insertEventRow(supabase, deal.id, event.type, event.id, {
    ...data,
    vault_balance_lamports: vaultBalance.toString(),
  });

  return NextResponse.json({ received: true });
}

async function handlePaymentFailed(
  event: KiraPayWebhookEvent,
  supabase: SupabaseClient,
): Promise<NextResponse> {
  const data = event.data;
  const deal = await resolveDeal(data, supabase);

  if (deal) {
    // Leave deal in 'created' — importer can reissue payment (see KIRAPAY_INTEGRATION.md)
    await insertEventRow(supabase, deal.id, event.type, event.id, { ...data });
    console.log(
      `[webhook] payment.failed for deal ${deal.id} — logged, deal remains in '${deal.status}'`,
    );
  } else {
    console.warn(
      `[webhook] payment.failed (${event.id}): no matching deal found — ` +
        `paymentLinkId=${String(data.paymentLinkId ?? data.payment_link_id ?? data.id)} ` +
        `reference=${String(data.reference)}`,
    );
  }

  return NextResponse.json({ received: true });
}
