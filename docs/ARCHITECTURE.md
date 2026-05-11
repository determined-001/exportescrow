# ExportEscrow Architecture

## Problem

African importers face a structural mismatch between how trade finance is priced globally and how it is available locally. Letters of Credit — the 600-year-old instrument that gives an exporter confidence to ship before payment clears — have steadily withdrawn from the SME segment. Afreximbank and the African Development Bank estimate the unmet trade finance demand on the continent at roughly $30B per year. Nigerian importers face additional friction: the Central Bank of Nigeria's restrictions on access to dollars, combined with collateral requirements and processing times that mid-sized importers cannot absorb, mean that for a $50,000 phone-accessories order from Shenzhen to Lagos, the bank LC option is effectively closed.

The alternatives that have filled the gap are strictly worse than the instrument they replaced. Hawala-style informal settlement runs on relationships and verbal trust; ECA and World Bank surveys put fraud rates on informal cross-border trade in the 15–30% range, and there is no recourse mechanism. P2P stablecoin transfers, mostly USDT over Tron, solve the rail but not the escrow — either the importer pays first and hopes for honest shipment, or the exporter ships first and hopes for honest payment. Neither path has a third party that can hold funds conditional on shipping documents.

## Approach

ExportEscrow is a non-custodial Letter of Credit. The importer funds an SPL Token multisig vault on Solana through KIRAPAY, which lets her pay from any source chain and token she already holds. Once funded, the exporter ships and uploads the Bill of Lading and supporting customs documents, pinned to IPFS via Pinata. A multisig of real shipping-industry verifiers — freight forwarders, customs brokers, and Apapa-port-side document specialists with public reputations to protect — reviews the documents and signs attestations. When the threshold of approvals is met (default 2-of-3), the release transaction fires: USDC moves from the multisig vault to KIRAPAY's collection address, and KIRAPAY routes the funds to the exporter's preferred chain and token. Custody is enforced on-chain by Solana's native SPL multisig instruction; the protocol holds no key that can unilaterally move funds.

## System Overview

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

The actors:

- **Importer** — buyer of goods. Holds funds on whatever chain they already use; never sees Solana.
- **Exporter** — seller of goods. Receives payout on whatever chain/token they prefer; also never sees Solana.
- **Verifier set** — a pre-registered, named group of shipping-industry participants keyed by Solana public key. Composition is per-deal, stored in the `verifier_sets` and `verifiers` tables.
- **Protocol** — ExportEscrow itself. Operates the dashboard, mirrors on-chain state, and sponsors verifier gas. Holds at most one key in the multisig signer set, with no rights beyond being one of `n`.
- **KIRAPAY** — the cross-chain payment rail. Handles fund-in (importer's chain → Solana USDC) and fund-out (Solana USDC → exporter's chain).

## The Escrow Primitive: SPL Multisig vs Custom Anchor

Almost every Solana escrow today is an Anchor program. ExportEscrow deliberately uses the SPL Token program's native multisig instruction instead, with no custom on-chain code. There are three reasons.

First, the SPL Token multisig has been on Solana mainnet since 2020 and has held billions of dollars in custody across Squads, Mango, and the Solana Foundation's own treasuries. It has been audited, formally reviewed, and battle-tested in adversarial environments for four years. A custom Anchor program written in a hackathon window, no matter how careful, cannot match that. For a product that holds real importer funds, audit-free custody is the right starting point — the program account is part of the SPL Token program itself, not user-deployed code.

Second, the novelty in ExportEscrow lives somewhere other than the escrow. It is the verifier network (identification, onboarding, and signing flow of named Lagos-based shipping participants) and the workflow that ties their off-chain expertise to on-chain release. Reimplementing escrow in Anchor would be reinventing a wheel to prove we can, while the actual product risk and engineering surface live in the verifier flow and the cross-chain UX.

Third, a plain SPL `Transfer` signed by `m` of `n` keys is exactly the primitive needed: nothing more, nothing less. There is no on-chain business logic that benefits from custody. Verifier identity, deal metadata, document CIDs, and attestation reasons all live in Supabase, where they are queryable, indexable, and trivially rendered in the dashboard. The on-chain footprint per deal is a `Multisig` account, an associated token account holding USDC, and a release transaction. The vault and signer derivation logic lives in `src/lib/solana/multisig.ts`; the release transaction builder lives in `src/lib/solana/transfer.ts`.

## Data Flow (Happy Path)

1. **Deal creation.** The importer fills out the form at `/importer/new` and the client POSTs `POST /api/deals`. The handler validates input with Zod, inserts a row into `deals` with `status='created'`, and builds the SPL multisig creation transaction via `createSplMultisig` (`src/lib/solana/multisig.ts`) — a `Multisig` account with the verifier set's pubkeys and threshold, plus an associated USDC token account (the vault ATA). The multisig address and vault ATA are persisted on the deal row.

