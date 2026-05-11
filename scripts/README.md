# Scripts

Operational scripts for ExportEscrow. Run with `npm run <script>` (preferred) or `npx tsx scripts/<name>.ts` directly.

| Script | Command | Purpose |
| --- | --- | --- |
| `verify-multisig.ts` | `npm run verify:multisig` | End-to-end proof that the SPL multisig custody layer works on Solana devnet: create multisig, fund vault, 3-of-4 release. |
| `seed-verifiers.ts` | `npx tsx scripts/seed-verifiers.ts` | Insert the default 2-of-3 verifier set into Supabase. *(stub)* |
| `demo-deal.ts` | `npx tsx scripts/demo-deal.ts` | Walk a deal through the full happy path on Solana devnet. *(stub)* |

## verify-multisig.ts

This is the ground-truth test for the custody layer. It is fully self-contained — creates a fresh test mint, fresh keypairs, and runs the full deposit → attest-quorum → release lifecycle on Solana devnet. If it passes, the custody primitive ships.

```bash
npm run verify:multisig
```

The script reads env vars from `.env.local` if present. The only one that matters for this script is `FEE_PAYER_PRIVATE_KEY`; if unset, the script generates an ephemeral fee payer keypair and airdrops SOL to it. Set `SOLANA_RPC_URL` to override the public devnet RPC if you're hitting rate limits.

Expected runtime: 30–90 seconds on devnet, depending on bridge and RPC latency.

Re-run the script three times in a row before declaring the layer ready; devnet is flaky and a single passing run isn't enough signal.

## Generating a fee-payer keypair

The protocol fee payer is the Solana wallet that pays rent and transaction fees during multisig creation, ATA derivation, and release broadcasts. It is **not** part of the multisig signer set — it has no power over deal funds.

```bash
# Generate a fresh keypair into a JSON file (Solana CLI default format).
solana-keygen new --no-bip39-passphrase -o fee-payer.json

# Get the base58-encoded secret key (this is what FEE_PAYER_PRIVATE_KEY expects).
node -e "console.log(require('bs58').default.encode(Uint8Array.from(JSON.parse(require('fs').readFileSync('fee-payer.json','utf8')))))"

# Paste the output into .env.local as FEE_PAYER_PRIVATE_KEY=...
```

**Do not commit `fee-payer.json` or the base58 string anywhere.** Add `fee-payer.json` to `.gitignore` if you keep it locally; rotate the key if it ever lands in shell history or a chat thread.

For devnet the fee payer just needs ~1 SOL of test-token, airdroppable via `solana airdrop 2 <pubkey> --url devnet`. For mainnet it needs real SOL covering expected per-deal rent (~0.003 SOL per multisig + ATA) plus a buffer.
