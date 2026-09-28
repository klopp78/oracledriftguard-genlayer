# OracleDriftGuard for GenLayer

OracleDriftGuard is a GenLayer Project for monitoring drift across public oracle
and data sources. It lets a team register a market baseline, ask validators to
read multiple independent sources, and store an operational drift receipt when
signals diverge, become stale, or need manual review.

## Live Demo

- App: https://oracledriftguard-genlayer.galaxthoo.chatgpt.site
- GitHub repo: https://github.com/klopp78/oracledriftguard-genlayer
- Contract source: `contracts/oracle_drift_guard.py`
- Studio contract: pending deployment

The app defaults to the deployed contract address and can be overridden with
`NEXT_PUBLIC_ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS`.

## Product Flow

1. Register a market baseline with a symbol, reference asset, max drift in basis
   points, and three public source URLs.
2. Submit a drift assessment for a `market_*` ID with an observation label,
   timestamp, and incident or context URL.
3. GenLayer validators render all registered sources and the incident context.
4. The contract stores a `drift_*` report with status, confidence, drift bps,
   review flags, snapshot commitments, and evidence bundle hashes.
5. The records page reads `market_*` and `drift_*` records directly from the
   deployed contract.

## Why This Fits GenLayer

Oracle drift is not a simple deterministic check. Public sources can be stale,
rate-limited, reformatted, incomplete, or temporarily inconsistent. A useful
answer requires live web reads, interpretation of public evidence, and an
auditable consensus receipt.

GenLayer is used for:

- nondeterministic web rendering of public data sources
- consensus over whether sources agree, drift, or look stale
- persistent `market_*` and `drift_*` records
- compact snapshot commitments instead of storing full rendered pages

## Contract

```text
contracts/oracle_drift_guard.py
```

Runtime pin:

```python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
```

Main write methods:

```python
register_market(
    market_symbol,
    reference_asset,
    primary_source_url,
    secondary_source_url,
    fallback_source_url,
    max_drift_bps,
) -> str

assess_drift(
    market_id,
    observation_label,
    observed_at,
    incident_url,
) -> str
```

Main read methods:

```python
get_market_count()
get_latest_market_id()
get_latest_drift_id()
get_market(market_id)
get_drift_report(drift_id)
list_market_ids()
list_drift_ids()
```

## Example Inputs

```text
Market: ETH/USD
Reference asset: Ether spot price in USD
Primary: https://www.coingecko.com/en/coins/ethereum
Secondary: https://coinmarketcap.com/currencies/ethereum/
Fallback: https://www.binance.com/en/price/ethereum
Max drift: 150 bps
Incident context: https://ethereum.org/en/
```

## Run Locally

```bash
npm install
npm run contract:check
npm run contract:test
npm run flow:check
npm run build
```

`npm run flow:check` simulates the full app-level sequence: market
registration, accepted receipt parsing, exact market readback, drift
assessment, accepted receipt parsing, and exact report readback.