2. **Funding request.** The importer dashboard calls `POST /api/kirapay/payment-link` with the deal id and amount. The route invokes `createPaymentLink` (`src/lib/kirapay/payment-link.ts`), which asks KIRAPAY to generate a hosted checkout that settles USDC to the vault ATA. The returned `paymentUrl` is rendered as the `KiraPayCheckout` button.

3. **Cross-chain settlement.** The importer pays in her preferred chain and token. KIRAPAY routes through Axelar (or equivalent) and delivers USDC to the vault ATA on Solana. KIRAPAY then fires a `payment.completed` webhook to `POST /api/kirapay/webhook`, which verifies the HMAC signature (`src/lib/kirapay/webhook-verify.ts`), looks up the deal by `kirapay_payment_link_id`, and transitions `created → funded`.

4. **On-chain reconciliation.** A cron job hits `GET /api/cron/sync`, which iterates deals in `created` and `funded` status and reads the vault balance via `getVaultBalance` (`src/lib/solana/balance.ts`). If on-chain balance disagrees with what the webhook told us, the on-chain reading wins and the deal is corrected. This guards against missed, replayed, or spoofed webhooks.

5. **Document upload.** The exporter opens `/exporter/[dealId]` and uploads the Bill of Lading and customs paperwork via `DocumentUploader`. The file streams to `POST /api/deals/[id]/documents`, which pins to IPFS through Pinata (`src/lib/ipfs.ts`), writes `document_cid` and `document_filename` to the deal row, and transitions `funded → docs_submitted`.

6. **Verifier review.** Each verifier in the deal's `verifier_set` is notified by email magic link (Privy). They sign in, open `/verifier/[dealId]`, review the document, and submit an attestation via `POST /api/deals/[id]/attest`. The route inserts a row into `attestations` (unique on `(deal_id, verifier_pubkey)`) along with a wallet signature over `(deal_id, document_cid, approved)`. When the number of `approved=true` rows reaches the set's threshold, the deal transitions `docs_submitted → attested`.

7. **Release.** Once `status='attested'`, the protocol assembles the release transaction. For exporters who want USDC on Solana directly, `buildReleaseTransfer` (`src/lib/solana/transfer.ts`) produces an SPL `Transfer` from the vault ATA to the exporter's ATA, signed by the threshold verifier keys. For everything else — the common case — the transfer goes to KIRAPAY's collection address, then `createPayout` (`src/lib/kirapay/payout.ts`) routes the funds to the exporter's chain and token. On success the deal transitions `attested → released` and is terminal.

### Dispute and refund variant

From `created`, `funded`, `docs_submitted`, or `attested`, any actor can call `POST /api/deals/[id]/dispute` and move the deal into `disputed`. Automated movement freezes; the protocol does not unilaterally release or refund. Resolution is manual in the MVP: a review either rejects the dispute (and the deal is re-funded into the state machine from its prior state) or upholds it and moves the deal to `refunded`. The refund path builds a release transaction the same way as a successful release, but the destination is the importer's original chain — KIRAPAY's payout API routes back. v2 replaces this manual review with on-chain arbitration; see Roadmap.

## State Machine

The complete set of legal transitions, mirrored in `src/lib/deal-state.ts`:

```
                    created
                   /        \
              funded       disputed
              /   \             |
   docs_submitted refunded   refunded
        |   \
   attested  disputed
        |       |
   released  refunded
```

`released` and `refunded` are terminal. `disputed` is reachable from every non-terminal state and exits only to `refunded`. Every transition is validated by `assertTransition` before persisting, and every transition writes an `events` row with the prior status, the actor, and a structured payload. The events table is the authoritative per-deal audit log and the seed for the v2 reputation graph.

## Trust Model

What is trustless: fund custody and settlement finality. While funds are in the vault, the SPL Token program enforces that no transfer leaves without `threshold` valid signatures over the same transaction. The protocol's own key, if present in the signer set, has no powers beyond being one of `n`. Solana finality (~400ms slot time, with single-slot finality in the practical case post Optimistic Confirmation) governs settlement, and the release transaction is signed and submitted once — not via a separate program with its own state.

What is trusted-but-constrained: the verifier set, KIRAPAY, and Pinata. The verifier set assumes an honest majority of `threshold` of `n`. Three properties bound the collusion risk. Verifier identity is real and named — each verifier has reputational and licensing skin in the game. Each attestation is wallet-signed over the deal id and document CID, which makes a signed approval undeniable. And the dispute path lets any single dissenting verifier — or either counterparty — halt the deal and escalate to manual review. KIRAPAY is trusted for bridge finality on both legs; their security model composes with ours but does not extend it. Pinata is trusted for document availability; v2 plans dual-pinning to Arweave for the legal-retention case.

