import Link from 'next/link';
import type { Deal } from '@/types/deal';
import { ChainBadge } from './ChainBadge';

interface Props {
  deal: Deal;
  viewerRole?: 'importer' | 'exporter' | 'verifier';
}

export function DealCard({ deal, viewerRole = 'importer' }: Props) {
  const href = `/${viewerRole}/${deal.id}`;
  return (
    <Link
      href={href}
      className="block rounded border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{deal.id.slice(0, 8)}…</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-300">
          {deal.status}
        </span>
      </div>
      <div className="mt-2 text-lg font-medium text-white">${deal.amount_usdc.toLocaleString()} USDC</div>
      <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
        <span>Payout:</span>
        <ChainBadge chainId={deal.exporter_payout_chain} />
        <span>{deal.exporter_payout_token}</span>
      </div>
    </Link>
  );
}
