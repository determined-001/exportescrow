import { env } from '@/lib/env';

// TODO(kirapay): replace this fetch shim with the official KIRAPAY SDK once the
// package name is confirmed at docs.kira-pay.com (best guess: `kirapay-axelar-sdk`).
// Keeping the surface area to a typed `request<T>()` helper so the swap is local.

export interface KiraPayRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function kirapayRequest<T>(path: string, options: KiraPayRequestOptions = {}): Promise<T> {
  if (!env.KIRAPAY_API_KEY) {
    throw new Error('KIRAPAY not configured (KIRAPAY_API_KEY)');
  }
  const url = `${env.KIRAPAY_API_BASE_URL.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.KIRAPAY_API_KEY}`,
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KIRAPAY ${options.method ?? 'GET'} ${path} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}
