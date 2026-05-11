export interface ChainInfo {
  id: string;
  name: string;
  usdc?: string;
  usdt?: string;
}

// Mainnet token addresses. Devnet/testnet equivalents live in env.NEXT_PUBLIC_USDC_MINT.
// TODO(chains): swap to a per-network registry once we support testnet payouts.
export const CHAINS: Record<string, ChainInfo> = {
  solana: {
    id: 'solana',
    name: 'Solana',
    usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  },
  base: {
    id: 'base',
    name: 'Base',
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  },
};

export function getChain(id: string): ChainInfo | undefined {
  return CHAINS[id];
}

export function listChains(): ChainInfo[] {
  return Object.values(CHAINS);
}
