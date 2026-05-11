// TODO(kirapay): verify request/response shapes against docs.kira-pay.com — these
// are best-guess placeholders modeled on typical cross-chain payment APIs.

export interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  destinationChain: string;
  destinationToken: string;
  destinationAddress: string;
  reference: string;
  webhookUrl?: string;
}

export interface CreatePaymentLinkResponse {
  id: string;
  paymentUrl: string;
  expiresAt: string;
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

export interface KiraPayWebhookEvent {
  id: string;
  type: KiraPayWebhookEventType;
  data: Record<string, unknown>;
  createdAt: string;
}
