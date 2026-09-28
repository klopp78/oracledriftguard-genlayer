import assert from "node:assert/strict";

const walletAddress = "0xE22D4Dc6865BD451411479D3A146EAFBd87D156B";
const marketId = "market_7cf7a5d6b3de4fb64544";
const driftId = "drift_96f9b78990ad7d7c5a66";

class StudioFlowSimulator {
  constructor() {
    this.calls = [];
    this.markets = new Map();
    this.reports = new Map();
  }

  async writeContract({ functionName, args }) {
    this.calls.push({ kind: "write", functionName, args });
    if (functionName === "register_market") {
      const [symbol, asset, primary, secondary, fallback, threshold] = args;
      assert.equal(symbol, "ETH/USD");
      assert.match(asset, /Ether/);
      assert.match(primary, /^https:\/\//);
      assert.match(secondary, /^https:\/\//);
      assert.match(fallback, /^https:\/\//);
      assert.equal(threshold, "150");
      this.markets.set(marketId, {
        id: marketId,
        market_symbol: symbol,
        reference_asset: asset,
        max_drift_bps: threshold,
      });
      return "0xmarketregistration";
    }
    if (functionName === "assess_drift") {
      const [incomingMarketId, label, observedAt, incidentUrl] = args;
      assert.equal(incomingMarketId, marketId);
      assert.match(label, /drift check/);
      assert.match(observedAt, /2026/);
      assert.match(incidentUrl, /^https:\/\//);
      assert.ok(this.markets.has(marketId));
      this.reports.set(driftId, {
        id: driftId,
        market_id: marketId,
        status: "inconclusive",
        evidence_bundle_hash: "a".repeat(64),
      });
      return "0xdriftassessment";
    }
    throw new Error(`Unexpected write ${functionName}`);
  }

  async waitForTransactionReceipt({ hash }) {
    this.calls.push({ kind: "receipt", hash });
    if (hash === "0xmarketregistration") return { txExecutionResult: marketId };
    if (hash === "0xdriftassessment") return { txExecutionResult: driftId };
    throw new Error(`Unknown transaction ${hash}`);
  }

  async readContract({ functionName, args }) {
    this.calls.push({ kind: "read", functionName, args });
    if (functionName === "get_market") return JSON.stringify(this.markets.get(args[0]) ?? {});
    if (functionName === "get_drift_report") return JSON.stringify(this.reports.get(args[0]) ?? {});
    throw new Error(`Unexpected read ${functionName}`);
  }
}

function receiptString(receipt, pattern, label) {
  const value = Object.values(receipt).find(
    (candidate) => typeof candidate === "string" && pattern.test(candidate),
  );
  assert.ok(value, `Accepted ${label} receipt must contain its returned identifier`);
  return value;
}

async function runFullFlow(client) {
  const marketHash = await client.writeContract({
    functionName: "register_market",
    args: [
      "ETH/USD",
      "Ether spot price in USD",
      "https://www.coingecko.com/en/coins/ethereum",
      "https://coinmarketcap.com/currencies/ethereum/",
      "https://www.binance.com/en/price/ethereum",
      "150",
    ],
  });
  const marketReceipt = await client.waitForTransactionReceipt({ hash: marketHash });
  const returnedMarketId = receiptString(marketReceipt, /^market_[a-f0-9]{20}$/, "market");
  const market = JSON.parse(await client.readContract({ functionName: "get_market", args: [returnedMarketId] }));
  assert.equal(market.id, returnedMarketId);

  const driftHash = await client.writeContract({
    functionName: "assess_drift",
    args: [
      returnedMarketId,
      "ETH/USD morning drift check",
      "2026-09-29T00:00:00Z",
      "https://ethereum.org/en/",
    ],
  });
  const driftReceipt = await client.waitForTransactionReceipt({ hash: driftHash });
  const returnedDriftId = receiptString(driftReceipt, /^drift_[a-f0-9]{20}$/, "drift");
  const report = JSON.parse(await client.readContract({ functionName: "get_drift_report", args: [returnedDriftId] }));
  assert.equal(report.id, returnedDriftId);
  assert.equal(report.market_id, returnedMarketId);
  return { returnedMarketId, returnedDriftId };
}

const simulator = new StudioFlowSimulator();
const outcome = await runFullFlow(simulator);
assert.deepEqual(
  simulator.calls.map((call) => `${call.kind}:${call.functionName ?? call.hash}`),
  [
    "write:register_market",
    "receipt:0xmarketregistration",
    "read:get_market",
    "write:assess_drift",
    "receipt:0xdriftassessment",
    "read:get_drift_report",
  ],
);
assert.equal(outcome.returnedMarketId, marketId);
assert.equal(outcome.returnedDriftId, driftId);
console.log("OracleDriftGuard simulated full-flow check passed");
