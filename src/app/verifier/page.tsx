export default function VerifierQueuePage() {
  // TODO(verifier): list deals where status === 'docs_submitted' from /api/deals?status=docs_submitted
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Pending review queue</h1>
      <p className="mt-2 text-sm text-slate-400">
        Deals awaiting verifier attestation will appear here.
      </p>
      <div className="mt-8 rounded border border-dashed border-slate-700 p-6 text-sm text-slate-500">
        No pending deals yet.
      </div>
    </main>
  );
}
