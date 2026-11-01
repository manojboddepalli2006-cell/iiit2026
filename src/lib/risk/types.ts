export type RiskModel = "independent" | "gaussian";
export type AssetStatus = "Active" | "Watchlist" | "Defaulted";
export const ASSET_STATUSES: AssetStatus[] = ["Active", "Watchlist", "Defaulted"];

export interface Asset {
  id: string;
  asset_code: string;
  borrower_name: string;
  exposure: number;
  pd: number;
  lgd: number;
  rho: number;
  status: string;
}

export type AssetInput = Omit<Asset, "id">;

export interface AnalysisConfig {
  model: RiskModel;
  confidence: number;
  samples: number;
  algorithm: "classical" | "quantum";
}
