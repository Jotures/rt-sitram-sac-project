import type { GpsPosition, GpsProviderKind } from "@rt-sitram/domain";

export interface GpsExternalAsset {
  readonly provider: GpsProviderKind;
  readonly externalAssetId: string;
  readonly displayName: string;
}

export interface GpsPositionHistoryQuery {
  readonly externalAssetId: string;
  readonly from: Date;
  readonly to: Date;
  /** Provider request limit, deliberately bounded by the caller. */
  readonly limit: number;
}

export interface GpsProvider {
  readonly kind: GpsProviderKind;
  listAssets(): Promise<readonly GpsExternalAsset[]>;
  getLatestPosition(externalAssetId: string): Promise<GpsPosition | null>;
  getPositionHistory(query: GpsPositionHistoryQuery): Promise<readonly GpsPosition[]>;
}

export type GpsProviderErrorCode =
  | "ASSET_NOT_FOUND"
  | "CONFIGURATION"
  | "UNAVAILABLE"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "MALFORMED_RESPONSE"
  | "REMOTE_ERROR";

/** Safe error surface for logs and operational health; it never retains a token or payload. */
export class GpsProviderError extends Error {
  readonly code: GpsProviderErrorCode;

  constructor(code: GpsProviderErrorCode, message: string) {
    super(message);
    this.name = "GpsProviderError";
    this.code = code;
  }
}
