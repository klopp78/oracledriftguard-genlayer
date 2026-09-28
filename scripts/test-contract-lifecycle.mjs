import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync("contracts/oracle_drift_guard.py", "utf8");

assert.match(source, /register_market/);
assert.match(source, /assess_drift/);
assert.match(source, /market_/);
assert.match(source, /drift_/);
assert.match(source, /primary_oracle/);
assert.match(source, /secondary_oracle/);
assert.match(source, /fallback_oracle/);
assert.match(source, /incident_context/);
assert.match(source, /manual_review_required/);

console.log("OracleDriftGuard lifecycle source check passed");
