# ExportEscrow — Demo Video Script

Internal working document for the team filming the 5-minute hackathon submission video. Total target runtime is **4:30** to leave a 30-second buffer under the 5:00 limit. This document is the shot-by-shot plan; do not improvise on the day.

## 1. Pre-Production Checklist

Before hitting record, verify every item. Anything red here means we are not filming yet.

- [ ] All four pages are working end-to-end on devnet against live KIRAPAY testnet:
    - `/importer/new` — deal creation form, submits and provisions an SPL multisig
    - `/importer/[dealId]` — funded-status view with the KIRAPAY checkout button
    - `/exporter/[dealId]` — uploader for the Bill of Lading
    - `/verifier/[dealId]` — sign-attestation view, gated on Privy login
- [ ] One importer wallet is funded with at least $200 in test-token equivalent on the source chain (Polygon USDC by default — *confirm chain pre-record*).
- [ ] Three verifier wallets are pre-funded with a small SOL balance and pre-logged-in on three separate browsers (Chrome profile A/B/C). Sponsored-gas should make SOL balance unnecessary, but keep it as a fallback.
- [ ] One exporter wallet is ready on the destination chain (Tron USDT testnet by default — *confirm pre-record*). The address is pre-filled in the deal form.
- [ ] A real or convincingly-faked Bill of Lading PDF is in `scripts/demo-fixtures/sample-bol.pdf` and renders cleanly in a browser preview. Names on the BoL must match the demo personas (Adaeze / Wei).
- [ ] KIRAPAY testnet API key is in `.env.local` and verified by a successful test payment-link creation 24 hours before filming.
- [ ] KIRAPAY webhook is reachable from the public internet (ngrok or Vercel preview deploy, whichever is more reliable on the day). Hit it once with a fake event and confirm HMAC verification succeeds.
- [ ] Solana devnet RPC URL has been swapped to a paid Helius or Triton endpoint. The default public devnet RPC will rate-limit during filming.
- [ ] OBS Studio is installed on both laptops, with two scenes configured: "Full screen capture" and "Webcam picture-in-picture." Test recording at 1080p / 30fps.
- [ ] Webcam tested. Lighting is acceptable on Adaeze's face for the cold open.
- [ ] Microphone tested in the room we will film in. Background hum and reverb checked. Headphones with a lavalier mic are the default; a USB condenser is the backup.
- [ ] Two laptops minimum, set up in the same room with screens both visible to the camera for the side-by-side wallet shots.
- [ ] **Backup footage exists.** Pre-record the full happy path once the night before filming, cleanly, with every step working. We use this as a B-roll cut-in if the live network misbehaves during the real take.
- [ ] All real API keys, wallet seeds, and dashboard URLs that could leak in screen capture have been audited. No `.env` files, no Supabase service-role keys, no Privy app secrets are visible.

## 2. Cast & Roles

**Narrator** — strongest English speaker on the team. Voiceover only; never on camera. Should have rehearsed the script at least three times and timed each line against the shot list. Speaks at ~150 words per minute.

**"Adaeze"** — the importer. On camera in the cold open and the "why this matters" beat. One spoken line in the cold open, one in the closing. Real human face — the goal is for the judge to remember her after the video.

**"Wei"** — the exporter. On camera briefly if logistically possible (a team member calling in from a different country looks more credible than two roles played by the same person in the same room). If not possible, Wei is off-camera and we cut directly to his laptop screen.

**Verifiers (3)** — off-camera, screen-share only. The three browser windows on the verifier review page are their entire presence. No need to record their faces; the wallet sign prompts and attestation submissions are what the audience sees.

**Operator (off-camera)** — one team member runs the cuts, monitors OBS, and triggers any prepared B-roll. Not part of the video.

## 3. Shot List with Timings

