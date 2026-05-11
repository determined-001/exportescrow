import crypto from 'node:crypto';
import { env } from '@/lib/env';

// TODO(kirapay): confirm exact HMAC algorithm + header name used by KIRAPAY webhooks
// (typical: HMAC-SHA256 over raw body, hex-encoded, sent as `x-kirapay-signature`).
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!env.KIRAPAY_WEBHOOK_SECRET) {
    throw new Error('KIRAPAY_WEBHOOK_SECRET not configured');
  }
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha256', env.KIRAPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
