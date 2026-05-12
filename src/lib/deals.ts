import type { SupabaseClient } from '@supabase/supabase-js';
import { createPaymentLink, type PaymentLinkResult } from './kirapay/payment-link';
import { requireServerEnv } from './env';
import type { Deal } from '@/types/deal';

export async function createAndStorePaymentLink(
  deal: Deal,
  supabase: SupabaseClient,
): Promise<PaymentLinkResult> {
  if (!deal.vault_ata) {
    throw new Error(`Deal ${deal.id} has no vault_ata — cannot create payment link`);
  }

  const webhookBase = requireServerEnv('KIRAPAY_WEBHOOK_PUBLIC_URL').replace(/\/$/, '');

  const result = await createPaymentLink({
    amount: BigInt(deal.amount_usdc),
    destinationChain: 'solana',
    destinationToken: 'USDC',
    destinationAddress: deal.vault_ata,
    metadata: {
      dealId: deal.id,
      importerPubkey: deal.importer_pubkey,
    },
    webhookUrl: `${webhookBase}/api/kirapay/webhook`,
  });

  const { error: updateErr } = await supabase
    .from('deals')
    .update({ kirapay_payment_link_id: result.paymentLinkId })
    .eq('id', deal.id);

  if (updateErr) {
    // Payment link was created but we couldn't store the ID. Log for ops —
    // the cron sync will reconcile via on-chain balance.
    console.error(
      `[deals] failed to store kirapay_payment_link_id for deal ${deal.id}: ${updateErr.message}`,
    );
  }

  const { error: eventErr } = await supabase.from('events').insert({
    deal_id: deal.id,
    event_type: 'payment_link.created',
    payload: {
      payment_link_id: result.paymentLinkId,
      payment_url: result.paymentUrl,
      expires_at: result.expiresAt.toISOString(),
    },
  });
  if (eventErr) {
    console.error(`[deals] event insert failed for deal ${deal.id}: ${eventErr.message}`);
  }

  return result;
}
