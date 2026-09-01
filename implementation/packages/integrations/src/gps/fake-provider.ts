import { selectLatestGpsPosition, type GpsPosition, type GpsProviderKind } from "@rt-sitram/domain";
import {
  GpsProviderError,
  type GpsExternalAsset,
  type GpsPositionHistoryQuery,
  type GpsProvider,
} from "./contract";

export interface FakeGpsProviderSeed {
  readonly assets: readonly GpsExternalAsset[];
  readonly positionsByAssetId?: Readonly<Record<string, readonly GpsPosition[]>>;
}

/**
 * Deterministic provider for tests and UAT. It is intentionally not a fallback
 * for production credentials or a simulator of a real GPS portal.
 */
export class FakeGpsProvider implements GpsProvider {
  readonly kind: GpsProviderKind;
  readonly #assetsById: ReadonlyMap<string, GpsExternalAsset>;
  readonly #positionsByAssetId: ReadonlyMap<string, readonly GpsPosition[]>;

  constructor(kind: GpsProviderKind, seed: FakeGpsProviderSeed) {
    this.kind = kind;
    const assetsById = new Map<string, GpsExternalAsset>();
    for (const asset of seed.assets) {
      if (asset.provider !== kind) {
        throw new Error("Los activos de prueba deben pertenecer al proveedor configurado.");
      }
      if (assetsById.has(asset.externalAssetId)) {
        throw new Error("Los activos de prueba no pueden repetir un identificador externo.");
      }
      assetsById.set(asset.externalAssetId, { ...asset });
    }

    const positionsByAssetId = new Map<string, readonly GpsPosition[]>();
    for (const [assetId, positions] of Object.entries(seed.positionsByAssetId ?? {})) {
      if (!assetsById.has(assetId)) {
        throw new Error("Una posición de prueba no puede pertenecer a un activo desconocido.");
      }
      for (const position of positions) {
        if (position.provider !== kind || position.providerAssetId !== assetId) {
          throw new Error("La evidencia de prueba debe coincidir con su activo externo.");
        }
      }
      positionsByAssetId.set(assetId, [...positions]);
    }

    this.#assetsById = assetsById;
    this.#positionsByAssetId = positionsByAssetId;
  }

  async listAssets(): Promise<readonly GpsExternalAsset[]> {
    return [...this.#assetsById.values()].map((asset) => ({ ...asset }));
  }

  async getLatestPosition(externalAssetId: string): Promise<GpsPosition | null> {
    this.assertKnownAsset(externalAssetId);
    const positions = this.#positionsByAssetId.get(externalAssetId) ?? [];
    if (positions.length === 0) return null;

    return positions.reduce((latest, candidate) => selectLatestGpsPosition(latest, candidate));
  }

  async getPositionHistory(query: GpsPositionHistoryQuery): Promise<readonly GpsPosition[]> {
    this.assertKnownAsset(query.externalAssetId);
    validateHistoryQuery(query);

    const from = query.from.getTime();
    const to = query.to.getTime();
    return [...(this.#positionsByAssetId.get(query.externalAssetId) ?? [])]
      .filter((position) => {
        const timestamp = Date.parse(position.recordedAt);
        return timestamp >= from && timestamp <= to;
      })
      .sort(compareGpsPositionsChronologically)
      .slice(0, query.limit);
  }

  private assertKnownAsset(externalAssetId: string): void {
    if (!this.#assetsById.has(externalAssetId)) {
      throw new GpsProviderError(
        "ASSET_NOT_FOUND",
        "El activo externo no está vinculado al proveedor.",
      );
    }
  }
}

function validateHistoryQuery(query: GpsPositionHistoryQuery): void {
  const from = query.from.getTime();
  const to = query.to.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    throw new Error("El rango de historial GPS no es válido.");
  }
  if (!Number.isInteger(query.limit) || query.limit < 1) {
    throw new Error("El límite de historial GPS debe ser un entero positivo.");
  }
}

function compareGpsPositionsChronologically(left: GpsPosition, right: GpsPosition): number {
  const recordedAtDifference = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
  if (recordedAtDifference !== 0) return recordedAtDifference;
  return Date.parse(left.receivedAt) - Date.parse(right.receivedAt);
}
