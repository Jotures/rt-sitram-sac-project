export interface PowerSyncEnvironment {
  readonly VITE_POWERSYNC_URL?: string;
}

export type PowerSyncConfiguration =
  | { readonly status: "CONFIGURED"; readonly endpoint: string }
  | { readonly status: "NOT_CONFIGURED"; readonly problem: "MISSING_URL" | "INVALID_URL" };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function readPowerSyncConfiguration(
  environment: PowerSyncEnvironment,
): PowerSyncConfiguration {
  const endpoint = environment.VITE_POWERSYNC_URL?.trim() ?? "";

  if (endpoint.length === 0) {
    return { status: "NOT_CONFIGURED", problem: "MISSING_URL" };
  }

  if (!isHttpUrl(endpoint)) {
    return { status: "NOT_CONFIGURED", problem: "INVALID_URL" };
  }

  return { status: "CONFIGURED", endpoint };
}

export const powerSyncConfiguration = readPowerSyncConfiguration(import.meta.env);
