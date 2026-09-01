import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createAuthState, createInitializingAuthState } from "../../features/auth/auth-state";
import type { CurrentIdentity } from "../../features/identity/identity-model";
import type { IdentityState } from "../../features/identity/identity-state";
import {
  decideAuthenticatedRoute,
  decidePublicOnlyRoute,
  decideRoleRoute,
} from "./guard-decisions";
import { routePaths } from "./route-model";

const session = { user: { id: "user-a" } } as Session;
const identity: CurrentIdentity = {
  company: {
    id: "company-a",
    legalName: "R&T SITRAM SAC",
    tradeName: "R&T SITRAM",
    active: true,
  },
  profile: {
    id: "user-a",
    companyId: "company-a",
    displayName: "Usuario A",
    role: "driver",
    active: true,
  },
};

describe("route guard decisions", () => {
  it("waits for Auth before deciding whether a route is private", () => {
    expect(decideAuthenticatedRoute(createInitializingAuthState())).toEqual({ kind: "WAIT" });
    expect(decideAuthenticatedRoute(createAuthState(null))).toEqual({
      kind: "REDIRECT",
      to: routePaths.login,
    });
    expect(decideAuthenticatedRoute(createAuthState(session))).toEqual({ kind: "ALLOW" });
  });

  it("does not redirect an authenticated user before identity bootstrap completes", () => {
    expect(decidePublicOnlyRoute(createAuthState(session), { status: "ANONYMOUS" })).toEqual({
      kind: "WAIT",
    });
    expect(
      decidePublicOnlyRoute(createAuthState(session), { status: "LOADING", userId: "user-a" }),
    ).toEqual({ kind: "WAIT" });
  });

  it("redirects an inactive identity to the no-access route", () => {
    const state: IdentityState = {
      status: "READY",
      identity: {
        ...identity,
        profile: { ...identity.profile, active: false },
      },
    };

    expect(decideRoleRoute(state, ["driver"])).toEqual({
      kind: "REDIRECT",
      to: routePaths.noAccess,
    });
  });

  it("allows only the roles declared by the route", () => {
    const state: IdentityState = { status: "READY", identity };

    expect(decideRoleRoute(state, ["driver"])).toEqual({ kind: "ALLOW" });
    expect(decideRoleRoute(state, ["management"])).toEqual({
      kind: "REDIRECT",
      to: routePaths.myTrip,
    });
  });
});
