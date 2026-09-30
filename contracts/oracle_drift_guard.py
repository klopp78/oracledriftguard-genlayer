# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import hashlib
import json
import typing


class OracleDriftGuard(gl.Contract):
    """Consensus registry for detecting drift across public oracle sources."""

    market_count: u64
    latest_market_id: str
    latest_drift_id: str
    market_ids: DynArray[str]
    drift_ids: DynArray[str]
    markets: TreeMap[str, str]
    drift_reports: TreeMap[str, str]

    def __init__(self):
        self.market_count = u64(0)
        self.latest_market_id = ""
        self.latest_drift_id = ""

    @gl.public.view
    def get_market_count(self) -> u64:
        return self.market_count

    @gl.public.view
    def get_latest_market_id(self) -> str:
        return self.latest_market_id

    @gl.public.view
    def get_latest_drift_id(self) -> str:
        return self.latest_drift_id

    @gl.public.view
    def get_market(self, market_id: str) -> str:
        return self.markets.get(market_id, "")

    @gl.public.view
    def get_drift_report(self, drift_id: str) -> str:
        return self.drift_reports.get(drift_id, "")

    @gl.public.view
    def list_market_ids(self) -> str:
        return json.dumps([market_id for market_id in self.market_ids], separators=(",", ":"))

    @gl.public.view
    def list_drift_ids(self) -> str:
        return json.dumps([drift_id for drift_id in self.drift_ids], separators=(",", ":"))

    @gl.public.write
    def register_market(
        self,
        market_symbol: str,
        reference_asset: str,
        primary_source_url: str,
        secondary_source_url: str,
        fallback_source_url: str,
        max_drift_bps: str,
    ) -> str:
        symbol = _clean_symbol(market_symbol)
        asset = _clean_text(reference_asset, 80, "reference_asset_required")
        threshold = _clean_bps(max_drift_bps)
        sources = [
            _source("primary_oracle", primary_source_url),
            _source("secondary_oracle", secondary_source_url),
            _source("fallback_oracle", fallback_source_url),
        ]

        def leader_fn():
            snapshots = _render_sources(sources)
            return json.dumps(_baseline(symbol, asset, threshold, snapshots), separators=(",", ":"))

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader = json.loads(leader_result.value)
                local = _baseline(symbol, asset, threshold, _render_sources(sources))
                return _baseline_equal(leader, local)
            except Exception:
                return False

        baseline = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        market_id = _market_id(symbol, asset, baseline["baseline_hash"])
        if len(self.markets.get(market_id, "")) > 0:
            raise Exception("market_already_registered")

        record = {
            "id": market_id,
            "market_symbol": symbol,
            "reference_asset": asset,
            "max_drift_bps": threshold,
            "source_urls": [item["canonical_url"] for item in sources],
            "baseline_hash": baseline["baseline_hash"],
            "snapshot_commitments": baseline["snapshot_commitments"],
            "created_at": _now(),
        }
        self.markets[market_id] = json.dumps(record, separators=(",", ":"))
        self.market_ids.append(market_id)
        self.latest_market_id = market_id
        self.market_count = u64(int(self.market_count) + 1)
        return market_id

    @gl.public.write
    def assess_drift(
        self,
        market_id: str,
        observation_label: str,
        observed_at: str,
        incident_url: str,
    ) -> str:
        normalized_market_id = _clean_id(market_id, "market_id_required")
        market_json = self.markets.get(normalized_market_id, "")
        if len(market_json) == 0:
            raise Exception("unknown_market")
        market = json.loads(market_json)
        label = _clean_text(observation_label, 120, "observation_label_required")
        timestamp = _clean_text(observed_at, 80, "observed_at_required")
        incident = _canonical_url(incident_url, "incident_url_required")
        sources = [
            _source("primary_oracle", market["source_urls"][0]),
            _source("secondary_oracle", market["source_urls"][1]),
            _source("fallback_oracle", market["source_urls"][2]),
            _source("incident_context", incident),
        ]

        def leader_fn():
            snapshots = _render_sources(sources)
            verdict = _judge_drift(market, label, timestamp, snapshots)
            return json.dumps(verdict, separators=(",", ":"))

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                leader = json.loads(leader_result.value)
                local = _judge_drift(market, label, timestamp, _render_sources(sources))
                return _verdict_equal(leader, local)
            except Exception:
                return False

        verdict = json.loads(gl.vm.run_nondet_unsafe(leader_fn, validator_fn))
        drift_id = _drift_id(normalized_market_id, label, verdict["evidence_bundle_hash"])
        if len(self.drift_reports.get(drift_id, "")) > 0:
            raise Exception("drift_report_already_exists")

        record = {
            "id": drift_id,
            "market_id": normalized_market_id,
            "market_symbol": market["market_symbol"],
            "observation_label": label,
            "observed_at": timestamp,
            "incident_url": incident,
            "status": verdict["status"],
            "confidence": verdict["confidence"],
            "max_observed_drift_bps": verdict["max_observed_drift_bps"],
            "threshold_breached": verdict["threshold_breached"],
            "sources_agree": verdict["sources_agree"],
            "manual_review_required": verdict["manual_review_required"],
            "evidence_bundle_hash": verdict["evidence_bundle_hash"],
            "assessment_context_hash": verdict["assessment_context_hash"],
            "snapshot_commitments": json.loads(verdict["snapshot_commitments_json"]),
            "summary": verdict["summary"],
            "created_at": _now(),
        }
        self.drift_reports[drift_id] = json.dumps(record, separators=(",", ":"))
        self.drift_ids.append(drift_id)
        self.latest_drift_id = drift_id
        return drift_id


