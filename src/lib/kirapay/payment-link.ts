import type { CreatePaymentLinkRequest, CreatePaymentLinkResponse } from '@/types/kirapay';

// TODO(kirapay): confirm endpoint path + request shape in docs.kira-pay.com.
// Likely POST /v1/payment-links — call kirapayRequest once verified.
export async function createPaymentLink(_input: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
  throw new Error('Not implemented');
}
