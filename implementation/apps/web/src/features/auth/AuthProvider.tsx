import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { getSupabaseClient } from "../../lib/supabase";
import { createAuthState, createInitializingAuthState, type AuthState } from "./auth-state";

export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

export type AuthActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

interface AuthContextValue {
  readonly state: AuthState;
  signInWithPassword(credentials: SignInCredentials): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "No fue posible completar la operación de autenticación.";
}

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const client = getSupabaseClient();
  const [state, setState] = useState<AuthState>(() =>
    client === null ? createAuthState(null) : createInitializingAuthState(),
  );

  useEffect(() => {
    if (client === null) {
      return;
    }

    let isCurrent = true;
    let receivedAuthEvent = false;

    const publishState = (session: AuthState["session"], error: string | null = null): void => {
      if (isCurrent) {
        setState(createAuthState(session, error));
      }
    };

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      publishState(session);
    });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (receivedAuthEvent) {
          return;
        }

        publishState(data.session, error?.message ?? null);
      })
      .catch((error: unknown) => {
        if (!receivedAuthEvent) {
          publishState(null, getErrorMessage(error));
        }
      });

    return (): void => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [client]);

  const signInWithPassword = useCallback(
    async (credentials: SignInCredentials): Promise<AuthActionResult> => {
      if (client === null) {
        const message = "Supabase no configurado.";
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }

      setState((currentState) => ({ ...currentState, error: null }));

      const { data, error } = await client.auth.signInWithPassword(credentials);

      if (error !== null) {
        setState((currentState) => ({ ...currentState, error: error.message }));

        return { ok: false, message: error.message };
      }

      setState(createAuthState(data.session));

      return { ok: true };
    },
    [client],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (client === null) {
      const message = "Supabase no configurado.";
      setState((currentState) => ({ ...currentState, error: message }));

      return { ok: false, message };
    }

    setState((currentState) => ({ ...currentState, error: null }));

    const { error } = await client.auth.signOut({ scope: "local" });

    if (error !== null) {
      setState((currentState) => ({ ...currentState, error: error.message }));

      return { ok: false, message: error.message };
    }

    setState(createAuthState(null));

    return { ok: true };
  }, [client]);

  return (
    <AuthContext.Provider value={{ state, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
