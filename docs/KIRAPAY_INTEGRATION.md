# KIRAPAY Integration

This document is the deep dive into how ExportEscrow uses KIRAPAY. For the broader system architecture — actors, escrow primitive, deal state machine, trust model — see [ARCHITECTURE.md](./ARCHITECTURE.md). What follows assumes the reader knows that ExportEscrow is a non-custodial Letter-of-Credit platform with an SPL multisig vault at its core.

## Why KIRAPAY is Foundational

Take KIRAPAY out of the ExportEscrow architecture and ask what is left. A Solana multisig holding USDC, releasing on m-of-n threshold signatures. That is a useful primitive but not a product. To interact with it, an importer must already hold USDC on Solana — and the Lagos importer with naira in a domestic bank account, USDT on Tron, or USDC on Polygon does not, and has no reason to learn a Solana wallet just to bridge in. The Shenzhen exporter has the symmetric problem: he wants payment in whatever stablecoin his suppliers and payroll already accept, which is almost never Solana USDC. The intersection of "importer who already holds Solana USDC" and "exporter who wants Solana USDC" in the African trade corridors we target is functionally empty.

KIRAPAY is what turns the primitive into a product. Both legs of every trade route through KIRAPAY: the importer pays in whatever chain and token she already holds and KIRAPAY settles USDC into our vault ATA on Solana; after attestations clear, we drain the vault to KIRAPAY's collection address and KIRAPAY routes the funds out to the exporter's preferred chain and token. The SPL multisig enforces non-custodial settlement, but neither counterparty ever opens Phantom or Solflare. Remove KIRAPAY from this picture and ExportEscrow collapses into a Solana DeFi tool with a verifier dashboard — and our target users disappear.

## Integration Surface

We use two KIRAPAY endpoints in production, plus one inbound webhook. Both endpoints are called server-side from Next.js API routes; the client never holds an API key.

