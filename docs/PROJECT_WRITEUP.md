# ExportEscrow — Project Write-Up

## Executive Summary

ExportEscrow is a non-custodial Letter of Credit for African importers and overseas exporters. An importer in Lagos funds a Solana SPL Token multisig vault through KIRAPAY in whatever stablecoin she already holds; an exporter in Shenzhen receives payout in his preferred chain and token the moment a 2-of-3 multisig of shipping-industry verifiers signs off on the Bill of Lading. KIRAPAY makes the underlying Solana custody invisible to both parties, which is why a primitive that has existed since 2020 finally becomes usable by the SMEs who need it most.

## The Problem

Adaeze runs a phone-accessories import business in Lagos. She has buyers in three states, working capital from a microfinance line, and a supplier in Shenzhen she trusts on product quality. She needs to wire $50,000 against a 200-box order. She has three options, and none of them work.

The first is a traditional bank Letter of Credit. Her relationship bank quotes 25% cash collateral, three weeks of processing, and 4% in fees — on top of a Central Bank of Nigeria dollar quota she has to formally apply for. The all-in cost eats most of her margin on the shipment. When CBN dollar restrictions tightened in 2023, even that path became uncertain. She has been told twice in the last year that her dollar request was deferred to the next quarter; the order moves on her timeline, not the bank's.

The second is peer-to-peer stablecoin transfer. She buys USDT on Tron from a Lagos OTC desk and wires it to her Shenzhen supplier. The supplier ships goods after receiving full payment. There is no escrow. In her industry, fraud rates on this kind of cross-border trade — supplier never ships, ships counterfeits, ships short of order — sit between 15% and 30% across ECA and World Bank surveys of informal trade. Adaeze has been burned once, has lost a five-figure deposit, and now refuses to pay in full upfront. Her supplier refuses to ship without it. The negotiation goes nowhere.

The third is hawala — a relationship-based trust network, settled in cash on the other end. It works for the people who have the relationships. Adaeze is one degree removed from the brokers her father used; the trust does not extend to her. There is no recourse, no paper trail, and no way to scale a business on it.

Behind these three failures is one number: Afreximbank and the African Development Bank put the unmet trade finance demand on the continent at roughly $30B per year. Adaeze is one of millions of importers staring at an order they should be able to finance and cannot.

## Our Solution

With ExportEscrow, Adaeze creates a deal in her dashboard, naming her supplier's Tron USDT wallet and the order amount. The protocol provisions an SPL Token multisig vault on Solana — a primitive that has held billions in custody on Solana mainnet since 2020 — with three named freight-and-customs verifiers in Apapa as the signing set, threshold 2-of-3. She clicks "Fund via KIRAPAY" and pays from her existing Polygon USDC wallet. KIRAPAY routes the funds across the bridge and settles USDC into the vault on Solana. Adaeze never opens a Solana wallet, never holds a SOL balance, never sees a Solana address.

Her supplier Wei sees the deal flip to `funded` on his dashboard within two minutes. He ships the order and uploads the Bill of Lading from the freight forwarder. The verifier set — three real Lagos shipping participants, each with a name, a license number, and a reputation that depends on getting this right — reviews the document on their phones, signs attestations with their wallet keys, and once two of three have approved, the release fires. The vault drains to KIRAPAY's collection address, KIRAPAY routes USDT onto Tron, and Wei's balance increments. He, too, never opens a Solana wallet.

The flow Adaeze just walked through took under three minutes of active attention. The funds were never under the unilateral control of any single party, including ExportEscrow itself. The verifier attestations are signed and stored — available to either party as evidence in any future dispute. And the cost is a fraction of a bank LC: roughly KIRAPAY's bridge fee plus a small verifier fee, paid only on successful release.

For Adaeze, the difference between this flow and her three current options is the difference between being able to fulfill the order and not. That is the product.

## Why This Is Defensible

Three layers of moat. None is unbeatable in isolation; together they form a position that hardens over time.

**The verifier network is a real-world asset.** The verifiers are named freight brokers, customs agents, and port-side document specialists in Lagos and other African trade hubs. Onboarding them requires being physically present in those markets — taking meetings at Apapa, sitting in customs offices, building trust with industry associations. A team in San Francisco, Berlin, or even Nairobi cannot replicate this remotely. The constraint is geographic and relational, not technical. We are building this slowly because there is no shortcut to it.

**The reputation graph compounds.** Every released deal anchors a tuple — verifier set, importer, exporter, deal size, on-time release — to the `events` table from day one, and to Solana itself in v2. Over thousands of deals, the data lets us underwrite verifier fees against volume, price deal risk dynamically (a first-time importer pays a higher fee than one fifty deals deep with the same verifier set), and onboard new verifiers against a public track record. The data is not buyable; it has to be earned one deal at a time.

