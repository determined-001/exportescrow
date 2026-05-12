import crypto from 'node:crypto';

// TODO(kirapay): confirm the exact HMAC algorithm used by KIRAPAY once docs.kira-pay.com is accessible.
// Assumption: HMAC-SHA256 over the raw UTF-8 body, hex-encoded. Signature may optionally be prefixed
// with "sha256=" (e.g. GitHub-style). Both forms are handled below.
//
// SECURITY: takes rawBody as a string — the caller MUST pass req.text() before any JSON.parse().
// Re-serializing through JSON.parse then JSON.stringify changes whitespace and breaks the comparison.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Strip "sha256=" prefix if present (some providers send "sha256=<hex>")
  const sig = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(sig, 'hex'),
    );
  } catch {
    // Buffer.from throws if sig has odd length or invalid hex chars — treat as invalid
    return false;
  }
}
