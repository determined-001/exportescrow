import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">ExportEscrow</span>
        <WalletButton />
      </header>

      <section className="mt-16 space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Cross-border trade, escrowed on-chain.
        </h1>
        <p className="max-w-2xl text-slate-300">
          ExportEscrow is a decentralized Letter-of-Credit for African importers trading with overseas
          exporters. An importer in Lagos funds an escrow; an exporter in Shenzhen is paid out the
          moment shipping documents are verified by a 2-of-3 multisig of real shipping-industry
          verifiers. Custody lives in Solana&apos;s native SPL multisig — no custom Anchor program —
          and KIRAPAY routes cross-chain settlement.
        </p>
        <div className="flex flex-wrap gap-3 pt-4">
          <Link
            href="/importer/new"
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            I&apos;m an importer
          </Link>
          <Link
            href="/verifier"
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200"
          >
            I&apos;m a verifier
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        <Step n={1} title="Fund">Importer funds USDC into an SPL multisig vault via KIRAPAY.</Step>
        <Step n={2} title="Ship & document">Exporter ships goods and uploads the Bill of Lading + customs docs.</Step>
        <Step n={3} title="Verify & release">2-of-3 verifiers approve; funds release to the exporter&apos;s chain.</Step>
      </section>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-4">
      <div className="text-xs text-slate-500">Step {n}</div>
      <div className="mt-1 text-base font-medium text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{children}</p>
    </div>
  );
}
