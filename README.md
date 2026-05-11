# ExportEscrow

Decentralized Letters of Credit for African importers, powered by Solana and KIRAPAY.

**[Demo video](TODO)** · **[Live demo (devnet)](TODO)** · **[Project write-up](TODO)**

## The Problem

African importers face a structural mismatch between how trade finance is priced globally and how it is available locally. Letters of Credit — the 600-year-old instrument that gives an exporter confidence to ship before payment clears — have steadily withdrawn from the SME segment. Afreximbank and the African Development Bank estimate the unmet trade finance demand on the continent at roughly $30B per year. Nigerian importers face additional friction: Central Bank of Nigeria restrictions on dollar access, plus collateral and processing requirements that mid-sized importers cannot absorb, mean that for a $50,000 phone-accessories order from Shenzhen to Lagos, the bank LC option is effectively closed.

The alternatives that have filled the gap are strictly worse than the instrument they replaced. Hawala-style informal settlement runs on relationships and verbal trust; surveys put fraud rates on informal cross-border trade in the 15–30% range, and there is no recourse. P2P stablecoin transfers — mostly USDT over Tron — solve the rail but not the escrow: either the importer pays first and hopes for honest shipment, or the exporter ships first and hopes for honest payment. Neither path has a third party that can hold funds conditional on shipping documents.

## The Solution

ExportEscrow is a non-custodial Letter of Credit. The importer funds an SPL Token multisig vault on Solana through KIRAPAY, paying from any source chain and token she already holds. Once funded, the exporter ships and uploads the Bill of Lading and supporting customs documents to IPFS via Pinata. A multisig of real shipping-industry verifiers — freight forwarders, customs brokers, port-side document specialists — reviews the documents and signs attestations.

When the threshold of approvals is met (default 2-of-3), the release transaction fires. USDC moves from the multisig vault to KIRAPAY's collection address, and KIRAPAY routes the funds to the exporter's preferred chain and token. Neither counterparty ever opens a Solana wallet; Solana is invisible plumbing that enforces non-custodial settlement.

The protocol holds at most one of `n` keys in the multisig and has no power to move funds unilaterally. Off-chain deal state lives in Supabase; on-chain custody lives in the SPL multisig vault; the two are reconciled by a cron job that reads vault balance directly.

For the full technical architecture, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md). For the KIRAPAY integration deep dive, see [docs/KIRAPAY_INTEGRATION.md](./docs/KIRAPAY_INTEGRATION.md).

## Architecture at a Glance

```
  ┌────────────┐      ┌──────────┐      ┌──────────────────────┐
  │  Importer  │ ──▶  │ KIRAPAY  │ ──▶  │  SPL Multisig Vault  │
  │ (any chain)│      │  fund-in │      │  (Solana USDC ATA)   │
  └────────────┘      └──────────┘      └──────────┬───────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ Verifier m-of-n │
                                          │ Attestations    │
                                          └────────┬────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │ Release Tx      │
                                          │ (m-of-n signed) │
                                          └────────┬────────┘
                                                   │
                                                   ▼
  ┌────────────┐      ┌──────────┐      ┌─────────────────────┐
  │  Exporter  │ ◀──  │ KIRAPAY  │ ◀──  │ Vault drain to      │
  │ (any chain)│      │ fund-out │      │ KIRAPAY collection  │
  └────────────┘      └──────────┘      └─────────────────────┘
```

*Cross-chain on both legs; non-custodial throughout; Solana invisible to both counterparties.*

## Tech Stack

- **Next.js 16 (App Router)** — TypeScript-strict full-stack framework hosting the dashboard, API routes, and KIRAPAY webhook handler.
- **TypeScript** — strict mode everywhere; Zod validates env vars and every API input.
- **Tailwind CSS** — utility-first styling for the three role-specific dashboards.
- **Solana (`@solana/spl-token`, `@solana/web3.js`)** — SPL Token native multisig for non-custodial escrow custody.
- **KIRAPAY** — cross-chain payment rail on both legs (Payment Link API for fund-in, Payout API for fund-out, webhooks for state).
- **Supabase** — Postgres for off-chain deal state, verifier registry, attestations, and the events audit log.
- **Pinata** — IPFS pinning for Bills of Lading and customs documents.
- **Privy** — email magic-link auth + embedded wallets for verifiers.
- **SWR** — client-side data fetching against our own API routes.

