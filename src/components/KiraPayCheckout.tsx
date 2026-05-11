'use client';

import { useState } from 'react';
import { useToast } from './Toast';

interface Props {
  dealId: string;
  amountUsdc: number;
}

export function KiraPayCheckout({ dealId, amountUsdc }: Props) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      // TODO(kirapay): POST /api/kirapay/payment-link with { dealId, amount } and
      // redirect the importer to the returned paymentUrl.
      const res = await fetch('/api/kirapay/payment-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dealId, amount: amountUsdc }),
      });
      if (!res.ok) throw new Error(`KIRAPAY checkout failed: ${res.status}`);
      const data = (await res.json()) as { paymentUrl?: string };
      if (data.paymentUrl) window.location.href = data.paymentUrl;
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to start checkout', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {loading ? 'Preparing…' : `Fund ${amountUsdc.toLocaleString()} USDC via KIRAPAY`}
    </button>
  );
}
