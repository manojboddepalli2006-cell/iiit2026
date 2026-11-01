import type { AssetInput } from "./types";
import { ASSET_STATUSES } from "./types";

export function validateAsset(a: Partial<AssetInput>): string[] {
  const e: string[] = [];
  if (!a.asset_code || !String(a.asset_code).trim()) e.push("Asset ID is required");
  if (!a.borrower_name || !String(a.borrower_name).trim()) e.push("Borrower name is required");
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (!num(a.exposure) || (a.exposure as number) <= 0) e.push("Exposure must be a positive number");
  for (const [k, label] of [["pd", "PD"], ["lgd", "LGD"], ["rho", "Correlation (rho)"]] as const) {
    const v = a[k];
    if (!num(v) || (v as number) < 0 || (v as number) > 1) e.push(`${label} must be between 0 and 1`);
  }
  if (a.status && !ASSET_STATUSES.includes(a.status as never)) e.push("Status must be Active, Watchlist or Defaulted");
  return e;
}

export function findDuplicateCodes(codes: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const c of codes) {
    const k = c.trim().toUpperCase();
    if (seen.has(k)) dup.add(c);
    seen.add(k);
  }
  return [...dup];
}

export interface CsvRowResult { row: number; asset?: AssetInput | undefined; errors: string[] }

export const CSV_HEADERS = ["asset_id", "borrower_name", "exposure", "pd", "lgd", "rho", "status"];

export function parseAssetCsv(text: string, existingCodes: string[] = []): CsvRowResult[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [{ row: 0, errors: ["File is empty"] }];
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const missing = CSV_HEADERS.filter((h) => h !== "status" && !header.includes(h));
  if (missing.length) return [{ row: 1, errors: [`Missing columns: ${missing.join(", ")}`] }];
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  const results: CsvRowResult[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((c) => c.trim());
    const get = (h: string) => cells[header.indexOf(h)] ?? "";
    const asset: AssetInput = {
      asset_code: get("asset_id"),
      borrower_name: get("borrower_name"),
      exposure: Number(get("exposure")),
      pd: Number(get("pd")),
      lgd: Number(get("lgd")),
      rho: Number(get("rho")),
      status: get("status") || "Active",
    };
    const errors = validateAsset(asset);
    const key = asset.asset_code.toUpperCase();
    if (asset.asset_code && taken.has(key)) errors.push(`Asset ID ${asset.asset_code} already exists`);
    taken.add(key);
    results.push({ row: i + 1, asset: errors.length ? undefined : asset, errors });
  }
  return results;
}

export const SAMPLE_CSV =
  CSV_HEADERS.join(",") +
  "\nQCX-9001,Sample Borrower One Ltd,250000,0.02,0.45,0.15,Active\nQCX-9002,Sample Borrower Two Ltd,780000,0.035,0.6,0.2,Watchlist\n";
