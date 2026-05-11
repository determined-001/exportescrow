# Scripts

Operational scripts for ExportEscrow. Run with `tsx` (install separately if you need it):

```
npx tsx scripts/seed-verifiers.ts
npx tsx scripts/demo-deal.ts
```

| Script | Purpose |
| --- | --- |
| `seed-verifiers.ts` | Insert the default 2-of-3 verifier set into Supabase. |
| `demo-deal.ts` | Walk a deal through the full happy path on Solana devnet. |

Both are currently stubs — see TODO markers inside each file.
