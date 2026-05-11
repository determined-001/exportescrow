'use client';

import useSWR, { type SWRResponse } from 'swr';
import type { Deal } from '@/types/deal';

const fetcher = async (url: string): Promise<Deal> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load deal: ${res.status}`);
  }
  return (await res.json()) as Deal;
};

// TODO(deals): add mutation helpers (e.g. submitDocument, attest, release) that
// call the matching API routes and revalidate via `mutate()`.
export function useDeal(dealId: string | undefined): SWRResponse<Deal, Error> {
  return useSWR<Deal, Error>(dealId ? `/api/deals/${dealId}` : null, fetcher);
}