def _baseline(symbol: str, asset: str, threshold: str, snapshots: typing.Sequence[dict]) -> dict:
    commitments = _commitments(snapshots)
    payload = {
        "market_symbol": symbol,
        "reference_asset": asset,
        "max_drift_bps": threshold,
        "snapshot_commitments": commitments,
    }
    return {"baseline_hash": _sha256(_canonical_json(payload)), "snapshot_commitments": commitments}


def _judge_drift(market: dict, label: str, observed_at: str, snapshots: typing.Sequence[dict]) -> dict:
    commitments = _commitments(snapshots)
    context = {
        "market_id": market["id"],
        "market_symbol": market["market_symbol"],
        "reference_asset": market["reference_asset"],
        "max_drift_bps": market["max_drift_bps"],
        "observation_label": label,
        "observed_at": observed_at,
        "snapshot_commitments": commitments,
    }
    prompt = f"""
You are a GenLayer validator reviewing public oracle drift.

Read the rendered source snapshots. Extract the visible price, rate, index,
or status signal for the requested market when possible. Compare the sources
and decide whether the market is healthy, drifting, stale, or inconclusive.

Return only minified JSON with keys: status, confidence,
max_observed_drift_bps, threshold_breached, sources_agree,
manual_review_required, summary.
status must be healthy, drift, stale, or inconclusive.

Market context:
{_canonical_json(context)}

Rendered source snapshots:
{_canonical_json(snapshots)}
"""
    data = json.loads(gl.nondet.exec_prompt(prompt))
    normalized = {
        "status": _bounded_choice(str(data["status"]).lower(), ["healthy", "drift", "stale", "inconclusive"]),
        "confidence": int(_bounded_u8(data["confidence"])),
        "max_observed_drift_bps": _clean_bps(str(data["max_observed_drift_bps"])),
        "threshold_breached": bool(data["threshold_breached"]),
        "sources_agree": bool(data["sources_agree"]),
        "manual_review_required": bool(data["manual_review_required"]),
        "summary": _clean_text(str(data["summary"]), 260, "summary_required"),
    }
    readable_count = sum(1 for item in snapshots if len(item.get("snapshot_hash", "")) == 64)
    if readable_count < 3:
        normalized["status"] = "inconclusive"
        normalized["manual_review_required"] = True
        normalized["confidence"] = min(int(normalized["confidence"]), 50)
    threshold = int(market["max_drift_bps"])
    observed = int(normalized["max_observed_drift_bps"])
    if observed > threshold:
        normalized["threshold_breached"] = True
        if normalized["status"] == "healthy":
            normalized["status"] = "drift"
    if normalized["status"] in ["drift", "stale"] and not normalized["manual_review_required"]:
        normalized["manual_review_required"] = True

    bundle = {"context": context, "normalized": normalized}
    normalized["evidence_bundle_hash"] = _sha256(_canonical_json(bundle))
    normalized["assessment_context_hash"] = _sha256(_canonical_json(context))
    normalized["snapshot_commitments_json"] = json.dumps(commitments, separators=(",", ":"))
    return normalized


