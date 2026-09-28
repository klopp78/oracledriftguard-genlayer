import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const contractPath = resolve("contracts/oracle_drift_guard.py");
const source = readFileSync(contractPath, "utf8");
const firstLine = source.split(/\r?\n/, 1)[0];
const expectedRuntime =
  "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

assert(firstLine.includes(expectedRuntime), `missing pinned runtime dependency: ${expectedRuntime}`);
assert(/class\s+OracleDriftGuard\s*\(\s*gl\.Contract\s*\)\s*:/.test(source), "OracleDriftGuard must inherit gl.Contract");
assert(!/class\s+OracleDriftGuard\s*\(\s*Contract\s*\)\s*:/.test(source), "undefined Contract base remains");
assert(!/gl\.get_webpage|gl\.exec_prompt|gl\.json_loads|gl\.json_dumps|gl\.msg/.test(source), "unsupported legacy gl APIs remain");

for (const method of [
  "register_market",
  "assess_drift",
  "get_market_count",
  "get_latest_market_id",
  "get_latest_drift_id",
  "get_market",
  "get_drift_report",
  "list_market_ids",
  "list_drift_ids",
]) {
  assert(new RegExp(`def\\s+${method}\\s*\\(`).test(source), `missing method: ${method}`);
}

for (const method of ["register_market", "assess_drift"]) {
  assert(new RegExp(`@gl\\.public\\.write\\s+def\\s+${method}\\s*\\(`, "s").test(source), `${method} must be decorated with @gl.public.write`);
}

for (const method of ["get_market", "get_drift_report", "list_market_ids", "list_drift_ids"]) {
  assert(new RegExp(`@gl\\.public\\.view\\s+def\\s+${method}\\s*\\(`, "s").test(source), `${method} must be decorated with @gl.public.view`);
}

assert(/gl\.vm\.run_nondet_unsafe/.test(source), "missing GenLayer nondeterministic consensus gate");
assert(/gl\.nondet\.web\.render/.test(source), "missing GenLayer web render call");
assert(/gl\.nondet\.exec_prompt/.test(source), "missing GenLayer prompt call");
assert(/snapshot_commitments/.test(source), "contract must persist snapshot commitments");
assert(/evidence_bundle_hash/.test(source), "contract must persist evidence bundle hash");
assert(/threshold_breached/.test(source), "contract must bind drift threshold decision");

const marketId = `market_${sha256("ETH/USD|Ether spot price in USD|baseline").slice(0, 20)}`;
const driftId = `drift_${sha256(`${marketId}|ETH/USD morning drift check|bundle`).slice(0, 20)}`;
assert(/^market_[a-f0-9]{20}$/.test(marketId), "market id format check failed");
assert(/^drift_[a-f0-9]{20}$/.test(driftId), "drift id format check failed");

console.log("OracleDriftGuard contract check passed");
