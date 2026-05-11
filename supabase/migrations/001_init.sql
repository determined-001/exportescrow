-- ExportEscrow initial schema
-- Off-chain deal state. On-chain custody lives in an SPL multisig vault per deal.

create extension if not exists "uuid-ossp";

create table if not exists verifier_sets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  threshold int not null check (threshold > 0),
  created_at timestamptz not null default now()
);

create table if not exists verifiers (
  id uuid primary key default uuid_generate_v4(),
  verifier_set_id uuid not null references verifier_sets(id) on delete cascade,
  pubkey text not null,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (verifier_set_id, pubkey)
);

create table if not exists deals (
  id uuid primary key default uuid_generate_v4(),
  importer_pubkey text not null,
  exporter_payout_chain text not null,
  exporter_payout_token text not null,
  exporter_payout_address text not null,
  amount_usdc bigint not null check (amount_usdc > 0),
  deadline timestamptz not null,
  status text not null default 'created'
    check (status in ('created','funded','docs_submitted','attested','released','disputed','refunded')),
  multisig_address text unique,
  vault_ata text unique,
  verifier_set_id uuid references verifier_sets(id),
  kirapay_payment_link_id text,
  document_cid text,
  document_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_status_idx on deals (status);
create index if not exists deals_verifier_set_idx on deals (verifier_set_id);

create table if not exists attestations (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references deals(id) on delete cascade,
  verifier_pubkey text not null,
  approved boolean not null,
  reason text,
  signature text,
  created_at timestamptz not null default now(),
  unique (deal_id, verifier_pubkey)
);

create index if not exists attestations_deal_idx on attestations (deal_id);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references deals(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_deal_idx on events (deal_id);
create index if not exists events_type_idx on events (event_type);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists deals_set_updated_at on deals;
create trigger deals_set_updated_at
before update on deals
for each row execute function set_updated_at();
