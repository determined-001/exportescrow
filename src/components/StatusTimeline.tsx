import type { DealStatus } from '@/types/deal';
import { DEAL_STATUSES } from '@/lib/deal-state';

interface Props {
  status: DealStatus;
}

const HAPPY_PATH: DealStatus[] = ['created', 'funded', 'docs_submitted', 'attested', 'released'];

export function StatusTimeline({ status }: Props) {
  // TODO(timeline): show disputed/refunded branches when status leaves the happy path.
  const currentIndex = HAPPY_PATH.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {HAPPY_PATH.map((s, i) => {
        const reached = currentIndex >= 0 && i <= currentIndex;
        return (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${reached ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            {s}
          </li>
        );
      })}
      {!HAPPY_PATH.includes(status) && DEAL_STATUSES.includes(status) && (
        <li className="rounded-full bg-amber-700 px-3 py-1 text-white">{status}</li>
      )}
    </ol>
  );
}