**Fund-in: Payment Link API.** Wrapped by `createPaymentLink` in [`src/lib/kirapay/payment-link.ts`](../src/lib/kirapay/payment-link.ts) and surfaced via [`src/app/api/kirapay/payment-link/route.ts`](../src/app/api/kirapay/payment-link/route.ts). The route validates `{ dealId, amount }` with Zod, loads the deal, and calls KIRAPAY with `destinationChain="solana"`, `destinationToken="USDC"`, `destinationAddress=deal.vault_ata` (the SPL associated token account derived from the deal's multisig), `reference=deal.id`, and `webhookUrl` pointed at our webhook. The response `{ id, paymentUrl, expiresAt }` is persisted as `deals.kirapay_payment_link_id` so inbound webhooks correlate. The `paymentUrl` is rendered as a button in [`src/components/KiraPayCheckout.tsx`](../src/components/KiraPayCheckout.tsx) that redirects the importer into KIRAPAY's hosted checkout — from there KIRAPAY owns the UX (bridge selection, source-chain wallet, swap pricing) until the webhook fires.

**Fund-out: Payout API.** Wrapped by `createPayout` in [`src/lib/kirapay/payout.ts`](../src/lib/kirapay/payout.ts) and surfaced via [`src/app/api/kirapay/payout/route.ts`](../src/app/api/kirapay/payout/route.ts). The route validates `{ dealId }`, asserts `status === 'attested'`, and calls KIRAPAY with `sourceChain="solana"`, `sourceToken="USDC"`, and the exporter's preferred chain/token/address from the deal row. Before invoking Payout, the protocol broadcasts an m-of-n SPL `Transfer` from the vault ATA to KIRAPAY's collection address using `buildReleaseTransfer` from [`src/lib/solana/transfer.ts`](../src/lib/solana/transfer.ts), with partial signatures collected from the verifier threshold. Both halves are bound to the same deal id; the `payout.completed` webhook drives the final transition to `released`.

Base URL, auth, and error handling are centralized in `kirapayRequest<T>()` ([`src/lib/kirapay/client.ts`](../src/lib/kirapay/client.ts)) — a typed fetch helper that attaches `Authorization: Bearer ${KIRAPAY_API_KEY}` and surfaces non-2xx responses as throws. This is a deliberate seam: when the official SDK package name is confirmed at [docs.kira-pay.com](https://docs.kira-pay.com), the swap is a single-file change.

## Webhook Architecture

The inbound webhook handler at [`src/app/api/kirapay/webhook/route.ts`](../src/app/api/kirapay/webhook/route.ts) is the entry point for both `payment.*` and `payout.*` events. It reads the raw request body via `req.text()` before any JSON parse — HMAC verification must run against the exact byte stream KIRAPAY signed, and round-tripping through `req.json()` would re-serialize with different whitespace and break the comparison.

It then verifies the `x-kirapay-signature` header against the raw body using [`verifyWebhookSignature`](../src/lib/kirapay/webhook-verify.ts): HMAC-SHA256 with `KIRAPAY_WEBHOOK_SECRET`, hex-encoded, compared with `crypto.timingSafeEqual`. The timing-safe comparison is deliberate — naive string equality leaks prefix-match information and lets a sophisticated attacker forge signatures byte-by-byte. Invalid signatures return 401 without touching Supabase.

Only after verification does it parse the body into a typed `KiraPayWebhookEvent` and switch on `event.type`. `payment.completed` looks up the deal by `kirapay_payment_link_id` and transitions `created → funded`; `payment.failed` records the failure and leaves the deal in `created` so the importer can reissue. `payout.completed` resolves the deal by `reference` and transitions `attested → released`; `payout.failed` writes an event row for ops retry. Every transition runs through `assertTransition` in [`src/lib/deal-state.ts`](../src/lib/deal-state.ts) so an out-of-order webhook (e.g. `payout.completed` arriving before `attested`) is rejected rather than silently applied.

Idempotency is handled by writing one `events` row per webhook with a unique constraint on the KIRAPAY event id; a retried delivery hits the constraint and short-circuits, the route returns 200 so KIRAPAY stops retrying, and no state changes twice. The webhook is the fast path. The slow path is the cron sync at `GET /api/cron/sync`, which reads vault balance via `getVaultBalance` from [`src/lib/solana/balance.ts`](../src/lib/solana/balance.ts) and reconciles deal status against on-chain truth — if a webhook is missed, dropped, replayed, or spoofed, the on-chain reading wins on the next tick.

## The Cross-Chain UX We Demonstrate

The demo video walks one full deal end-to-end:

- **Importer (Adaeze, Lagos)** pays USDC on Polygon — *TODO(demo): confirm source chain/token pre-record; alternates are Tron USDT and Base USDC depending on testnet bridge speed on filming day.* She clicks "Fund via KIRAPAY" and the page redirects into the hosted checkout; no Solana wallet involved.
- **KIRAPAY routes** the funds and settles to the vault ATA on Solana, typically 30–90 seconds for Polygon → Solana via Axelar.
- **Exporter (Wei, Shenzhen)** sees the deal flip to `funded`, uploads the Bill of Lading, and waits.
- **Verifiers attest.** Once the 2-of-3 threshold is met, the protocol broadcasts the multisig Transfer to KIRAPAY's collection address and calls `/api/kirapay/payout` with the exporter's chain and token — *TODO(demo): target is Tron USDT; confirm pre-record.*
- **Payout settles** to Wei's wallet ~30–60 seconds later. The side-by-side capture is the demonstration: Adaeze's Polygon balance decrements, Wei's Tron balance increments, and the only on-chain artifact bridging them is the Solana vault — which neither of them ever touched.

End-to-end target on the happy path is under three minutes from importer click to exporter balance change.

## Why This Is Not Just "Stripe with Crypto"

**(a) Both sides of the trade run through KIRAPAY.** A trivial integration uses KIRAPAY for fund-in (as a payment processor) or fund-out (as a disbursement provider) — not both. ExportEscrow places KIRAPAY on both legs because both counterparties need the same cross-chain abstraction. Doubling the integration surface is the only configuration that works for the importer-exporter pairs we target — neither side shares a chain with the other.

**(b) Settlement destination is a multisig vault, not a merchant wallet.** A standard fund-in delivers to an EOA controlled by one merchant. We deliver to a Solana SPL multisig whose signing authority is split across the verifier set, with no single party (including us) holding a quorum. KIRAPAY's non-custodial guarantee on the rail composes with our non-custodial guarantee on custody — funds are never under unilateral control between the importer's wallet and the exporter's.

**(c) Payout is a programmable release primitive, not a disbursement.** Most integrations call `/v1/payouts` when an internal business event fires — refund issued, order shipped, payroll cycle closed. We call it when an m-of-n cryptographic threshold is reached across wallet signatures from real shipping-industry verifiers, and only after the vault drain has confirmed on Solana. KIRAPAY's payout endpoint is the second half of a release primitive whose first half is enforced by the SPL Token program; `src/lib/deal-state.ts` permits `attested → released` only when both halves have completed.

## What We'd Build Next on KIRAPAY

Three integrations we want but cannot do cleanly with the current surface area. We offer these as engineering feedback to the KIRAPAY team — they are concrete, scoped, and rooted in real trade-finance UX.

**Partial releases.** Trade finance routinely splits payment by milestone — 50% on shipment, 50% on receipt at port. The natural model is multiple payouts against the same deal id drawing from the same vault, and today we would have to bookkeep that across two independent `/v1/payouts` calls. A linked-payouts primitive — multiple payouts sharing a parent reference, with KIRAPAY tracking cumulative draw against a quoted source amount — would let us express milestone structure without inventing a ledger on top.

**Programmable refund routes.** When a deal moves to `refunded`, the importer should receive funds in the same chain and token she paid in, without our backend re-quoting a fresh route in the opposite direction — the information is already on the original payment link. A refund endpoint that consumes a `payment_link_id` and reverses the route would close a real UX gap in the dispute path, where speed matters and re-quoting reads as the protocol stalling.

**Deadline-bound payment-link expiry.** Every deal carries a `deadline` field. If the importer does not fund before that timestamp, the link should be invalidated at the rail layer rather than enforced post-hoc by our backend. An `expiresAt` parameter on `/v1/payment-links` with a corresponding `link.expired` webhook would let KIRAPAY enforce expiry where it belongs — and the source-chain bridge quote that backs a payment link is already time-sensitive on KIRAPAY's side, so the concept fits the rail's own liquidity model.