| Time | Visual | Voiceover | Notes |
|------|--------|-----------|-------|
| 0:00–0:20 | **Cold open.** Adaeze on camera in a Lagos environment (small office, warehouse corner, or rooftop with skyline). She speaks one line about her business directly into the camera. | Adaeze speaking on camera — no narrator. | The single human moment. Frame waist-up. Natural light. |
| 0:20–0:50 | **Problem B-roll.** Stock footage of shipping containers, Apapa port (use licensed stock if no permission), and a brief on-screen graphic with "$30B" and "15–30% fraud" pulled up as text overlays. | Narrator delivers the problem statement. | Keep text overlays minimal and legible at 1080p. |
| 0:50–1:10 | **Adaeze creates a deal.** Cut to laptop A. Screen capture of `/importer/new`. Show the form being filled in (chain: Tron, token: USDT, amount: $50,000, deadline: a week out). Submit. | Narrator explains what she is doing. | Screen capture at 1080p. Mouse movements deliberate, not fast. |
| 1:10–1:40 | **KIRAPAY payment.** Adaeze clicks "Fund via KIRAPAY." Redirect into KIRAPAY's hosted checkout. She connects her Polygon wallet, approves the transaction. Cut to a side-panel showing the Polygon balance decrement and, ~30–60 seconds later, the Solana vault ATA balance increment. | Narrator emphasizes: **cross-chain, in real time, importer never touches Solana.** | This is the 40% beat. Slow it down; let the wallet animations breathe. Cut in pre-recorded backup if live bridge is slow. |
| 1:40–2:00 | **Exporter view.** Cut to laptop B (Wei). Open `/exporter/[dealId]`. Deal status reads `funded`. Wei uploads the BoL PDF. Deal flips to `docs_submitted`. | Narrator: "Wei sees the deal funded — and he never opens a Solana wallet either." | Show the document name on screen briefly. |
| 2:00–2:40 | **Verifier review.** Cut to a split screen of three browsers showing `/verifier/[dealId]`. Verifier 1 clicks "Approve," signs with their wallet. Verifier 2 does the same. The status timeline transitions through `docs_submitted` → `attested` → `released`. Show a small on-screen banner: "Release transaction broadcast." | Narrator walks through the threshold meeting and the auto-fire of the release. | Use three actual Chrome profiles; do not fake the windows. Keep the split clean — three columns, no overlap. |
| 2:40–3:10 | **Exporter wallet balance.** Cut to Wei's Tron testnet wallet (Tronlink or equivalent). USDT balance increments ~30–60 seconds after release. Picture-in-picture of Adaeze's now-decremented Polygon wallet for the side-by-side. | Narrator: "From any chain, to any chain, settled in under three minutes." | The side-by-side is the money shot. Hold it for at least 5 seconds before cutting. |
| 3:10–3:40 | **Architecture lightning.** Cut to a clean architecture diagram — render the ASCII diagram from ARCHITECTURE.md as a slide, with three labeled call-outs: SPL Multisig (non-custodial), KIRAPAY (cross-chain rail on both legs), Verifier Network (real shipping brokers). | Narrator delivers a 30-second technical explanation. | Slide must be readable at 1080p. Use a large monospace font; do not cram. |
| 3:40–4:10 | **Why this matters.** Cut back to Adaeze on camera, same framing as the cold open. One spoken line on impact. | Adaeze speaking on camera. Narrator does not speak over her. | Brief, sincere. No restating of features. |
| 4:10–4:30 | **Closing card.** Full-screen card with: project name, team names, GitHub link, demo link, and one sentence about what's next. Hold for the full 20 seconds. | Narrator delivers one closing line. | Card should be readable in a single glance. White text on dark background. |

## 4. Voiceover Script (Full Text)

Each block is timed against the shot list. Numbers in brackets are approximate seconds the narrator should take to deliver the line. Read at ~150 wpm.

### 0:00–0:20 — Cold open (Adaeze on camera)

> **Adaeze:** "My name is Adaeze. I import phone accessories from Shenzhen to Lagos. My problem is that I can't pay my supplier in a way we both trust." [≈18s, conversational pace]

### 0:20–0:50 — Problem B-roll (narrator)

> **Narrator:** "Across Africa, the trade finance gap is about thirty billion dollars a year — orders that should ship and don't, because no one will hold the money in escrow. The bank Letter of Credit takes three weeks and twenty-five percent collateral. Peer-to-peer stablecoin transfers have no escrow at all; informal trade fraud rates sit between fifteen and thirty percent. There has to be a third option." [≈30s]

### 0:50–1:10 — Adaeze creates a deal (narrator)

> **Narrator:** "ExportEscrow gives Adaeze that third option. She creates a deal in the dashboard — naming her supplier's wallet, the amount, the deadline. Behind the scenes, the protocol provisions a Solana SPL Token multisig vault. Adaeze never opens a Solana wallet." [≈20s]

### 1:10–1:40 — KIRAPAY payment (narrator)

> **Narrator:** "She clicks 'Fund via KIRAPAY.' KIRAPAY is the cross-chain rail. Adaeze pays in Polygon USDC — the stablecoin she already holds. KIRAPAY routes the funds across the bridge and settles USDC into the Solana multisig vault. The vault now holds the escrowed amount, controlled by a two-of-three signing set of real Lagos shipping verifiers. Adaeze is done." [≈30s — pace matches the live bridge animation]

### 1:40–2:00 — Exporter view (narrator)

> **Narrator:** "Wei, in Shenzhen, sees the deal funded on his dashboard within two minutes. He ships the goods and uploads the Bill of Lading. He never opens a Solana wallet either." [≈18s]

