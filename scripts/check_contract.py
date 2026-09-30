import importlib.util
import json
import pathlib
import sys
import types


ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "oracle_drift_guard.py"
EXPECTED_DEPENDS = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"


class _Public:
    @staticmethod
    def view(fn):
        fn.__genlayer_visibility__ = "view"
        return fn

    @staticmethod
    def write(fn):
        fn.__genlayer_visibility__ = "write"
        return fn


class _Return:
    def __init__(self, value="{}"):
        self.value = value
        self.calldata = value


class _NondetWeb:
    calls = []

    @staticmethod
    def render(url, mode="text"):
        _NondetWeb.calls.append({"url": url, "mode": mode})
        fixtures = {
            "https://example.com/oracle/primary-eth-usd": "ETH/USD price 3500.00 source primary fresh at 2026-09-30T00:00:00Z",
            "https://example.com/oracle/secondary-eth-usd": "ETH/USD price 3508.00 source secondary fresh at 2026-09-30T00:00:00Z",
            "https://example.com/oracle/fallback-eth-usd": "ETH/USD price 3498.00 source fallback fresh at 2026-09-30T00:00:00Z",
            "https://example.com/incidents/eth-usd-morning": "No public incident reported; normal volatility band.",
        }
        if url not in fixtures:
            raise AssertionError(f"unexpected web.render url: {url}")
        return fixtures[url]


class _Nondet:
    web = _NondetWeb()
    prompts = []

    @staticmethod
    def exec_prompt(prompt):
        _Nondet.prompts.append(prompt)
        return json.dumps(
            {
                "status": "healthy",
                "confidence": 88,
                "max_observed_drift_bps": "29",
                "threshold_breached": False,
                "sources_agree": True,
                "manual_review_required": False,
                "summary": "The three oracle sources are close and inside the configured drift threshold.",
            },
            separators=(",", ":"),
        )


class _VM:
    Return = _Return

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        value = leader_fn()
        if validator_fn(_Return(value)) is not True:
            raise AssertionError("validator rejected leader result")
        return value


class _Contract:
    pass


class _GL:
    Contract = _Contract
    public = _Public()
    vm = _VM()
    nondet = _Nondet()


class _DynArray(list):
    pass


class _TreeMap(dict):
    pass


def _install_genlayer_stub():
    module = types.ModuleType("genlayer")
    module.gl = _GL()
    module.DynArray = _DynArray
    module.TreeMap = _TreeMap
    module.u64 = int
    module.u8 = int
    sys.modules["genlayer"] = module


def _load_contract_module():
    spec = importlib.util.spec_from_file_location("oracle_drift_guard", CONTRACT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _fresh_contract(contract_cls):
    contract = contract_cls()
    contract.market_ids = _DynArray()
    contract.drift_ids = _DynArray()
    contract.markets = _TreeMap()
    contract.drift_reports = _TreeMap()
    return contract


def main():
    source = CONTRACT_PATH.read_text(encoding="utf-8")
    if EXPECTED_DEPENDS not in source.splitlines()[0]:
        raise SystemExit(f"missing pinned runtime dependency: {EXPECTED_DEPENDS}")
    if "return int(gl.block.timestamp)" in source and "except Exception:" not in source:
        raise SystemExit("_now must tolerate runtimes without gl.block.timestamp")

    _install_genlayer_stub()
    module = _load_contract_module()
    contract_cls = module.OracleDriftGuard
    if not issubclass(contract_cls, _Contract):
        raise SystemExit("OracleDriftGuard must inherit gl.Contract")

    contract = _fresh_contract(contract_cls)
    required_methods = {
        "register_market": "write",
        "assess_drift": "write",
        "get_market": "view",
        "get_drift_report": "view",
        "get_market_count": "view",
        "get_latest_market_id": "view",
        "get_latest_drift_id": "view",
        "list_market_ids": "view",
        "list_drift_ids": "view",
    }
    for method_name, visibility in required_methods.items():
        method = getattr(contract, method_name, None)
        if method is None:
            raise SystemExit(f"missing method: {method_name}")
        actual = getattr(getattr(contract_cls, method_name), "__genlayer_visibility__", None)
        if actual != visibility:
            raise SystemExit(f"{method_name} must be public.{visibility}")

    _NondetWeb.calls = []
    _Nondet.prompts = []
    market_id = contract.register_market(
        "ETH/USD",
        "Ether spot price in USD",
        "https://example.com/oracle/primary-eth-usd",
        "https://example.com/oracle/secondary-eth-usd",
        "https://example.com/oracle/fallback-eth-usd",
        "150",
    )
    if not market_id.startswith("market_"):
        raise SystemExit("register_market returned an invalid market id")
    market = json.loads(contract.get_market(market_id))
    if market["id"] != market_id:
        raise SystemExit("get_market did not return the registered market")
    if market["created_at"] != 0:
        raise SystemExit("_now fallback should be deterministic when gl.block is unavailable")
    if len(market["snapshot_commitments"]) != 3:
        raise SystemExit("market baseline must persist three source commitments")
    register_urls = [call["url"] for call in _NondetWeb.calls]
    if register_urls.count("https://example.com/oracle/primary-eth-usd") != 2:
        raise SystemExit("register_market did not render primary source for leader and validator")
    if register_urls.count("https://example.com/oracle/secondary-eth-usd") != 2:
        raise SystemExit("register_market did not render secondary source for leader and validator")
    if register_urls.count("https://example.com/oracle/fallback-eth-usd") != 2:
        raise SystemExit("register_market did not render fallback source for leader and validator")

    drift_id = contract.assess_drift(
        market_id,
        "ETH/USD morning drift check",
        "2026-09-30T00:00:00Z",
        "https://example.com/incidents/eth-usd-morning",
    )
    if not drift_id.startswith("drift_"):
        raise SystemExit("assess_drift returned an invalid drift id")
    report = json.loads(contract.get_drift_report(drift_id))
    if report["id"] != drift_id or report["market_id"] != market_id:
        raise SystemExit("get_drift_report did not return the accepted report")
    if report["threshold_breached"] is not False:
        raise SystemExit("assess_drift normalized verdict incorrectly")
    if len(report["snapshot_commitments"]) != 4:
        raise SystemExit("drift report must persist four source commitments")
    if report["created_at"] != 0:
        raise SystemExit("_now fallback should apply to drift reports")
    if len([prompt for prompt in _Nondet.prompts if "public oracle drift" in prompt]) != 2:
        raise SystemExit("assess_drift did not execute leader and validator LLM adjudication")

    try:
        contract.assess_drift(
            "market_missing",
            "missing market check",
            "2026-09-30T00:00:00Z",
            "https://example.com/incidents/eth-usd-morning",
        )
    except Exception as exc:
        if "unknown_market" not in str(exc):
            raise
    else:
        raise SystemExit("assess_drift must reject unknown markets")

    print("OracleDriftGuard contract write-method E2E check passed")


if __name__ == "__main__":
    main()
