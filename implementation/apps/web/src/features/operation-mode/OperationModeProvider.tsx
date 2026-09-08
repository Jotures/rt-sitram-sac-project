import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import { useIdentity } from "../identity/IdentityProvider";
import type { AppRole } from "../identity/identity-model";
import { getSupabaseClient } from "../../lib/supabase";
import { resolveModePreference, type ModePreference, type OperationMode } from "./operation-mode";
import "./operation-mode.css";

interface OperationModeContextValue {
  readonly mode: OperationMode;
  readonly quick: boolean;
  readonly pending: boolean;
  setMode(mode: OperationMode): void;
}

const OperationModeContext = createContext<OperationModeContextValue>({
  mode: "full",
  quick: false,
  pending: false,
  setMode: () => undefined,
});

function readPreference(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writePreference(key: string, value: ModePreference): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    /* The current session still works when browser storage is unavailable. */
  }
}

export function OperationModeProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { state: identity } = useIdentity();
  const { state: auth } = useAuth();
  if (identity.status !== "READY" || auth.session === null) return <>{children}</>;
  return (
    <UserOperationMode
      key={identity.identity.profile.id}
      userId={identity.identity.profile.id}
      role={identity.identity.profile.role}
      remote={auth.session.user.user_metadata.operation_mode}
    >
      {children}
    </UserOperationMode>
  );
}

function UserOperationMode({
  children,
  userId,
  role,
  remote,
}: PropsWithChildren<{
  readonly userId: string;
  readonly role: AppRole;
  readonly remote: unknown;
}>): React.JSX.Element {
  const key = `rt-sitram:operation-mode:v1:${userId}`;
  const [preference, setPreference] = useState(() =>
    resolveModePreference(role, remote, readPreference(key)),
  );
  const [retry, setRetry] = useState(0);
  const setMode = useCallback(
    (mode: OperationMode) => {
      const next = { mode, pending: true };
      writePreference(key, next);
      setPreference(next);
    },
    [key],
  );

  useEffect(() => {
    const onOnline = (): void => setRetry((current) => current + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    if (!preference.pending) {
      const next = resolveModePreference(role, remote, readPreference(key));
      if (next.mode !== preference.mode) setPreference(next);
    }
  }, [key, preference.mode, preference.pending, remote, role]);

  useEffect(() => {
    if (!preference.pending || navigator.onLine === false) return;
    const client = getSupabaseClient();
    if (client === null) return;
    let current = true;
    // This metadata controls presentation only. Permissions always come from the company profile.
    void client.auth
      .updateUser({ data: { operation_mode: preference.mode } })
      .then(({ data, error }) => {
        if (!current || error !== null || data.user?.id !== userId) return;
        const next = { mode: preference.mode, pending: false };
        writePreference(key, next);
        setPreference(next);
      })
      .catch(() => {
        /* Keep the pending choice and retry after reconnecting. */
      });
    return () => {
      current = false;
    };
  }, [key, preference.mode, preference.pending, retry, userId]);

  return (
    <OperationModeContext.Provider
      value={{ ...preference, quick: preference.mode === "quick", setMode }}
    >
      {children}
    </OperationModeContext.Provider>
  );
}

export function useOperationMode(): OperationModeContextValue {
  return useContext(OperationModeContext);
}

export function OperationModeSettings(): React.JSX.Element {
  const { quick, pending, setMode } = useOperationMode();
  return (
    <section
      className="workspace-panel operation-mode-settings"
      aria-labelledby="operation-mode-title"
    >
      <div>
        <h2 id="operation-mode-title">Forma de trabajar</h2>
        <p>Esta preferencia se aplica a todo el sistema: inicio, navegación y formularios.</p>
      </div>
      <label className="operation-mode-switch">
        <input
          type="checkbox"
          role="switch"
          checked={quick}
          onChange={(event) => setMode(event.target.checked ? "quick" : "full")}
        />
        <span>
          <strong>Registro rápido</strong>
          <small>
            Registra salidas y movimientos con los datos esenciales. Abre los detalles cuando los
            necesites.
          </small>
        </span>
      </label>
      <p>
        {quick ? "Registro rápido activo" : "Vista completa activa"}.{" "}
        {pending
          ? "Preferencia guardada en este dispositivo; pendiente de sincronizar con tu cuenta."
          : "Preferencia personal guardada. Puedes cambiarla en cualquier momento."}
      </p>
    </section>
  );
}

export function MoreDetails({
  children,
  label = "Ver más detalles",
}: {
  readonly children: ReactNode;
  readonly label?: string;
}): React.JSX.Element {
  const { quick } = useOperationMode();
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className={`operation-more-details ${quick ? "" : "operation-more-details--full"}`}
      open={!quick || expanded}
      onToggle={(event) => {
        if (quick) setExpanded(event.currentTarget.open);
      }}
    >
      <summary>{label}</summary>
      <div className="admin-form__fields">{children}</div>
    </details>
  );
}
