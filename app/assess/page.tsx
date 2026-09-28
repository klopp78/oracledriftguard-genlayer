"use client";

import { useState } from "react";
import {
  ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS,
  assessDrift,
  compactError,
  type WalletAddress,
} from "@/lib/genlayer";

declare global {
  interface Window {
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

export default function AssessPage() {
  const [marketId, setMarketId] = useState("market_");
  const [observationLabel, setObservationLabel] = useState("ETH/USD morning drift check");
  const [observedAt, setObservedAt] = useState("2026-09-29T00:00:00Z");
  const [incidentUrl, setIncidentUrl] = useState("https://ethereum.org/en/");
  const [address, setAddress] = useState(ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS);
  const [wallet, setWallet] = useState<WalletAddress | null>(null);
  const [message, setMessage] = useState("Enter a market_* ID, then request consensus assessment.");
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
      setMessage("Waiting for GenLayer consensus on the drift assessment...");
      const account = wallet ?? await connectWallet();
      const result = await assessDrift({
        walletAddress: account,
        marketId,
        observationLabel,
        observedAt,
        incidentUrl,
        contractAddress: address as `0x${string}`,
      });
      setRecord(JSON.stringify({ driftId: result.driftId, report: result.report, readbackWarning: result.readbackWarning }, null, 2));
      setMessage(`Drift report accepted: ${result.driftId}`);
    } catch (error) {
      setMessage(compactError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#15171a]">
      <a className="pill" href="/">OracleDriftGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Assess oracle drift</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#60707b]">
        Ask validators to render the registered sources and store a drift_*
        assessment tied to the market baseline.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="market" label="Market ID" value={marketId} setValue={setMarketId} />
        <Field id="label" label="Observation label" value={observationLabel} setValue={setObservationLabel} />
        <Field id="observed" label="Observed at" value={observedAt} setValue={setObservedAt} />
        <Field id="incident" label="Incident or context URL" value={incidentUrl} setValue={setIncidentUrl} />
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button" onClick={() => connectWallet().then(() => setMessage("Wallet connected.")).catch((error) => setMessage(compactError(error)))}>
            Connect wallet
          </button>
          <button className="action-button primary" disabled={busy} onClick={submit}>
            {busy ? "Awaiting consensus" : "Assess drift"}
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
