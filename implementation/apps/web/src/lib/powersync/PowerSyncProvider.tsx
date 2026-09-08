import { PowerSyncContext } from "@powersync/react";
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { useAuth } from "../../features/auth/AuthProvider";
import { powerSyncConfiguration } from "./config";
import { powerSyncDatabase } from "./database";
import { shouldManagePowerSyncLifecycle } from "./lifecycle-activation";
import { powerSyncLifecycle } from "./lifecycle";
import { restoreOperationJournal } from "./operation-journal";
import { powerSyncIdentityStore } from "./identity-store";

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

    // A previously prepared identity can use SQLite while the network reconnects.
    // New identities still wait for lifecycle cleanup before becoming writable.
    void powerSyncDatabase
      .init()
      .then(() => {
        if (
          current &&
          authState.session !== null &&
          powerSyncIdentityStore.read() === authState.session.user.id
        ) {
          setRuntime((state) => ({ ...state, sqliteReady: true }));
        }
      })
      .catch(() => undefined);

    void powerSyncLifecycle
      .transitionToSession(authState.session)
      .then(async () => {
        await restoreOperationJournal(powerSyncDatabase);
        if (current) {
          setRuntime((state) => ({ ...state, sqliteReady: true, error: null }));
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
