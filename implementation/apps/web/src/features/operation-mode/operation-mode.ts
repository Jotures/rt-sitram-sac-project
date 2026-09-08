import type { AppRole } from "../identity/identity-model";

export type OperationMode = "quick" | "full";
export interface ModePreference {
  readonly mode: OperationMode;
  readonly pending: boolean;
}

export function isOperationMode(value: unknown): value is OperationMode {
  return value === "quick" || value === "full";
}

export function defaultOperationMode(role: AppRole): OperationMode {
  return role === "management" || role === "administration" ? "quick" : "full";
}

export function resolveModePreference(
  role: AppRole,
  remote: unknown,
  cached: string | null,
): ModePreference {
  try {
    const value: unknown = cached === null ? null : JSON.parse(cached);
    if (
      typeof value === "object" &&
      value !== null &&
      "mode" in value &&
      isOperationMode(value.mode)
    ) {
      const pending = "pending" in value && value.pending === true;
      if (pending || !isOperationMode(remote)) return { mode: value.mode, pending };
    }
  } catch {
    /* A damaged preference must never prevent access to the application. */
  }
  return { mode: isOperationMode(remote) ? remote : defaultOperationMode(role), pending: false };
}