def _render_sources(sources: typing.Sequence[dict]) -> typing.Sequence[dict]:
    snapshots = []
    for source in sources:
        try:
            rendered_text = gl.nondet.web.render(source["canonical_url"], mode="text")[:6000]
            fetch_error = ""
        except Exception as error:
            rendered_text = ""
            fetch_error = str(error)[:240]
        snapshots.append(
            {
                "role": source["role"],
                "canonical_url": source["canonical_url"],
                "snapshot_hash": _sha256(rendered_text) if len(rendered_text) > 0 else "",
                "snapshot_excerpt": rendered_text[:700],
                "fetch_error": fetch_error,
            }
        )
    return snapshots


def _commitments(snapshots: typing.Sequence[dict]) -> typing.Sequence[dict]:
    return [
        {
            "role": item["role"],
            "canonical_url": item["canonical_url"],
            "snapshot_hash": item.get("snapshot_hash", ""),
            "fetch_error_hash": _sha256(item.get("fetch_error", "")) if item.get("fetch_error", "") else "",
        }
        for item in snapshots
    ]


def _baseline_equal(a: dict, b: dict) -> bool:
    return a["baseline_hash"] == b["baseline_hash"] and _canonical_json(a["snapshot_commitments"]) == _canonical_json(b["snapshot_commitments"])


def _verdict_equal(a: dict, b: dict) -> bool:
    keys = [
        "status",
        "confidence",
        "max_observed_drift_bps",
        "threshold_breached",
        "sources_agree",
        "manual_review_required",
        "evidence_bundle_hash",
        "assessment_context_hash",
        "snapshot_commitments_json",
    ]
    return all(a[key] == b[key] for key in keys)


def _source(role: str, url: str) -> dict:
    return {"role": role, "canonical_url": _canonical_url(url, f"{role}_url_required")}


def _market_id(symbol: str, asset: str, baseline_hash: str) -> str:
    return "market_" + _sha256(symbol + "|" + asset + "|" + baseline_hash)[:20]


def _drift_id(market_id: str, label: str, bundle_hash: str) -> str:
    return "drift_" + _sha256(market_id + "|" + label + "|" + bundle_hash)[:20]


def _clean_symbol(value: str) -> str:
    clean = str(value).strip().upper()
    allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/."
    if len(clean) < 3 or len(clean) > 24 or any(char not in allowed for char in clean):
        raise Exception("invalid_market_symbol")
    return clean


def _canonical_url(value: str, error: str) -> str:
    clean = str(value).strip()
    if not (clean.startswith("https://") and len(clean) <= 280):
        raise Exception(error)
    return clean


def _clean_id(value: str, error: str) -> str:
    clean = str(value).strip()
    if len(clean) < 8 or len(clean) > 80:
        raise Exception(error)
    return clean


def _clean_text(value: str, max_length: int, error: str) -> str:
    clean = " ".join(str(value).strip().split())
    if len(clean) == 0 or len(clean) > max_length:
        raise Exception(error)
    return clean


def _clean_bps(value: str) -> str:
    clean = str(value).strip()
    if len(clean) == 0 or len(clean) > 8:
        raise Exception("invalid_basis_points")
    integer = int(clean)
    if integer < 0 or integer > 100000:
        raise Exception("invalid_basis_points")
    return str(integer)


def _bounded_choice(value: str, choices: typing.Sequence[str]) -> str:
    if value not in choices:
        return "inconclusive"
    return value


def _bounded_u8(value) -> u8:
    integer = int(value)
    if integer < 0:
        integer = 0
    if integer > 100:
        integer = 100
    return u8(integer)


def _canonical_json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _now() -> int:
    try:
        return int(gl.block.timestamp)
    except Exception:
        return 0
