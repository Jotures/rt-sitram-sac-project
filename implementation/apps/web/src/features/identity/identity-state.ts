import type { CurrentIdentity } from "./identity-model";
import type { IdentityLoadFailureReason, IdentityLoadResult } from "./data/identity-gateway";

export type IdentityState =
  | { readonly status: "ANONYMOUS" }
  | { readonly status: "LOADING"; readonly userId: string }
  | { readonly status: "READY"; readonly identity: CurrentIdentity }
  | {
      readonly status: "UNAVAILABLE";
      readonly reason: IdentityLoadFailureReason;
      readonly message: string;
    };

export function createAnonymousIdentityState(): IdentityState {
  return { status: "ANONYMOUS" };
}

export function createLoadingIdentityState(userId: string): IdentityState {
  return { status: "LOADING", userId };
}

export function resolveIdentityLoadResult(result: IdentityLoadResult): IdentityState {
  return result.ok
    ? { status: "READY", identity: result.identity }
    : {
        status: "UNAVAILABLE",
        reason: result.reason,
        message: result.message,
      };
}