**The KIRAPAY integration is structural, not bolted on.** Most products that use a cross-chain payment provider use it on one side of the trade — fund-in or fund-out, not both — and treat it as a payment processor. We use KIRAPAY on both legs, with an SPL multisig as the fund-in destination and the Payout API as the back half of a programmable release primitive. A competitor cannot copy the integration without copying the architecture; copying the architecture means rebuilding the verifier network, and we are back to the first moat.

## How It Works (Technical Overview)

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

The flow in five sentences. The importer funds an SPL Token multisig vault on Solana through KIRAPAY's Payment Link API, paying from her preferred source chain. The exporter ships and uploads shipping documents to IPFS via Pinata. Verifiers in the deal's pre-registered set sign wallet-signed attestations over the deal id and document CID. When the m-of-n threshold is met, the multisig releases USDC to KIRAPAY's collection address. KIRAPAY then routes the funds to the exporter's preferred chain and token via the Payout API.

The custody primitive is Solana's native SPL Token multisig, not a custom Anchor program — the SPL multisig has been audited and battle-tested since 2020, so using it eliminates audit risk a hackathon-built escrow program would carry and lets engineering attention focus on the verifier network and the cross-chain UX where the product novelty actually lives.

For the full design — actor model, state machine, trust assumptions, failure modes, scalability analysis — see [docs/ARCHITECTURE.md](./ARCHITECTURE.md).

## KIRAPAY: Core, Not Add-On

Remove KIRAPAY from ExportEscrow and what remains is a Solana DeFi tool with a verifier dashboard, addressable only by the small population of importers and exporters who already use Solana USDC. That intersection is functionally empty in the African corridors we target. With KIRAPAY, the same primitive becomes accessible to any importer holding any supported stablecoin on any supported chain, paying any exporter who wants any supported stablecoin on any supported chain. The cross-chain layer is what turns "non-custodial escrow" from an infrastructure capability into a product usable by 99% of our target market.

We use KIRAPAY on both legs — fund-in via the Payment Link API, fund-out via the Payout API — with the SPL multisig vault as the fund-in destination and the verifier attestation threshold as the gate on fund-out. KIRAPAY's webhook drives our deal state transitions on both sides. The integration is the architecture, not an add-on to it.

For the endpoint-by-endpoint depth — request shapes, webhook HMAC verification, idempotency, and the partial-release and refund-route primitives we would build next — see [docs/KIRAPAY_INTEGRATION.md](./KIRAPAY_INTEGRATION.md).

## Market Opportunity

Afreximbank estimates the unmet African trade finance demand at roughly $30B per year. The global SME trade finance gap, per WTO and IFC estimates, sits closer to $2.5T (figures vary across sources; both are conservative round numbers). We are not claiming the whole African gap — pilot economics require focus on a handful of corridors first, with Nigeria-China, Kenya-China, and Egypt-Turkey as obvious starts — but the size of the gap is the reason this is worth building. The deal sizes in our target SME segment cluster around $20K–$200K; per-deal unit economics work cleanly at fees in the low single-digit percent range.

## What We Built in 48 Hours

- Working SPL Token multisig vault on Solana devnet, with deterministic vault ATA derivation per deal.
- Full KIRAPAY integration: fund-in via Payment Link API, fund-out via Payout API, HMAC-verified webhook with idempotent state transitions and on-chain reconciliation.
- End-to-end demo of a cross-chain deal: importer pays Polygon USDC, vault funds on Solana, verifiers attest, exporter receives USDT on Tron — under three minutes total.
- Verifier attestation flow with sponsored gas — verifiers sign in via Privy magic link and never need their own SOL.
- Document upload to IPFS via Pinata, persisted by CID on the deal row.
- Deal dashboard for all three roles (importer, exporter, verifier), with role-scoped views and a deal state timeline.
- Supabase schema covering deals, verifier sets, verifiers, attestations, and an immutable events audit log.
- Cron reconciliation that reads on-chain vault balance directly and corrects deal state when webhooks miss.

## What's Next

The v2 roadmap is concrete. Transferable Bill of Lading NFTs unlock pre-shipment financing — the exporter can be paid before the ship docks if a third party will take possession of the in-transit goods, with the BoL NFT escrowed in the same multisig as the USDC. A compounding reputation graph, indexed from the `events` table on Solana, lets us underwrite verifier fees and price deal risk dynamically as the dataset grows. Decentralized Kleros-style arbitration replaces manual dispute review once dispute volume justifies a stake-based market. Operationally, the 2026 plan is a Q1 pilot with five Lagos importers on the Nigeria-China corridor, expanding to Kenya, Egypt, and South Africa across the year as we onboard locally-licensed verifier sets in each market.

## Team

TODO — names and roles.

## Links

- GitHub repo: TODO
- Demo video: TODO
- Live demo: TODO
- Architecture deep dive: [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- KIRAPAY integration: [docs/KIRAPAY_INTEGRATION.md](./KIRAPAY_INTEGRATION.md)
