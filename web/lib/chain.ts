import { createPublicClient, http, parseAbi } from "viem";
import { contractAddress, monadTestnet, rpcUrl } from "./config";

export const abi = parseAbi([
  "function getCampaign(uint256 id) view returns ((address sponsor,string name,string category,uint256 ratePerView,uint256 remaining,uint256 totalViews,uint256 totalPaid,bool active))",
  "function payoutBatch(uint256 campaignId, address[] users, uint32[] viewCounts, bytes32 batchId)",
  "function attestor() view returns (address)",
]);

export function publicClient() {
  return createPublicClient({ chain: monadTestnet, transport: http(rpcUrl()) });
}

export type ChainCampaign = { remaining: bigint; totalViews: bigint; totalPaid: bigint; active: boolean; ratePerView: bigint };

export async function readCampaign(id: number): Promise<ChainCampaign | null> {
  const addr = contractAddress();
  if (!addr) return null;
  try {
    const c = await publicClient().readContract({ address: addr, abi, functionName: "getCampaign", args: [BigInt(id)] });
    return { remaining: c.remaining, totalViews: c.totalViews, totalPaid: c.totalPaid, active: c.active, ratePerView: c.ratePerView };
  } catch {
    return null;
  }
}
