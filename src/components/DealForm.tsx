'use client';

import { useState, type FormEvent } from 'react';
import { listChains } from '@/lib/chains';
import { useToast } from './Toast';

export interface DealFormValues {
  exporterPayoutChain: string;
  exporterPayoutToken: string;
  exporterPayoutAddress: string;
  amountUsdc: number;
  deadline: string;
}

interface Props {
  onSubmit?: (values: DealFormValues) => Promise<void> | void;
}

export function DealForm({ onSubmit }: Props) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const chains = listChains();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values: DealFormValues = {
      exporterPayoutChain: String(form.get('chain') ?? ''),
      exporterPayoutToken: String(form.get('token') ?? 'USDC'),
      exporterPayoutAddress: String(form.get('address') ?? ''),
      amountUsdc: Number(form.get('amount') ?? 0),
      deadline: String(form.get('deadline') ?? ''),
    };
    try {
      setSubmitting(true);
      // TODO(deals): wire to POST /api/deals once the route is implemented.
      await onSubmit?.(values);
      toast.push('Deal draft saved', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <label className="block">
        <span className="text-sm text-slate-300">Exporter payout chain</span>
        <select name="chain" className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
          {chains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-slate-300">Payout token</span>
        <select name="token" className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
          <option value="USDC">USDC</option>
          <option value="USDT">USDT</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm text-slate-300">Exporter address</span>
        <input
          name="address"
          required
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="0x... or Solana pubkey"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-300">Amount (USDC)</span>
        <input
          name="amount"
          type="number"
          min={1}
          required
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-300">Deadline</span>
        <input
          name="deadline"
          type="datetime-local"
          required
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Create deal'}
      </button>
    </form>
  );
}
