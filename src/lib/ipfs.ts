import { PinataSDK } from 'pinata-web3';
import { env } from './env';

export interface PinResult {
  cid: string;
  filename: string;
  size: number;
}

let cached: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!env.PINATA_JWT) {
    throw new Error('Pinata not configured (PINATA_JWT)');
  }
  if (!cached) {
    cached = new PinataSDK({
      pinataJwt: env.PINATA_JWT,
      pinataGateway: env.PINATA_GATEWAY || undefined,
    });
  }
  return cached;
}

// TODO(ipfs): wire up the actual upload — see pinata-web3 docs for the file
// upload API. Should pin to IPFS and return the CID + size, and we likely want
// to attach a metadata.name = deal id for traceability.
export async function uploadDocument(_file: File): Promise<PinResult> {
  void getPinata();
  throw new Error('Not implemented');
}

export function gatewayUrl(cid: string): string {
  const gateway = env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  const base = gateway.startsWith('http') ? gateway : `https://${gateway}`;
  return `${base.replace(/\/$/, '')}/ipfs/${cid}`;
}
