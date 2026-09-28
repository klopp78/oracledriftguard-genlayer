import { ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS } from "@/lib/genlayer";

const repoUrl = "https://github.com/klopp78/oracledriftguard-genlayer";
const studioUrl = `https://explorer-studio.genlayer.com/address/${ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS}`;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#15171a]">
      <section className="border-b border-[#d7dee9] bg-[#fbfcff]">
        <div className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
          <span className="pill">GenLayer Project</span>
          <div className="mt-7 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
                OracleDriftGuard
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-[#60707b]">
                Consensus monitoring for public oracle and data-source drift.
                Register a market baseline, have validators read independent
                sources, and store a drift_* receipt when signals diverge.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="action-button primary" href="/market">Register market</a>
                <a className="action-button" href="/assess">Assess drift</a>
                <a className="action-button" href="/records">Inspect records</a>
              </div>
            </div>
            <div className="release-map">
              <div>
                <span>Baseline</span>
                <strong>market_* records bind the asset, threshold, and three public sources</strong>
              </div>
              <div>
                <span>Consensus read</span>
                <strong>Validators render every source and compare visible rates or status signals</strong>
              </div>
              <div>
                <span>Drift receipt</span>
                <strong>drift_* records preserve source commitments and review outcome</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-8 md:grid-cols-3 lg:px-8">
        <article className="tool-panel">
          <span className="field-label">01 Register</span>
          <h2 className="mt-2 text-2xl font-semibold">Market baseline</h2>
          <p className="mt-3 leading-7 text-[#60707b]">
            Define the symbol, reference asset, drift threshold, and three URLs
            that validators will use as the evidence surface.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#2f6e5f]" href="/market">Open market flow</a>
        </article>
        <article className="tool-panel">
          <span className="field-label">02 Assess</span>
          <h2 className="mt-2 text-2xl font-semibold">Validator comparison</h2>
          <p className="mt-3 leading-7 text-[#60707b]">
            Submit an observation window and incident context. The contract
            stores status, confidence, max drift, and review flags.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#2f6e5f]" href="/assess">Open drift flow</a>
        </article>
        <article className="tool-panel">
          <span className="field-label">03 Inspect</span>
          <h2 className="mt-2 text-2xl font-semibold">Audit trail</h2>
          <p className="mt-3 leading-7 text-[#60707b]">
            Read market_* and drift_* records directly from the deployed
            GenLayer contract, including snapshot commitments.
          </p>
          <a className="mt-5 inline-block text-sm font-semibold text-[#2f6e5f]" href="/records">Open records</a>
        </article>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-8 lg:px-8">
        <div className="difference-panel">
          <span className="field-label">Distinct workflow</span>
          <h2 className="text-2xl font-semibold">Built for oracle operations, not generic scoring</h2>
          <p className="mt-3 max-w-4xl leading-7 text-[#60707b]">
            OracleDriftGuard is a GenLayer-native operations tool for teams that
            need public evidence before pausing a feed, escalating an incident,
            or trusting fallback data. It does not calculate locally: the UI
            writes to the Intelligent Contract and reads back its accepted IDs.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div>
              <strong>Three-source evidence</strong>
              <span>Primary, secondary, and fallback sources are committed before assessment.</span>
            </div>
            <div>
              <strong>Threshold-bound output</strong>
              <span>Each report binds max observed drift to the market threshold.</span>
            </div>
            <div>
              <strong>Operational receipt</strong>
              <span>Reports return healthy, drift, stale, or inconclusive status.</span>
            </div>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap gap-4 px-5 pb-10 text-sm text-[#60707b] lg:px-8">
        <a href={repoUrl} rel="noreferrer" target="_blank">Source repository</a>
        <a href={studioUrl} rel="noreferrer" target="_blank">Studio contract</a>
        <code>{ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS}</code>
      </footer>
    </main>
  );
}
