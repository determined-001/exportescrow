import type { CreatePayoutRequest, CreatePayoutResponse } from '@/types/kirapay';

// TODO(kirapay): confirm endpoint + request shape in docs.kira-pay.com.
// Likely POST /v1/payouts — call kirapayRequest once verified.
export async function createPayout(_input: CreatePayoutRequest): Promise<CreatePayoutResponse> {
  throw new Error('Not implemented');
}
