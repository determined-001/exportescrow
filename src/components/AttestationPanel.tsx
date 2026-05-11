'use client';

import { useState } from 'react';
import { useToast } from './Toast';

interface Props {
  dealId: string;
  onAttested?: (approved: boolean) => void;
}

export function AttestationPanel({ dealId, onAttested }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(approved: boolean) {
    setSubmitting(true);
    try {
      // TODO(attest): include a verifier wallet signature over (dealId, document_cid, approved).
      const res = await fetch(`/api/deals/${dealId}/attest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approved, reason: reason || null }),
      });
      if (!res.ok) throw new Error(`Attestation failed: ${res.status}`);
      onAttested?.(approved);
      toast.push(approved ? 'Approved' : 'Rejected', 'success');
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Attestation failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-200">Verifier attestation</h3>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Optional notes (required when rejecting)"
        className="block w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={submitting}
          className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
