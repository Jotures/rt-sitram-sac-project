import { useStatus } from "@powersync/react";
import { useAuth } from "../auth/AuthProvider";
import type { NetworkStatus } from "../../lib/network/connectivity";
import { usePowerSyncRuntime } from "../../lib/powersync/PowerSyncProvider";
import { derivePowerSyncDisplayStatus } from "../../lib/powersync/sync-state";
import { useUploadQueue } from "../../lib/powersync/use-upload-queue";
import "./PowerSyncPanel.css";

interface PowerSyncPanelProps {
  readonly networkStatus: NetworkStatus;
}

function getLocalStorageStatus(sqliteReady: boolean): string {
  return sqliteReady
    ? "Listo para guardar datos en este dispositivo."
    : "Preparando el almacenamiento local de este dispositivo.";
}

function getPendingChangesStatus(sqliteReady: boolean, pending: number): string {
  if (!sqliteReady) {
    return "La cola de envíos se revisará cuando el almacenamiento local esté listo.";
  }

  if (pending === 0) {
    return "No hay cambios pendientes de envío.";
  }

  return `${pending} ${pending === 1 ? "cambio pendiente de envío." : "cambios pendientes de envío."}`;
}

function getLastSyncStatus(lastSyncedAt: Date | null | undefined): string {
  if (lastSyncedAt === null || lastSyncedAt === undefined) {
    return "Aún no se ha registrado una sincronización.";
  }

  return `Registrada el ${lastSyncedAt.toLocaleString("es-PE")}.`;
}

// Diagnostic-only status. Product routes consume the runtime hooks directly and
// must not expose this panel as a product screen.
export function PowerSyncPanel({ networkStatus }: PowerSyncPanelProps): React.JSX.Element {
  const status = useStatus();
  const runtime = usePowerSyncRuntime();
  const { state: authState } = useAuth();
  const queue = useUploadQueue(runtime.sqliteReady);
  const syncError = runtime.error ?? status.downloadError ?? status.uploadError ?? queue.error;
  const displayStatus = derivePowerSyncDisplayStatus({
    configured: runtime.configured,
    authenticated: authState.session !== null,
    connecting: status.connecting,
    connected: status.connected,
    online: networkStatus === "ONLINE",
    error: syncError,
  });

  return (
    <section className="technical-status__powersync" aria-labelledby="powersync-title">
      <h2 id="powersync-title">Sincronización del dispositivo</h2>
      <div
        aria-live="polite"
        className={`powersync-panel__summary powersync-panel__summary--${displayStatus.tone}`}
        role="status"
      >
        <p className="powersync-panel__summary-label">Estado actual</p>
        <h3>{displayStatus.label}</h3>
        <p>{displayStatus.description}</p>
      </div>
      <dl className="technical-status__details technical-status__details--compact">
        <div>
          <dt>Datos locales</dt>
          <dd>{getLocalStorageStatus(runtime.sqliteReady)}</dd>
        </div>
        <div>
          <dt>Cambios pendientes de envío</dt>
          <dd>{getPendingChangesStatus(runtime.sqliteReady, queue.pending)}</dd>
        </div>
        <div>
          <dt>Última sincronización registrada</dt>
          <dd>{getLastSyncStatus(status.lastSyncedAt)}</dd>
        </div>
      </dl>
      <p className="powersync-panel__notice">
        Tener una conexión activa no confirma por sí solo que todos los cambios ya se hayan enviado.
        Revisa que no queden cambios pendientes antes de cerrar una tarea importante.
      </p>
      {syncError === null ? null : (
        <section
          className="powersync-panel__alert"
          role="alert"
          aria-labelledby="powersync-error-title"
        >
          <h3 id="powersync-error-title">La sincronización necesita revisión</h3>
          <p>
            No pudimos completar una parte de la comunicación con el servidor. Revisa la conexión
            del dispositivo y, si el aviso continúa, compártelo con la persona responsable.
          </p>
          <details>
            <summary>Ver detalle técnico</summary>
            <pre>{syncError.message}</pre>
          </details>
        </section>
      )}
    </section>
  );
}
