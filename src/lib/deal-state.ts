import type { DealStatus } from '@/types/deal';

export const DEAL_STATUSES: readonly DealStatus[] = [
  'created',
  'funded',
  'docs_submitted',
  'attested',
  'released',
  'disputed',
  'refunded',
] as const;

const TRANSITIONS: Record<DealStatus, readonly DealStatus[]> = {
  created: ['funded', 'disputed'],
  funded: ['docs_submitted', 'disputed', 'refunded'],
  docs_submitted: ['attested', 'disputed'],
  attested: ['released', 'disputed'],
  released: [],
  disputed: ['refunded'],
  refunded: [],
};

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DealStatus, to: DealStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid deal state transition: ${from} -> ${to}`);
  }
}

export function isTerminal(status: DealStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
