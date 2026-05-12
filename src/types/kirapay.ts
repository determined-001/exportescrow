// TODO(kirapay): verify all field names against docs.kira-pay.com once accessible (currently 403).
// These shapes are derived from KIRAPAY_INTEGRATION.md and common cross-chain payment API patterns.

export interface CreatePaymentLinkRequest {
  amount: number;           // decimal USDC (e.g. 1.5 for $1.50)
  currency: string;         // 'USDC'
  destinationChain: string; // 'solana'
  destinationToken: string; // 'USDC'
  destinationAddress: string;
  reference: string;        // deal UUID — echoed back in webhook
  metadata?: Record<string, string>;
  webhookUrl?: string;
  expiresAt?: string;       // ISO 8601
}

export interface CreatePaymentLinkResponse {
  id: string;
  paymentUrl: string;
  expiresAt: string; // ISO 8601
  status?: string;
}

export interface GetPaymentLinkResponse extends CreatePaymentLinkResponse {
  status: string;
}

export interface CreatePayoutRequest {
  amount: number;
  sourceChain: string;
  sourceToken: string;
  destinationChain: string;
  destinationToken: string;
  destinationAddress: string;
  reference: string;
}

export interface CreatePayoutResponse {
  id: string;
  status: 'pending' | 'completed' | 'failed' | string;
  txHash?: string;
}

export type KiraPayWebhookEventType =
  | 'payment.completed'
  | 'payment.failed'
  | 'payout.completed'
  | 'payout.failed';

// TODO(kirapay): confirm exact data field names for each event type against docs.kira-pay.com.
// Multiple field name variants are checked at runtime to handle camelCase / snake_case differences.
export interface KiraPayPaymentEventData {
  id?: string;              // may be the payment link ID
  paymentLinkId?: string;
  payment_link_id?: string;
  reference?: string;       // the reference we passed (= deal UUID)
  status?: string;
  amount?: number;
  currency?: string;
  destinationChain?: string;
  destinationAddress?: string;
  transactionHash?: string;
  settledAt?: string;
}

export interface KiraPayWebhookEvent {
  id: string;               // KIRAPAY's unique event ID — used for idempotency
  type: KiraPayWebhookEventType | string;
  data: KiraPayPaymentEventData & Record<string, unknown>;
  createdAt: string;
}
