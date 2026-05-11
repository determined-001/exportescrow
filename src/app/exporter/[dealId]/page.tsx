import { StatusTimeline } from '@/components/StatusTimeline';
import { DocumentUploader } from '@/components/DocumentUploader';
import { DocumentViewer } from '@/components/DocumentViewer';

interface Props {
  params: Promise<{ dealId: string }>;
}

export default async function ExporterDealPage({ params }: Props) {
  const { dealId } = await params;

  // TODO(deals): fetch the deal server-side and gate uploader on status === 'funded'.
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Exporter view — {dealId.slice(0, 8)}…</h1>
      <div className="mt-6">
        <StatusTimeline status="funded" />
      </div>
      <section className="mt-8 space-y-4">
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Submit shipping documents</h2>
          <p className="mt-1 text-xs text-slate-400">
            Upload Bill of Lading and customs paperwork. Pinned to IPFS via Pinata.
          </p>
          <div className="mt-4">
            <DocumentUploader dealId={dealId} />
          </div>
        </div>
        <div className="rounded border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-medium text-slate-200">Uploaded</h2>
          <div className="mt-4">
            <DocumentViewer cid={null} filename={null} />
          </div>
        </div>
      </section>
    </main>
  );
}
