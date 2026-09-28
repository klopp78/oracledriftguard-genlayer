"use client";

import { useState } from "react";
import {
  ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS,
  compactError,
  readDriftReport,
  readMarket,
} from "@/lib/genlayer";

export default function RecordsPage() {
  const [address, setAddress] = useState(ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS);
  const [marketId, setMarketId] = useState("market_");
  const [driftId, setDriftId] = useState("drift_");
  const [record, setRecord] = useState("");
  const [message, setMessage] = useState("Read a market_* baseline or drift_* report from Studionet.");

  async function read(kind: "market" | "drift") {
    try {
      setRecord("");
      const result = kind === "market"
        ? await readMarket(marketId, { contractAddress: address as `0x${string}` })
        : await readDriftReport(driftId, { contractAddress: address as `0x${string}` });
      setRecord(typeof result === "string" ? result : JSON.stringify(result, null, 2));
      setMessage(`Loaded ${kind} record.`);
    } catch (error) {
      setMessage(compactError(error));
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10 text-[#15171a]">
      <a className="pill" href="/">OracleDriftGuard</a>
      <h1 className="mt-7 text-4xl font-semibold">Inspect records</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-[#60707b]">
        Verify that a market baseline or drift report is read from the live
        GenLayer contract, including snapshot commitments and bundle hashes.
      </p>
      <section className="tool-panel mt-8 grid gap-4">
        <Field id="address" label="Studio contract address" value={address} setValue={setAddress} />
        <Field id="market" label="Market ID" value={marketId} setValue={setMarketId} />
        <Field id="drift" label="Drift report ID" value={driftId} setValue={setDriftId} />
        <div className="flex flex-wrap gap-3">
          <button className="action-button primary" onClick={() => read("market")}>Read market</button>
          <button className="action-button" onClick={() => read("drift")}>Read drift report</button>
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
