import type { AuthState } from "../../features/auth/auth-state";
import { isIdentityActive, type AppRole } from "../../features/identity/identity-model";
import type { IdentityState } from "../../features/identity/identity-state";
import { getRoleHomePath, routePaths } from "./route-model";

export type RouteGuardDecision =
  | { readonly kind: "WAIT" }
  | { readonly kind: "ALLOW" }
  | { readonly kind: "REDIRECT"; readonly to: string };

export function decideAuthenticatedRoute(authState: AuthState): RouteGuardDecision {
  if (authState.status === "INITIALIZING") {
    return { kind: "WAIT" };
  }

  return authState.session === null
    ? { kind: "REDIRECT", to: routePaths.login }
    : { kind: "ALLOW" };
}

export function decidePublicOnlyRoute(
  authState: AuthState,
  identityState: IdentityState,
): RouteGuardDecision {
  if (authState.status === "INITIALIZING") {
    return { kind: "WAIT" };
  }

  if (authState.session === null) {
    return { kind: "ALLOW" };
  }

  if (identityState.status === "ANONYMOUS" || identityState.status === "LOADING") {
    return { kind: "WAIT" };
  }

  if (identityState.status === "UNAVAILABLE" || !isIdentityActive(identityState.identity)) {
    return { kind: "REDIRECT", to: routePaths.noAccess };
  }

  return { kind: "REDIRECT", to: getRoleHomePath(identityState.identity.profile.role) };
}

export function decideRoleRoute(
  identityState: IdentityState,
  allowedRoles: readonly AppRole[],
): RouteGuardDecision {
  if (identityState.status === "ANONYMOUS" || identityState.status === "LOADING") {
    return { kind: "WAIT" };
  }

  if (identityState.status === "UNAVAILABLE" || !isIdentityActive(identityState.identity)) {
    return { kind: "REDIRECT", to: routePaths.noAccess };
  }

  return allowedRoles.includes(identityState.identity.profile.role)
    ? { kind: "ALLOW" }
    : { kind: "REDIRECT", to: getRoleHomePath(identityState.identity.profile.role) };
}

export function decideRoleHome(identityState: IdentityState): RouteGuardDecision {
  if (identityState.status === "ANONYMOUS" || identityState.status === "LOADING") {
    return { kind: "WAIT" };
  }

  if (identityState.status === "UNAVAILABLE" || !isIdentityActive(identityState.identity)) {
    return { kind: "REDIRECT", to: routePaths.noAccess };
  }

  return { kind: "REDIRECT", to: getRoleHomePath(identityState.identity.profile.role) };
}
