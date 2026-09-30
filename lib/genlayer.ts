import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS ??
    "0x7aA325fB20223CFC47f47d10311F5f0a555CCE0F") as `0x${string}`;

export type WalletAddress = `0x${string}`;

export type ChainReadOptions = {
  walletAddress?: WalletAddress;
  contractAddress?: `0x${string}`;
};

export type MarketInput = {
  walletAddress: WalletAddress;
  marketSymbol: string;
  referenceAsset: string;
  primarySourceUrl: string;
  secondarySourceUrl: string;
  fallbackSourceUrl: string;
  maxDriftBps: string;
  contractAddress?: `0x${string}`;
};

export type DriftInput = {
  walletAddress: WalletAddress;
  marketId: string;
  observationLabel: string;
  observedAt: string;
  incidentUrl: string;
  contractAddress?: `0x${string}`;
};

export function createOracleClient(walletAddress?: WalletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
  });
}

function createOracleWriteClient(walletAddress: WalletAddress) {
  const provider = typeof window !== "undefined" ? window.ethereum : undefined;
  if (!provider) throw new Error("No browser wallet detected.");

  return createClient({
    chain: studionet,
    account: walletAddress,
    provider,
  });
}

function contractAddress(contractAddress?: `0x${string}`) {
  return contractAddress ?? ORACLE_DRIFT_GUARD_CONTRACT_ADDRESS;
}

export async function readMarket(marketId: string, options: ChainReadOptions = {}) {
  const client = createOracleClient(options.walletAddress);
  return client.readContract({
    address: contractAddress(options.contractAddress),
    functionName: "get_market",
    args: [marketId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readDriftReport(driftId: string, options: ChainReadOptions = {}) {
  const client = createOracleClient(options.walletAddress);
  return client.readContract({
    address: contractAddress(options.contractAddress),
    functionName: "get_drift_report",
    args: [driftId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function registerMarket({
  walletAddress,
  marketSymbol,
  referenceAsset,
  primarySourceUrl,
  secondarySourceUrl,
  fallbackSourceUrl,
  maxDriftBps,
  contractAddress: overrideAddress,
}: MarketInput) {
  const client = createOracleWriteClient(walletAddress);
  const address = contractAddress(overrideAddress);
  const hash = await client.writeContract({
    address,
    functionName: "register_market",
    args: [marketSymbol, referenceAsset, primarySourceUrl, secondarySourceUrl, fallbackSourceUrl, maxDriftBps],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    fullTransaction: true,
  });
  const marketId = idFromReceipt(receipt, /market_[a-f0-9]{20}/, "market");
  const { data: market, warning: readbackWarning } = await tryReadback(() =>
    readMarket(marketId, { walletAddress, contractAddress: address }),
  );
  return { hash, receipt, marketId, market, readbackWarning };
}

export async function assessDrift({
  walletAddress,
  marketId,
  observationLabel,
  observedAt,
  incidentUrl,
  contractAddress: overrideAddress,
}: DriftInput) {
  const client = createOracleWriteClient(walletAddress);
  const address = contractAddress(overrideAddress);
  const hash = await client.writeContract({
    address,
    functionName: "assess_drift",
    args: [marketId, observationLabel, observedAt, incidentUrl],
    value: BigInt(0),
    leaderOnly: false,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    fullTransaction: true,
  });
  const driftId = idFromReceipt(receipt, /drift_[a-f0-9]{20}/, "drift");
  const { data: report, warning: readbackWarning } = await tryReadback(() =>
    readDriftReport(driftId, { walletAddress, contractAddress: address }),
  );
  return { hash, receipt, driftId, report, readbackWarning };
}

async function tryReadback<T>(read: () => Promise<T>): Promise<{ data: T | null; warning?: string }> {
  try {
    return { data: await read() };
  } catch (error) {
    return {
      data: null,
      warning: `The transaction was accepted, but immediate readback was not available yet: ${compactError(error)}`,
    };
  }
}

export function compactError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["shortMessage", "message", "reason", "details", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Fall through to generic message.
  }
  return "Unknown GenLayer transaction error.";
}

function idFromReceipt(receipt: unknown, pattern: RegExp, label: string): string {
  const id = collectStrings(receipt)
    .map((value) => value.match(pattern)?.[0])
    .find((value): value is string => Boolean(value));
  if (!id) {
    throw new Error(`Accepted ${label} transaction did not return its ID.`);
  }
  return id;
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectStrings);
}
