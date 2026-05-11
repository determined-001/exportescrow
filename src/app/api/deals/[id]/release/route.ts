import { NextResponse } from 'next/server';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: Ctx): Promise<NextResponse<{ txSignature: string } | { error: string }>> {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing deal id' }, { status: 400 });
  }
  // TODO(release): assert threshold-many approvals; build SPL multisig Transfer from vault ATA
  // (lib/solana/transfer.buildReleaseTransfer); submit with partial signatures from verifiers;
  // if exporter wants payout on a non-Solana chain, instead trigger lib/kirapay/payout.createPayout.
  return NextResponse.json({ error: 'Not implemented' }, { status: 501 });
}
