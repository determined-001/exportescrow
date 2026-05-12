import { env } from '@/lib/env';

export class KiraPayError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly requestId: string | null,
  ) {
    super(message);
    this.name = 'KiraPayError';
  }
}

export interface KiraPayRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function kirapayRequest<T>(
  path: string,
  options: KiraPayRequestOptions = {},
): Promise<T> {
  const apiKey = env.KIRAPAY_API_KEY;
  if (!apiKey) {
    throw new KiraPayError('NOT_CONFIGURED', 'KIRAPAY_API_KEY not set', 0, null);
  }

  const baseUrl = env.KIRAPAY_API_BASE_URL.replace(/\/$/, '');
  const url = `${baseUrl}${path}`;
  const method = options.method ?? 'GET';
  const timeoutMs = options.timeoutMs ?? 15_000;
  const startMs = Date.now();

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(options.headers ?? {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(tid);
    const ms = Date.now() - startMs;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[kirapay] ${method} ${path} NETWORK_ERROR (${ms}ms): ${msg}`);
    throw new KiraPayError('NETWORK_ERROR', `KIRAPAY network error: ${msg}`, 0, null);
  }
  clearTimeout(tid);

  const ms = Date.now() - startMs;
  // TODO(kirapay): confirm the request ID header name once docs.kira-pay.com is accessible.
  const requestId =
    res.headers.get('x-request-id') ??
    res.headers.get('x-kirapay-request-id') ??
    res.headers.get('request-id') ??
    null;
  console.log(
    `[kirapay] ${method} ${path} ${res.status} (${ms}ms) requestId=${requestId ?? 'none'}`,
  );

  if (!res.ok) {
    let errorBody: { code?: string; message?: string } = {};
    try {
      errorBody = (await res.json()) as typeof errorBody;
    } catch {
      // ignore — use defaults below
    }
    throw new KiraPayError(
      errorBody.code ?? `HTTP_${res.status}`,
      errorBody.message ?? `KIRAPAY ${method} ${path} returned ${res.status}`,
      res.status,
      requestId,
    );
  }

  return (await res.json()) as T;
}
