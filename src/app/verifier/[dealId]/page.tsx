import { DocumentViewer } from '@/components/DocumentViewer';
import { AttestationPanel } from '@/components/AttestationPanel';
import { SignatureCollector } from '@/components/SignatureCollector';
import { StatusTimeline } from '@/components/StatusTimeline';

interface Props {
  params: Promise<{ dealId: string }>;
}

export default async function VerifierDealPage({ params }: Props) {
  const { dealId } = await params;

  // TODO(verifier): fetch deal + attestations server-side; gate AttestationPanel on
  // whether the authenticated Privy verifier has already attested.
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Review {dealId.slice(0, 8)}…</h1>
      <div className="mt-6">
        <StatusTimeline status="docs_submitted" />
      </div>
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Documents</h2>
          <div className="mt-4">
            <DocumentViewer cid={null} filename={null} />
          </div>
        </div>
        <div className="space-y-4">
          <AttestationPanel dealId={dealId} />
          <SignatureCollector attestations={[]} threshold={2} totalSigners={3} />
        </div>
      </section>
    </main>
  );
}
