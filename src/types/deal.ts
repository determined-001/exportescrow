export type DealStatus =
  | 'created'
  | 'funded'
  | 'docs_submitted'
  | 'attested'
  | 'released'
  | 'disputed'
  | 'refunded';

export interface Deal {
  id: string;
  importer_pubkey: string;
  exporter_payout_chain: string;
  exporter_payout_token: string;
  exporter_payout_address: string;
  amount_usdc: number;
  deadline: string;
  status: DealStatus;
  multisig_address: string | null;
  vault_ata: string | null;
  verifier_set_id: string | null;
  kirapay_payment_link_id: string | null;
  document_cid: string | null;
  document_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attestation {
  id: string;
  deal_id: string;
  verifier_pubkey: string;
  approved: boolean;
  reason: string | null;
  signature: string | null;
  created_at: string;
}

export interface Verifier {
  id: string;
  verifier_set_id: string;
  pubkey: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface VerifierSet {
  id: string;
  name: string;
  threshold: number;
  created_at: string;
}

export interface DealEvent {
  id: string;
  deal_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