### 2:00–2:40 — Verifier review (narrator)

> **Narrator:** "The Bill of Lading is now in front of three named shipping-industry verifiers in Lagos — a freight broker, a customs agent, a port-side document specialist. Each one reviews the document and signs an attestation with their own wallet key. Once two of three approve, the threshold is met. The release transaction fires automatically — the multisig drains to KIRAPAY's collection address, and KIRAPAY initiates the payout to Wei's chain." [≈40s]

### 2:40–3:10 — Exporter wallet balance (narrator)

> **Narrator:** "Wei receives USDT on Tron — the stablecoin his suppliers and his payroll already accept. From any chain, to any chain, settled in under three minutes. Solana enforces the custody; KIRAPAY makes it invisible." [≈25s]

### 3:10–3:40 — Architecture lightning (narrator)

> **Narrator:** "Three pieces. The custody is a Solana SPL Token multisig — battle-tested since 2020, non-custodial by construction, no custom Anchor program to audit. The cross-chain layer is KIRAPAY, on both legs of the trade — fund-in and fund-out — which is what makes this usable for anyone outside the Solana-native population. The trust layer is a network of real Lagos shipping participants whose signatures gate every release." [≈30s]

### 3:40–4:10 — Why this matters (Adaeze on camera)

> **Adaeze:** "This is the difference between me being able to fulfill the order and not. That's the whole thing." [≈12s, conversational pace, sincere]

### 4:10–4:30 — Closing card (narrator)

> **Narrator:** "ExportEscrow. Built in 48 hours, on Solana, powered by KIRAPAY. Live at the link below. We are starting a pilot with five Lagos importers in the first quarter of 2026." [≈18s]

## 5. Failure Recovery Plan

Things will go wrong. Decisions are pre-made so we don't argue on the day.

- **KIRAPAY testnet is down or slow.** Cut to the pre-recorded payment footage from the night-before run. The voiceover stays the same. Total runtime impact: zero.
- **Solana devnet RPC rate-limits or times out.** Have a backup local validator (`solana-test-validator`) running on one laptop, pre-seeded with a deal in `funded` status. If devnet fails, switch the dashboard's RPC env var and replay from step 5 (exporter upload) using the local validator state.
- **A verifier wallet fails to sign.** Have a fourth verifier wallet pre-loaded in a fourth Chrome profile. Substitute and continue. The voiceover doesn't change — "two of three" still applies whether the third was the original third or the standby.
- **The video runs over 5:00 in the rough cut.** Trim in this order: first, cut the architecture beat (3:10–3:40) entirely and shift the closing forward; second, trim the cold open to 0:15; third, tighten the problem B-roll to 0:25. Never cut the KIRAPAY beat (1:10–1:40) or the side-by-side wallet shot (2:40–3:10) — those carry the score.
- **Adaeze is unavailable on filming day.** A second team member can stand in. Brief them on the two spoken lines, keep the framing identical to the rehearsal, and re-light. Do not call this out in the video.
- **Audio is unusable in post.** Re-record the voiceover as a clean studio pass over the existing visuals. The on-camera Adaeze lines have to stay, but everything else can be redubbed.

## 6. Post-Production Checklist

Final verification before publishing the video.

- [ ] Total runtime is **at or under 5:00**. Confirm by exporting and playing the rendered file end-to-end. The target is 4:30; anything from 4:25 to 4:45 is acceptable.
- [ ] All on-screen text — form fields, wallet balances, transaction hashes, the architecture slide — is legible at 1080p. Test on a phone screen too.
- [ ] Audio levels balanced: voiceover at -6dB peak, on-camera audio normalized to match, no background hum. Apply a noise gate if needed.
- [ ] **No real API keys, wallet seed phrases, or private keys are visible anywhere.** Frame-by-frame review of every screen-capture segment. Blur any incidental sensitive data.
- [ ] Upload to YouTube as **Unlisted** with "embed allowed" enabled. Generate the public watch link.
- [ ] Auto-generated captions are present and reviewed for accuracy on technical terms (KIRAPAY, USDC, USDT, SPL, multisig, attestation). Manually correct any mistakes.
- [ ] Closing-card links resolve: GitHub repo, live demo URL, project write-up. Test each.
- [ ] Video link is added to:
    - `README.md` (Demo block at the top)
    - `docs/PROJECT_WRITEUP.md` (Links section)
    - The hackathon submission form itself
- [ ] Backup the final mp4 to two locations (team Drive + one personal cloud) before submitting.
- [ ] Submission is made at least **two hours before the deadline**. No last-minute uploads.
