import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { getSupabaseClient } from "../../lib/supabase";
import { preparePowerSyncForLogout } from "../../lib/powersync/lifecycle";
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
  updatePassword(password: string): Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthOperation = "SESSION_CHECK" | "SIGN_IN" | "SIGN_OUT" | "UPDATE_PASSWORD";

function getProviderErrorDetail(error: unknown): string {
  return error instanceof Error ? error.message.toLocaleLowerCase() : "";
}

function isConnectionError(error: unknown, detail: string): boolean {
  return (
    error instanceof TypeError ||
    detail.includes("failed to fetch") ||
    detail.includes("network") ||
    detail.includes("conex")
  );
}

function isInvalidCredentialError(detail: string): boolean {
  return (
    detail.includes("invalid login") ||
    detail.includes("invalid credential") ||
    detail.includes("invalid email or password") ||
    detail.includes("user not found")
  );
}

function isAccountPendingError(detail: string): boolean {
  return detail.includes("email not confirmed") || detail.includes("email_not_confirmed");
}

function isRateLimitError(detail: string): boolean {
  return (
    detail.includes("too many") ||
    detail.includes("rate limit") ||
    detail.includes("over_request_rate_limit")
  );
}

function getUserFacingAuthErrorMessage(error: unknown, operation: AuthOperation): string {
  const detail = getProviderErrorDetail(error);

  if (isConnectionError(error, detail)) {
    return "No pudimos conectarnos al servidor. Revisa tu conexión a internet e inténtalo nuevamente.";
  }

  if (operation === "SIGN_IN") {
    if (isInvalidCredentialError(detail)) {
      return "El correo o la contraseña no coinciden. Revísalos e inténtalo nuevamente.";
    }

    if (isAccountPendingError(detail)) {
      return "Tu cuenta todavía no está habilitada. Comunícate con Gerencia.";
    }

    if (isRateLimitError(detail)) {
      return "Se realizaron varios intentos de acceso. Espera unos minutos antes de volver a intentarlo.";
    }

    return "No pudimos verificar tu acceso. Inténtalo nuevamente. Si el problema continúa, comunícate con Gerencia.";
  }

  if (operation === "SIGN_OUT") {
    return "No fue posible cerrar la sesión en este dispositivo. La sesión continúa abierta; inténtalo nuevamente.";
  }

  if (operation === "UPDATE_PASSWORD") {
    return "No pudimos guardar la contraseña. Solicita un nuevo enlace a Gerencia e inténtalo otra vez.";
  }

  return "No pudimos comprobar tu sesión. Intenta ingresar nuevamente. Si el problema continúa, comunícate con Gerencia.";
}

function getConfigurationMessage(): string {
  return "El acceso no está disponible en este dispositivo. Comunícate con Gerencia o con la persona responsable de configurar la aplicación.";
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

        publishState(
          data.session,
          error === null ? null : getUserFacingAuthErrorMessage(error, "SESSION_CHECK"),
        );
      })
      .catch((error: unknown) => {
        if (!receivedAuthEvent) {
          publishState(null, getUserFacingAuthErrorMessage(error, "SESSION_CHECK"));
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
        const message = getConfigurationMessage();
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }

      setState((currentState) => ({ ...currentState, error: null }));

      try {
        const { data, error } = await client.auth.signInWithPassword(credentials);

        if (error !== null) {
          const message = getUserFacingAuthErrorMessage(error, "SIGN_IN");
          setState((currentState) => ({ ...currentState, error: message }));

          return { ok: false, message };
        }

        setState(createAuthState(data.session));

        return { ok: true };
      } catch (error: unknown) {
        const message = getUserFacingAuthErrorMessage(error, "SIGN_IN");
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }
    },
    [client],
  );

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (client === null) {
      const message = getConfigurationMessage();
      setState((currentState) => ({ ...currentState, error: message }));

      return { ok: false, message };
    }

    setState((currentState) => ({ ...currentState, error: null }));

    try {
      await preparePowerSyncForLogout();
    } catch {
      const message =
        "No podemos cerrar la sesión todavía porque hay trabajo guardado en este dispositivo que necesita atención. Revisa la sincronización e inténtalo otra vez.";
      setState((currentState) => ({ ...currentState, error: message }));

      return { ok: false, message };
    }

    try {
      const { error } = await client.auth.signOut({ scope: "local" });

      if (error !== null) {
        const message = getUserFacingAuthErrorMessage(error, "SIGN_OUT");
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }

      setState(createAuthState(null));

      return { ok: true };
    } catch (error: unknown) {
      const message = getUserFacingAuthErrorMessage(error, "SIGN_OUT");
      setState((currentState) => ({ ...currentState, error: message }));

      return { ok: false, message };
    }
  }, [client]);

  const updatePassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      if (client === null) {
        const message = getConfigurationMessage();
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }

      setState((currentState) => ({ ...currentState, error: null }));

      try {
        const { error } = await client.auth.updateUser({ password });

        if (error !== null) {
          const message = getUserFacingAuthErrorMessage(error, "UPDATE_PASSWORD");
          setState((currentState) => ({ ...currentState, error: message }));

          return { ok: false, message };
        }

        return { ok: true };
      } catch (error: unknown) {
        const message = getUserFacingAuthErrorMessage(error, "UPDATE_PASSWORD");
        setState((currentState) => ({ ...currentState, error: message }));

        return { ok: false, message };
      }
    },
    [client],
  );

  return (
    <AuthContext.Provider value={{ state, signInWithPassword, signOut, updatePassword }}>
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
