import type { Session } from "@supabase/supabase-js";

export type AuthStatus = "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED";

export interface AuthState {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly error: string | null;
}

export function createInitializingAuthState(): AuthState {
  return {
    status: "INITIALIZING",
    session: null,
    error: null,
  };
}

export function createAuthState(session: Session | null, error: string | null = null): AuthState {
  if (session === null) {
    return {
      status: "UNAUTHENTICATED",
      session: null,
      error,
    };
  }

  return {
    status: "AUTHENTICATED",
    session,
    error: null,
  };
}
