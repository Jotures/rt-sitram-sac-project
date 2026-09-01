import type { GpsProviderKind } from "@rt-sitram/domain";
import { GpsProviderError, type GpsProvider } from "./contract";

/**
 * Keeps provider selection explicit. A missing registration is a configuration
 * failure, never an invitation to infer a mapping or reuse portal credentials.
 */
export class GpsProviderRegistry {
  readonly #providers = new Map<GpsProviderKind, GpsProvider>();

  constructor(providers: readonly GpsProvider[] = []) {
    for (const provider of providers) this.register(provider);
  }

  register(provider: GpsProvider): void {
    if (this.#providers.has(provider.kind)) {
      throw new Error(`El proveedor GPS ${provider.kind} ya está registrado.`);
    }
    this.#providers.set(provider.kind, provider);
  }

  resolve(kind: GpsProviderKind): GpsProvider {
    const provider = this.#providers.get(kind);
    if (!provider) {
      throw new GpsProviderError(
        "CONFIGURATION",
        `No existe un adaptador GPS habilitado para ${kind}.`,
      );
    }
    return provider;
  }
}