What is trusted (acceptable for MVP, hardened later): the protocol's backend mirror of on-chain state. The Supabase row is what the dashboard renders, and a compromised backend could lie about deal status. Two things bound the blast radius. The cron sync (step 4) reconciles claimed state against on-chain truth on every tick. And the multisig and vault ATA addresses are written into the deal row from the moment of creation, so any actor can verify the on-chain account independently of the dashboard at any time.

## Failure Modes

- **Importer doesn't fund.** Deal sits in `created` past `deadline`; the importer either reissues the payment link or the deal expires and is silently cleaned up. No on-chain custody was ever taken.
- **Exporter doesn't ship.** Deal stays in `funded` past `deadline`. The importer raises a dispute (`POST /api/deals/[id]/dispute`); manual review confirms the absence of documents; the deal moves `funded → disputed → refunded` via a multisig release back to the importer.
- **Verifiers don't respond.** Deal stalls in `docs_submitted`. Either counterparty can raise a dispute, which moves the deal to `disputed` for manual review. v2 adds an attestation timeout that escalates to a backup verifier set automatically.
- **IPFS pin lost.** `document_cid` becomes unreachable. Pinata is configured to re-pin on read; for high-value deals, the design accommodates dual-pinning to a second IPFS service or Arweave (v2).
- **KIRAPAY payout fails partway.** The release Transfer to KIRAPAY's collection address succeeds (the vault is drained) but the outbound bridge fails. KIRAPAY's webhook reports the failure; the protocol retries the payout or falls back to a manual stablecoin transfer. Both the drain and the payout retry are idempotent on the deal id.
- **Solana RPC downtime.** API routes fall back to a secondary RPC configured via `NEXT_PUBLIC_SOLANA_RPC_URL`; read paths gracefully degrade to cached Supabase state.
- **Contested attestation.** One verifier approves, one rejects, one abstains. The deal stays in `docs_submitted`. Manual review reads the verifier reasons from `attestations.reason` and either rotates a verifier or moves the deal to `refunded`.

## Scalability

Solana's current sustained throughput (~3,000 TPS realized, far higher theoretical) supports the vault creation and release transactions for millions of escrow deals per day without protocol-level bottlenecks. The transactions are standard SPL operations, well within the compute budget, and never the limiting factor.

The real bottleneck is verifier human throughput. A single verifier reviewing a Bill of Lading carefully can do perhaps thirty deals per day. Two paths address this without sacrificing review quality. Verifier sets scale per region — Lagos, Mombasa, Lomé, Casablanca — with locally-licensed brokers so reviews stay close to the trade. And verifier sets tier by deal size: high-volume low-value deals (sub-$5K) flow through a lower-cost tier with lighter document requirements, freeing senior verifiers for the deals where their attention compounds.

Document storage costs are linear in deal count but trivial at MVP scale. A Bill of Lading PDF is 100–500 KB, and Pinata's pricing puts per-deal storage well under one cent. At seven-figure annual deal volume, the documents budget is in the low thousands of dollars. Long-term archival to Arweave for legal retention is on the order of $50 per million pinned documents.

## Roadmap

The most consequential v2 feature is **transferable Bill of Lading NFTs**. Once an exporter has uploaded a BoL to a deal, that document represents legal title to goods in transit. Minting the BoL as an SPL NFT held in the same multisig until release unlocks a parallel financial primitive: pre-shipment financing. A third party can buy the in-transit goods at a discount, take possession of the NFT (and therefore the right to the goods at port), and the exporter is paid before the ship docks. SPL multisig is the right substrate for it; the events table is the seed.

A **reputation graph compounded from on-chain history** is the second priority. Every released deal anchors a tuple of (verifier set, importer, exporter, deal size, on-time release) on Solana. Indexing this lets the protocol underwrite verifier fees against volume, price deal risk dynamically (a first-time importer pays a higher fee than one fifty deals deep with the same verifier set), and onboard new verifiers with a public track record. None of this exists at MVP; the `events` table captures the raw data from day one.

**Decentralized arbitration**, Kleros-style, is the third priority. Manual dispute review is a single point of failure for protocol credibility. Once dispute volume justifies it, a stake-based arbitration market — jurors lock USDC against their verdict and earn fees for honest review — closes the trust loop. The MVP deliberately stays manual because the dispute path is rare in the happy distribution and a small human team is faster than a stake market for the first thousand deals.

**AI-assisted document verification** is the fourth item. A vision-language model can pre-screen a Bill of Lading against the deal parameters — consignee, port, container ID, weight, HS code — and flag inconsistencies before a verifier opens it. The verifier remains the trust anchor; their throughput doubles. This is a workflow optimization, not a trust change.

A **parametric insurance pool for verifier failures** is the longest-tail item. A small percentage of each released deal flows into a Solana-native pool that pays out if a verified deal is later proven fraudulent on-chain. Pool solvency is enforced by the same SPL multisig primitive that holds individual deal escrows. This is the mechanism that lets the protocol extend to deals larger than any single verifier's reputation can underwrite, and it is the feature that turns ExportEscrow from a marketplace into a market.
