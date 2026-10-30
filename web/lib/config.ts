import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadScan", url: "https://testnet.monadscan.com" } },
});

export const EXPLORER = "https://testnet.monadscan.com";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;

// Economics (must match Seed.s.sol / contract defaults)
export const RATE_MON = 0.001; // sponsor pays per verified view
export const USER_SHARE = 0.7; // 30% platform fee
export const USER_PER_VIEW_MON = RATE_MON * USER_SHARE; // 0.0007

// Anti-spam rules
const fast = () => process.env.DEMO_FAST === "1";
export const MIN_GENERATION_MS = 3000;
export const MIN_VISIBLE_MS = 5000;
export const rateLimitMs = () => (fast() ? 500 : 20_000);
export const dailyCap = () => (fast() ? 6 : 50);
export const MAX_ADDRESSES_PER_INSTALL = 2;

export const SITES = ["chatgpt", "claude", "gemini"] as const;

export const rpcUrl = () => process.env.RPC_URL || "https://testnet-rpc.monad.xyz";
export const contractAddress = () => (process.env.CONTRACT_ADDRESS || "") as `0x${string}`;
