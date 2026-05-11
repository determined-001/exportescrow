import { getChain } from '@/lib/chains';

interface Props {
  chainId: string;
}

export function ChainBadge({ chainId }: Props) {
  const chain = getChain(chainId);
  return (
    <span className="inline-flex items-center rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-200">
      {chain?.name ?? chainId}
    </span>
  );
}
