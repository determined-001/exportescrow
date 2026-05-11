import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { z } from 'zod';
import { supabaseServer } from '@/lib/db';
import { solanaServerConfig } from '@/lib/env';
import { solanaServerConnection } from '@/lib/solana/connection';
import { getFeePayerKeypair } from '@/lib/solana/keys';
import { createDealMultisig } from '@/lib/solana/multisig';
import { DEAL_STATUSES } from '@/lib/deal-state';
import type { Deal } from '@/types/deal';

export const runtime = 'nodejs';

const CreateDealSchema = z.object({
  importerPubkey: z.string().min(32).max(44),
  exporterPayoutChain: z.string().min(1),
  exporterPayoutToken: z.string().min(1),
  exporterPayoutAddress: z.string().min(1),
  amountUsdc: z
    .string()
    .regex(/^\d+$/, 'amountUsdc must be a non-negative integer string')
    .refine((s) => BigInt(s) > 0n, 'amountUsdc must be > 0'),
  deadline: z.string().datetime(),
  verifierSetId: z.string().uuid(),
});

interface VerifierRow {
  pubkey: string;
}
interface VerifierSetRow {
  id: string;
  threshold: number;
  verifiers: VerifierRow[];
}

export async function POST(req: Request): Promise<NextResponse<{ deal: Deal } | { error: string }>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = CreateDealSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const input = parsed.data;

  // Validate importer pubkey + USDC mint up-front so we don't pay rent for nothing.
  let importerPubkey: PublicKey;
  let mint: PublicKey;
  try {
    importerPubkey = new PublicKey(input.importerPubkey);
    mint = new PublicKey(solanaServerConfig.usdcMint);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid public key: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  const supabase = supabaseServer();

  // Load the verifier set + its three verifiers.
  const { data: vsRaw, error: vsErr } = await supabase
    .from('verifier_sets')
    .select('id, threshold, verifiers(pubkey)')
    .eq('id', input.verifierSetId)
    .single();

  if (vsErr || !vsRaw) {
    return NextResponse.json({ error: `Verifier set not found: ${vsErr?.message ?? input.verifierSetId}` }, { status: 404 });
  }
  const verifierSet = vsRaw as unknown as VerifierSetRow;
  if (!verifierSet.verifiers || verifierSet.verifiers.length !== 3) {
    return NextResponse.json(
      { error: `Verifier set must have exactly 3 verifiers (got ${verifierSet.verifiers?.length ?? 0})` },
      { status: 400 },
    );
  }

  let verifierPubkeys: PublicKey[];
  try {
    verifierPubkeys = verifierSet.verifiers.map((v) => new PublicKey(v.pubkey));
  } catch (err) {
    return NextResponse.json(
      { error: `Verifier pubkey invalid: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  // Create the on-chain multisig (signers = [importer, ...3 verifiers], m = 3).
  let multisigAddress: PublicKey;
  let vaultAta: PublicKey;
  try {
    const feePayer = getFeePayerKeypair();
    const result = await createDealMultisig({
      connection: solanaServerConnection,
      payer: feePayer,
      importerPubkey,
      verifierPubkeys,
      threshold: 3,
      mint,
    });
    multisigAddress = result.multisigAddress;
    vaultAta = result.vaultAta;
  } catch (err) {
    return NextResponse.json(
      { error: `Multisig creation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  // Persist the deal row.
  const { data: dealRow, error: insertErr } = await supabase
    .from('deals')
    .insert({
      importer_pubkey: input.importerPubkey,
      exporter_payout_chain: input.exporterPayoutChain,
      exporter_payout_token: input.exporterPayoutToken,
      exporter_payout_address: input.exporterPayoutAddress,
      amount_usdc: input.amountUsdc,
      deadline: input.deadline,
      verifier_set_id: input.verifierSetId,
      status: 'created',
      multisig_address: multisigAddress.toBase58(),
      vault_ata: vaultAta.toBase58(),
    })
    .select('*')
    .single();

  if (insertErr || !dealRow) {
    // Multisig was created on-chain but the DB row didn't land. Don't try to
    // clean up the on-chain account — the rent is small and any rollback risks
    // losing the multisig keypair entirely. Log the orphan for ops follow-up.
    console.error(
      `ORPHANED MULTISIG: ${multisigAddress.toBase58()} (vault ${vaultAta.toBase58()}). ` +
        `DB insert failed: ${insertErr?.message ?? 'unknown error'}`,
    );
    return NextResponse.json(
      {
        error:
          'Multisig was created on-chain but the deal row failed to persist. The orphaned multisig address is in the server logs.',
      },
      { status: 500 },
    );
  }

  // Audit-log the creation. Best-effort: a failed event insert doesn't fail the request.
  const { error: eventErr } = await supabase.from('events').insert({
    deal_id: dealRow.id,
    event_type: 'deal.created',
    payload: {
      multisig_address: multisigAddress.toBase58(),
      vault_ata: vaultAta.toBase58(),
      threshold: 3,
      signer_count: 4,
    },
  });
  if (eventErr) {
    console.error(`Event insert failed for deal ${dealRow.id}: ${eventErr.message}`);
  }

  return NextResponse.json({ deal: dealRow as Deal });
}

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(DEAL_STATUSES as unknown as [string, ...string[]]).optional(),
  importerPubkey: z.string().optional(),
});

export async function GET(req: Request): Promise<NextResponse<{ deals: Deal[] } | { error: string }>> {
  const url = new URL(req.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit);
  if (parsed.data.status) {
    query = query.eq('status', parsed.data.status);
  }
  if (parsed.data.importerPubkey) {
    query = query.eq('importer_pubkey', parsed.data.importerPubkey);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deals: (data ?? []) as Deal[] });
}
