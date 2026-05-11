import { DealForm } from '@/components/DealForm';
import { WalletButton } from '@/components/WalletButton';

export default function NewDealPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">New escrow deal</h1>
        <WalletButton />
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Set the exporter&apos;s payout chain and address. We&apos;ll spin up an SPL multisig vault and
        a KIRAPAY funding link in the next step.
      </p>
      <div className="mt-8">
        <DealForm />
      </div>
    </main>
  );
}
