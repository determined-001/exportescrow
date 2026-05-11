import { StatusTimeline } from '@/components/StatusTimeline';
import { KiraPayCheckout } from '@/components/KiraPayCheckout';
import { DocumentViewer } from '@/components/DocumentViewer';
import { WalletButton } from '@/components/WalletButton';

interface Props {
  params: Promise<{ dealId: string }>;
}

export default async function ImporterDealPage({ params }: Props) {
  const { dealId } = await params;

  // TODO(deals): fetch the deal from /api/deals/[id] (server-side) and pass real values below.
  const placeholderAmount = 0;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Deal {dealId.slice(0, 8)}…</h1>
        <WalletButton />
      </div>
      <div className="mt-6">
        <StatusTimeline status="created" />
      </div>
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Fund escrow</h2>
          <p className="mt-1 text-xs text-slate-400">Pay via KIRAPAY; funds settle into the SPL multisig vault.</p>
          <div className="mt-4">
            <KiraPayCheckout dealId={dealId} amountUsdc={placeholderAmount} />
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Documents</h2>
          <div className="mt-4">
            <DocumentViewer cid={null} filename={null} />
          </div>
        </div>
      </section>
    </main>
  );
}
