import { kirapayRequest, KiraPayError } from './client';
import type {
  CreatePaymentLinkRequest,
  CreatePaymentLinkResponse,
  GetPaymentLinkResponse,
} from '@/types/kirapay';

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Never retry 4xx — those are caller bugs
      if (err instanceof KiraPayError && err.httpStatus >= 400 && err.httpStatus < 500) {
        throw err;
      }
      if (attempt < MAX_RETRIES) {
        const jitter = 0.8 + Math.random() * 0.4;
        const delay = RETRY_BASE_MS * Math.pow(2, attempt) * jitter;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

export interface CreatePaymentLinkParams {
  amount: bigint;                   // mint units (6 decimals for USDC)
  destinationChain: 'solana';
  destinationToken: 'USDC';
  destinationAddress: string;       // vault ATA (base58)
  metadata: { dealId: string; importerPubkey: string };
  webhookUrl: string;
  expiresAt?: Date;
}

export interface PaymentLinkResult {
  paymentLinkId: string;
  paymentUrl: string;
  expiresAt: Date;
}

export interface PaymentLinkStatus extends PaymentLinkResult {
  status: string;
}

function mintUnitsToDecimal(amount: bigint): number {
  return Number(amount) / 1_000_000;
}

// TODO(kirapay): verify endpoint path (/v1/payment-links) and all field names against
// docs.kira-pay.com once accessible. Currently blocked by HTTP 403 on the docs site.
// If KIRAPAY uses different names (e.g. "settlementChain" vs "destinationChain"),
// update the body mapping here — the internal CreatePaymentLinkParams interface stays stable.
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  const body: CreatePaymentLinkRequest = {
    amount: mintUnitsToDecimal(params.amount),
    currency: 'USDC',
    destinationChain: params.destinationChain,
    destinationToken: params.destinationToken,
    destinationAddress: params.destinationAddress,
    reference: params.metadata.dealId,
    metadata: {
      dealId: params.metadata.dealId,
      importerPubkey: params.metadata.importerPubkey,
    },
    webhookUrl: params.webhookUrl,
  };
  if (params.expiresAt) {
    body.expiresAt = params.expiresAt.toISOString();
  }

  const raw = await withRetry(() =>
    kirapayRequest<CreatePaymentLinkResponse>('/v1/payment-links', {
      method: 'POST',
      body,
    }),
  );

  return {
    paymentLinkId: raw.id,
    paymentUrl: raw.paymentUrl,
    expiresAt: new Date(raw.expiresAt),
  };
}

export async function getPaymentLink(paymentLinkId: string): Promise<PaymentLinkStatus> {
  const raw = await withRetry(() =>
    kirapayRequest<GetPaymentLinkResponse>(`/v1/payment-links/${paymentLinkId}`, {
      method: 'GET',
    }),
  );

  return {
    paymentLinkId: raw.id,
    paymentUrl: raw.paymentUrl,
    expiresAt: new Date(raw.expiresAt),
    status: raw.status,
  };
}