## Quick Start

1. **Prerequisites.** Node 20+, npm (or pnpm), and optionally the Solana CLI for inspecting the on-chain vault during demos.

2. **Clone and enter the repo.**
   ```bash
   git clone https://github.com/TODO/export-escrow.git
   cd export-escrow
   ```

3. **Install dependencies.**
   ```bash
   npm install
   ```

4. **Configure environment.**
   ```bash
   cp .env.example .env.local
   ```
   Fill in keys from:
   - **KIRAPAY** — sign up at [docs.kira-pay.com](https://docs.kira-pay.com) for an API key, base URL, and webhook secret.
   - **Supabase** — create a project at [supabase.com](https://supabase.com); copy the URL, anon key, and service-role key.
   - **Pinata** — create a JWT at [pinata.cloud](https://pinata.cloud); add your gateway hostname.
   - **Privy** — create an app at [privy.io](https://privy.io) for verifier auth.

5. **Run the database migration.** Paste `supabase/migrations/001_init.sql` into the Supabase SQL editor, or run via the Supabase CLI:
   ```bash
   supabase db push
   ```

6. **Start the dev server.**
   ```bash
   npm run dev
   ```

7. **Open** [http://localhost:3000](http://localhost:3000).

## Project Structure

```
export-escrow/
├── src/
│   ├── app/              Next.js App Router (pages + API routes)
│   ├── components/       UI: DealForm, KiraPayCheckout, AttestationPanel, ...
│   ├── lib/              solana/, kirapay/, env.ts, db.ts, ipfs.ts, deal-state.ts
│   ├── hooks/            useDeal (SWR), useWallet (wallet-adapter re-export)
│   └── types/            Domain types — deal.ts, kirapay.ts
├── docs/                 ARCHITECTURE, KIRAPAY_INTEGRATION, PROJECT_WRITEUP, DEMO_SCRIPT
├── supabase/migrations/  001_init.sql — full schema
└── scripts/              seed-verifiers, demo-deal (operator helpers)
```

For the full layout and module responsibilities, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## How to Run the Demo Flow Locally

End-to-end happy path on Solana devnet. Use throwaway devnet wallets only — **never commit real seed phrases**.

1. **Create three throwaway devnet wallets** for the verifier set and one each for importer and exporter. Fund each with a few SOL from `solana airdrop` (devnet) and the importer with devnet USDC from the SPL faucet at [spl-token-faucet.com](https://spl-token-faucet.com).

2. **Open `/importer/new`** in browser A (Adaeze). Fill in the deal: payout chain Tron, payout token USDT, exporter address (use a Tron testnet address), amount, deadline. Submit.

3. **Pay via the KIRAPAY checkout link.** The dashboard surfaces a "Fund via KIRAPAY" button — click it and complete the payment using KIRAPAY's hosted testnet checkout with devnet USDC. The deal flips from `created` to `funded` once the webhook lands.

4. **Open `/exporter/[dealId]`** in browser B (Wei). Upload a sample Bill of Lading — `scripts/demo-fixtures/sample-bol.pdf` if present, otherwise any PDF. Deal status moves to `docs_submitted`.

5. **Open `/verifier/[dealId]`** in three separate browsers (or three Privy logins, one per verifier wallet).

6. **Sign attestations from 2 of 3 verifiers.** Each verifier reviews the document, clicks "Approve," and signs with their wallet. Once the threshold is met, status moves to `attested` and the release transaction fires automatically.

7. **Confirm release.** The Tron testnet wallet you set as the exporter address receives the routed payout from KIRAPAY ~30–60 seconds after release. Deal status is now `released`.

## Submission Links

- **Demo video:** TODO
- **Live demo:** TODO
- **Project write-up:** TODO
- **KIRAPAY integration deep dive:** [./docs/KIRAPAY_INTEGRATION.md](./docs/KIRAPAY_INTEGRATION.md)
- **Technical architecture:** [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Demo script (internal):** [./docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
- **Team:** TODO

## License

MIT. See [LICENSE](./LICENSE).
