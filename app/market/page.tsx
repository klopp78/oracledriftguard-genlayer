"use client";

import { useState } from "react";
import {
  ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS,
  compactError,
  registerMarket,
  type WalletAddress,
} from "@/lib/genlayer";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export default function MarketPage() {
  const [marketSymbol, setMarketSymbol] = useState("ETH/USD");
  const [referenceAsset, setReferenceAsset] = useState("Ether spot price in USD");
  const [primarySourceUrl, setPrimarySourceUrl] = useState("https://www.coingecko.com/en/coins/ethereum");
  const [secondarySourceUrl, setSecondarySourceUrl] = useState("https://coinmarketcap.com/currencies/ethereum/");
  const [fallbackSourceUrl, setFallbackSourceUrl] = useState("https://www.binance.com/en/price/ethereum");
  const [maxDriftBps, setMaxDriftBps] = useState("150");
  const [address, setAddress] = useState(ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [message, setMessage] = useState("Connect a wallet and register the market baseline.");
  const [record, setRecord] = useState("");
  const [busy, setBusy] = useState(false);

  async function connectWallet() {
    if (!window.ethereum) throw new Error("No browser wallet detected.");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as WalletAddress[];
    if (!accounts[0]) throw new Error("No wallet account returned.");
    setWallet(accounts[0]);
    return accounts[0];
  }

  async function submit() {
    try {
      setBusy(true);
      setRecord("");
      setMessage("Waiting for GenLayer consensus on the market baseline...");
      const account = wallet ?? await connectWallet();
      const result = await registerMarket({
        walletAddress: account,
        marketSymbol,
        referenceAsset,
        primarySourceUrl,
        secondarySourceUrl,
        fallbackSourceUrl,
        maxDriftBps,
        contractAddress: address as `0x${string}`,
      });
      setRecord(JSON.stringify({ marketId: result.marketId, market: result.market, readbackWarning: result.readbackWarning }, null, 2));
      setMessage(`Market baseline accepted: ${result.marketId}`);
    } catch (error) {
      setMessage(compactError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#15171a]">
      <a className="pill" href="/">OracleDriftGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Register market baseline</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#60707b]">
        Store the symbol, drift threshold, and validator evidence sources before
        any drift assessment is created.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="symbol" label="Market symbol" value={marketSymbol} setValue={setMarketSymbol} />
        <Field id="asset" label="Reference asset" value={referenceAsset} setValue={setReferenceAsset} />
        <Field id="primary" label="Primary source URL" value={primarySourceUrl} setValue={setPrimarySourceUrl} />
        <Field id="secondary" label="Secondary source URL" value={secondarySourceUrl} setValue={setSecondarySourceUrl} />
        <Field id="fallback" label="Fallback source URL" value={fallbackSourceUrl} setValue={setFallbackSourceUrl} />
        <Field id="threshold" label="Max drift bps" value={maxDriftBps} setValue={setMaxDriftBps} />
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button" onClick={() => connectWallet().then(() => setMessage("Wallet connected.")).catch((error) => setMessage(compactError(error)))}>
            Connect wallet
          </button>
          <button className="action-button primary" disabled={busy} onClick={submit}>
            {busy ? "Awaiting consensus" : "Register market"}
          </button>
        </div>
        <p className="text-sm text-[#60707b]">{message}</p>
      </section>
      {record ? <pre className="result-card mt-6 overflow-x-auto text-sm">{record}</pre> : null}
    </main>
  );
}

function Field({ id, label, value, setValue }: { id: string; label: string; value: string; setValue: (value: string) => void }) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input className="text-input" id={id} value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
}
