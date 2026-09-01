import { PowerSyncContext } from "@powersync/react";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useAuth } from "../../features/auth/AuthProvider";
import { powerSyncConfiguration } from "./config";
import { powerSyncDatabase } from "./database";
import { shouldManagePowerSyncLifecycle } from "./lifecycle-activation";
import { powerSyncLifecycle } from "./lifecycle";

interface PowerSyncRuntimeState {
  readonly configured: boolean;
  readonly sqliteReady: boolean;
  readonly error: Error | null;
}

const PowerSyncRuntimeContext = createContext<PowerSyncRuntimeState | null>(null);

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("PowerSync falló por una causa desconocida.");
}

export function PowerSyncProvider({ children }: PropsWithChildren): React.JSX.Element {
  const { state: authState } = useAuth();
  const [runtime, setRuntime] = useState<PowerSyncRuntimeState>({
    configured: powerSyncConfiguration.status === "CONFIGURED",
    sqliteReady: powerSyncDatabase.ready,
    error: null,
  });

  useEffect(() => {
    if (!shouldManagePowerSyncLifecycle(authState.status)) {
      return;
    }

    let current = true;

    void powerSyncLifecycle
      .transitionToSession(authState.session)
      .then(() => {
        if (current) {
          setRuntime((state) => ({ ...state, sqliteReady: powerSyncDatabase.ready, error: null }));
        }
      })
      .catch((error: unknown) => {
        if (current) {
          setRuntime((state) => ({
            ...state,
            sqliteReady: powerSyncDatabase.ready,
            error: toError(error),
          }));
        }
      });

    return (): void => {
      current = false;
    };
  }, [authState.session, authState.status]);

  return (
    <PowerSyncContext.Provider value={powerSyncDatabase}>
      <PowerSyncRuntimeContext.Provider value={runtime}>
        {children}
      </PowerSyncRuntimeContext.Provider>
    </PowerSyncContext.Provider>
  );
}

export function usePowerSyncRuntime(): PowerSyncRuntimeState {
  const runtime = useContext(PowerSyncRuntimeContext);

  if (runtime === null) {
    throw new Error("usePowerSyncRuntime must be used within PowerSyncProvider.");
  }

  return runtime;
}
