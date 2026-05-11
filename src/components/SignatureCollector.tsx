'use client';

import type { Attestation } from '@/types/deal';
import { Check, X, Clock } from 'lucide-react';

interface Props {
  attestations: Attestation[];
  threshold: number;
  totalSigners: number;
}

export function SignatureCollector({ attestations, threshold, totalSigners }: Props) {
  const approvals = attestations.filter((a) => a.approved).length;
  const rejections = attestations.filter((a) => !a.approved).length;
  const pending = Math.max(0, totalSigners - attestations.length);

  // TODO(signatures): show each verifier's pubkey + status, and surface the
  // collected partial signatures that will be used to build the release tx.

  return (
    <div className="space-y-2 rounded border border-slate-800 bg-slate-900 p-4">
      <h3 className="text-sm font-medium text-slate-200">
        Multisig progress — {approvals} / {threshold} approvals
      </h3>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1">
          <Check size={14} className="text-emerald-500" /> {approvals} approved
        </span>
        <span className="inline-flex items-center gap-1">
          <X size={14} className="text-red-500" /> {rejections} rejected
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={14} className="text-slate-500" /> {pending} pending
        </span>
      </div>
    </div>
  );
}
