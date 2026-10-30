import "../lib/env";
import { createWalletClient, http, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "../lib/db";
import { ADS } from "../lib/ads";
import { abi, publicClient, readCampaign } from "../lib/chain";
import { contractAddress, monadTestnet, rpcUrl, txUrl } from "../lib/config";

const INTERVAL = Number(process.env.SETTLE_INTERVAL_MS || 30_000);
const MAX_USERS_PER_BATCH = 40;

const log = (...a: unknown[]) => console.log(`[settler ${new Date().toISOString().slice(11, 19)}]`, ...a);

function setup() {
  const pk = process.env.PRIVATE_KEY;
  const addr = contractAddress();
  if (!pk || !addr) {
    log("PRIVATE_KEY and/or CONTRACT_ADDRESS not set in web/.env.local — idle (views stay pending).");
    return null;
  }
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(rpcUrl()) });
  return { account, wallet, addr };
}

async function settleCampaign(ctx: NonNullable<ReturnType<typeof setup>>, campaignId: number) {
  const d = db();
  const rows = d
    .prepare("SELECT id, address FROM views WHERE campaign_id=? AND status='pending' ORDER BY created_at, id")
    .all(campaignId) as { id: string; address: string }[];
  if (!rows.length) return;

  // chunk by user count so a single tx stays small
  const byUser = new Map<string, string[]>();
  for (const r of rows) (byUser.get(r.address) ?? byUser.set(r.address, []).get(r.address)!).push(r.id);
  const users = [...byUser.keys()].sort();
  const pc = publicClient();

  for (let i = 0; i < users.length; i += MAX_USERS_PER_BATCH) {
    const chunk = users.slice(i, i + MAX_USERS_PER_BATCH);
    const ids = chunk.flatMap((u) => byUser.get(u)!).sort();
    const counts = chunk.map((u) => byUser.get(u)!.length);
    const batchId = keccak256(toBytes(`${campaignId}:${ids.join(",")}`));

    const c = await readCampaign(campaignId);
    if (!c || !c.active) return log(`campaign ${campaignId} missing/inactive on-chain — skipping`);
    const cost = BigInt(ids.length) * c.ratePerView;
    if (cost > c.remaining) return log(`campaign ${campaignId} out of budget (need ${cost}, have ${c.remaining}) — views stay pending`);

    try {
      const args = [BigInt(campaignId), chunk as `0x${string}`[], counts, batchId] as const;
      // Monad charges gas_limit, not gas used: estimate, then add a small buffer.
      const est = await pc.estimateContractGas({ address: ctx.addr, abi, functionName: "payoutBatch", args, account: ctx.account });
      const hash = await ctx.wallet.writeContract({
        address: ctx.addr, abi, functionName: "payoutBatch", args, gas: (est * 12n) / 10n,
      });
      const receipt = await pc.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`tx reverted: ${hash}`);

      const mark = d.transaction(() => {
        const upd = d.prepare("UPDATE views SET status='paid', batch_id=? WHERE id=? AND status='pending'");
        for (const id of ids) upd.run(batchId, id);
        d.prepare("INSERT OR REPLACE INTO batches (batch_id,campaign_id,tx_hash,total_views,created_at) VALUES (?,?,?,?,?)").run(
          batchId, campaignId, hash, ids.length, Date.now(),
        );
      });
      mark();
      log(`campaign ${campaignId}: paid ${ids.length} views to ${chunk.length} users → ${txUrl(hash)}`);
    } catch (e) {
      log(`campaign ${campaignId} batch failed, views stay pending:`, (e as Error).message.split("\n")[0]);
    }
  }
}

async function tick(ctx: ReturnType<typeof setup>) {
  if (!ctx) return;
  for (const a of ADS) {
    try {
      await settleCampaign(ctx, a.campaignId);
    } catch (e) {
      log(`campaign ${a.campaignId} error:`, (e as Error).message.split("\n")[0]);
    }
  }
}

async function main() {
  const ctx = setup();
  log(`started, interval ${INTERVAL / 1000}s`);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await tick(ctx); } finally { running = false; }
  };
  await run();
  setInterval(run, INTERVAL);
}

main();
