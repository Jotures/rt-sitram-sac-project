import { usePowerSync, useQuery, useStatus } from "@powersync/react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "../../components/primitives/Button";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { usePowerSyncRuntime } from "../../lib/powersync/PowerSyncProvider";
import { useUploadQueue } from "../../lib/powersync/use-upload-queue";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import {
  discardFailedAttachment,
  retryFailedAttachment,
  type FailedAttachmentRow,
} from "../../lib/powersync/attachment-recovery";
import {
  MAX_AUTOMATIC_ATTACHMENT_ATTEMPTS,
  OpfsAttachmentBlobSource,
} from "../../lib/powersync/attachment-worker";
import {
  discardUploadDeadLetter,
  isRepairableLegacyUpload,
  retryUploadDeadLetter,
  uploadFailureMessage,
  type UploadDeadLetterStatus,
} from "../../lib/powersync/upload-recovery";
import {
  DriverLoadingState,
  DriverPageHeader,
  formatDriverDate,
  formatTripStatus,
} from "./DriverUiParts";
import { useDriverActivityHistory, useDriverTrips } from "./driver-data";

export type DriverSyncPhase = "local" | "pending" | "syncing" | "synced" | "error";

interface DriverSyncPhaseInput {
  readonly connected: boolean;
  readonly connecting: boolean;
  readonly hasError: boolean;
  readonly network: "ONLINE" | "OFFLINE";
  readonly pending: number;
  readonly recoveryReady: boolean;
  readonly sqliteReady: boolean;
}

export function deriveDriverSyncPhase(input: DriverSyncPhaseInput): DriverSyncPhase {
  if (input.hasError) return "error";
  if (!input.sqliteReady) return "local";
  if (!input.recoveryReady) return input.connected ? "syncing" : "local";
  if (input.pending > 0 && (input.network === "OFFLINE" || !input.connected)) return "pending";
  if (input.pending > 0 || input.connecting) return "syncing";
  if (input.connected) return "synced";
  return "local";
}

const syncPhaseContent: Readonly<
  Record<
    DriverSyncPhase,
    { readonly description: string; readonly eyebrow: string; readonly title: string }
  >
> = {
  local: {
    eyebrow: "En este dispositivo",
    title: "La bitácora local está preparada",
    description: "Puedes registrar ruta, kilometraje y evidencia aunque todavía no haya conexión.",
  },
  pending: {
    eyebrow: "En cola local",
    title: "Hay registros pendientes de salida",
    description: "Nada se perdió. El envío continuará automáticamente cuando vuelva la conexión.",
  },
  syncing: {
    eyebrow: "Transferencia en curso",
    title: "Enviando bitácora y evidencia",
    description: "Mantén la aplicación abierta mientras se confirman los elementos pendientes.",
  },
  synced: {
    eyebrow: "Servidor al día",
    title: "Todo está sincronizado",
    description: "La cola local está vacía y el servidor confirmó la última transferencia.",
  },
  error: {
    eyebrow: "Revisión necesaria",
    title: "Hay elementos que requieren una decisión",
    description:
      "La bitácora permanece en el dispositivo. Revisa cada motivo antes de reintentar o descartar.",
  },
};

function syncPhaseCopy(phase: DriverSyncPhase): (typeof syncPhaseContent)[DriverSyncPhase] {
  return syncPhaseContent[phase];
}

const syncSteps = [
  { phase: "local", label: "En dispositivo" },
  { phase: "pending", label: "Pendiente" },
  { phase: "syncing", label: "Enviando" },
  { phase: "synced", label: "Confirmado" },
] as const;

function DriverSyncProgress({ phase }: { readonly phase: DriverSyncPhase }): React.JSX.Element {
  const currentIndex = phase === "error" ? 1 : syncSteps.findIndex((step) => step.phase === phase);

  return (
    <ol className="driver-sync-progress" aria-label="Trayecto de sincronización">
      {syncSteps.map((step, index) => {
        const state =
          phase === "error" && index === currentIndex
            ? "error"
            : index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "upcoming";
        return (
          <li
            aria-current={state === "current" || state === "error" ? "step" : undefined}
            data-state={state}
            key={step.phase}
          >
            <span aria-hidden="true">{index + 1}</span>
            <small>{step.label}</small>
          </li>
        );
      })}
    </ol>
  );
}

export function DriverHistoryPage(): React.JSX.Element {
  const trips = useDriverTrips();
  const activity = useDriverActivityHistory();
  if (trips.isLoading || activity.isLoading) return <DriverLoadingState />;

  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Viajes y registros disponibles en este dispositivo."
        eyebrow="Bitácora local"
        title="Historial"
      />
      <section className="driver-history-section">
        <h2>Viajes</h2>
        {trips.data.length === 0 ? (
          <p className="driver-history-empty">Todavía no hay viajes sincronizados.</p>
        ) : (
          <ul>
            {trips.data.map((trip) => (
              <li key={trip.id}>
                <span className="driver-history-icon">
                  <Icon name="route" />
                </span>
                <div>
                  <strong>
                    {trip.code} · {trip.origin} → {trip.destination}
                  </strong>
                  <small>{formatDriverDate(trip.scheduled_at)}</small>
                </div>
                <StatusChip label={formatTripStatus(trip.operational_status)} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="driver-history-section">
        <h2>Registros</h2>
        {activity.data.length === 0 ? (
          <p className="driver-history-empty">No hay actividad registrada todavía.</p>
        ) : (
          <ul>
            {activity.data.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <span className="driver-history-icon">
                  <Icon
                    name={
                      item.kind === "fuel"
                        ? "fuel"
                        : item.kind === "expense"
                          ? "money"
                          : item.kind === "odometer"
                            ? "gauge"
                            : "alert"
                    }
                  />
                </span>
                <div>
                  <strong>{item.summary}</strong>
                  <small>
                    {item.detail ?? "Sin detalle"} · {formatDriverDate(item.occurred_at)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function DriverSynchronizationPage({
  audience = "driver",
}: {
  readonly audience?: "driver" | "staff";
}): React.JSX.Element {
  const runtime = usePowerSyncRuntime();
  const queue = useUploadQueue(runtime.sqliteReady);
  const status = useStatus();
  const network = useNetworkStatus();
  const attachments = useDriverAttachmentRecoveryState();
  const deadLetters = useDriverUploadDeadLetters();
  const unresolvedCount = deadLetters.data.filter(
    (item) => item.status === "pending_review",
  ).length;
  const hasError =
    runtime.error !== null ||
    status.downloadError != null ||
    status.uploadError != null ||
    queue.error !== null ||
    attachments.error !== null ||
    deadLetters.error != null ||
    attachments.failed.length > 0 ||
    unresolvedCount > 0;
  const recoveryErrorCount = unresolvedCount + attachments.failed.length;
  const totalPending = queue.pending + attachments.pending;
  const phase = deriveDriverSyncPhase({
    connected: status.connected,
    connecting: status.connecting,
    hasError,
    network,
    pending: totalPending,
    recoveryReady: !attachments.isLoading && !deadLetters.isLoading,
    sqliteReady: runtime.sqliteReady,
  });
  const phaseCopy = syncPhaseCopy(phase);

  return (
    <div className="driver-page">
      <DriverPageHeader
        description={
          audience === "driver"
            ? "Sigue el trayecto de cada registro desde tu dispositivo hasta el servidor."
            : "Revisa qué quedó guardado en este dispositivo y qué ya confirmó el servidor."
        }
        eyebrow={audience === "driver" ? "Bitácora y evidencia" : "Estado del dispositivo"}
        title="Sincronización"
      />
      <section className="driver-sync-card">
        <div className="driver-sync-hero">
          <span className={`driver-sync-icon driver-sync-icon--${phase}`}>
            <Icon
              name={phase === "error" || network === "OFFLINE" ? "offline" : "wifi"}
              size={28}
            />
          </span>
          <div>
            <p className="driver-eyebrow">{phaseCopy.eyebrow}</p>
            <h2>{phaseCopy.title}</h2>
            <p>{phaseCopy.description}</p>
          </div>
        </div>
        <DriverSyncProgress phase={phase} />
        <dl>
          <div>
            <dt>Registros pendientes</dt>
            <dd>{queue.pending}</dd>
          </div>
          <div>
            <dt>Evidencias pendientes</dt>
            <dd>{attachments.pending}</dd>
          </div>
          <div>
            <dt>Errores por revisar</dt>
            <dd>{recoveryErrorCount}</dd>
          </div>
          <div>
            <dt>Última sincronización</dt>
            <dd>{status.lastSyncedAt?.toLocaleString("es-PE") ?? "Aún no disponible"}</dd>
          </div>
          <div>
            <dt>Base local</dt>
            <dd>{runtime.sqliteReady ? "Lista" : "Preparando"}</dd>
          </div>
        </dl>
        {hasError ? (
          <div className="driver-feedback driver-feedback--error" role="alert">
            {runtime.error?.message ??
              status.uploadError?.message ??
              status.downloadError?.message ??
              queue.error?.message ??
              attachments.error?.message ??
              deadLetters.error?.message ??
              `${recoveryErrorCount} elemento(s) requieren una decisión antes de cerrar sesión.`}
          </div>
        ) : null}
      </section>
      <AttachmentRecoveryPanel items={attachments.failed} />
      <UploadRecoveryPanel items={deadLetters.data} />
    </div>
  );
}

interface UploadDeadLetterSummary {
  readonly id: string;
  readonly source_table: string;
  readonly source_record_id: string;
  readonly op_data_json: string;
  readonly error_message: string;
  readonly status: UploadDeadLetterStatus;
  readonly attempts: number;
  readonly last_failed_at: string;
  readonly resolution: string | null;
  readonly resolution_note: string | null;
  readonly retry_record_id: string | null;
}

function useDriverUploadDeadLetters(): ReturnType<typeof useQuery<UploadDeadLetterSummary>> {
  return useQuery<UploadDeadLetterSummary>(
    `SELECT id, source_table, source_record_id, op_data_json, error_message, status, attempts,
      last_failed_at, resolution, resolution_note, retry_record_id
     FROM upload_dead_letters
     ORDER BY CASE WHEN status = 'pending_review' THEN 0 ELSE 1 END, last_failed_at DESC
     LIMIT 30`,
  );
}

function UploadRecoveryPanel({
  items,
}: {
  readonly items: readonly UploadDeadLetterSummary[];
}): React.JSX.Element | null {
  const database = usePowerSync();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    readonly action: "retry" | "discard";
    readonly item: UploadDeadLetterSummary;
  } | null>(null);

  if (items.length === 0) {
    return null;
  }

  const run = async (id: string, action: () => Promise<void>): Promise<boolean> => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (cause: unknown) {
      setActionError(
        cause instanceof Error ? cause.message : "No se pudo resolver el registro pendiente.",
      );
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmDecision = async (reason: string): Promise<void> => {
    if (decision === null) return;
    const succeeded = await run(decision.item.id, async () => {
      if (decision.action === "retry") {
        await retryUploadDeadLetter(database, decision.item.id, true);
      } else {
        await discardUploadDeadLetter(database, decision.item.id, true, reason);
      }
    });
    if (succeeded) setDecision(null);
  };

  return (
    <section className="driver-recovery" aria-labelledby="driver-recovery-title">
      <div>
        <p className="driver-eyebrow">Recuperación manual</p>
        <h2 id="driver-recovery-title">Registros rechazados por el servidor</h2>
        <p>
          Ningún registro se elimina en silencio. Revisa el motivo y decide si corresponde
          reintentarlo o descartarlo.
        </p>
      </div>
      {actionError === null ? null : (
        <div className="driver-feedback driver-feedback--error" role="alert">
          {actionError}
        </div>
      )}
      <ul className="driver-recovery__list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="driver-recovery__summary">
              <strong>{uploadTableLabel(item.source_table)}</strong>
              <small>
                {formatDriverDate(item.last_failed_at)} · intento {item.attempts}
              </small>
              <p>{uploadFailureMessage(item)}</p>
              {isRepairableLegacyUpload(item) && item.status === "pending_review" ? (
                <small>La copia original queda preservada en el historial local.</small>
              ) : null}
              {item.resolution_note === null ? null : <small>{item.resolution_note}</small>}
            </div>
            {item.status === "pending_review" ? (
              <div className="driver-recovery__actions">
                <Button
                  disabled={busyId !== null}
                  onClick={() => {
                    setActionError(null);
                    setDecision({ action: "retry", item });
                  }}
                  variant="secondary"
                >
                  {busyId === item.id ? "Procesando…" : "Reintentar"}
                </Button>
                <Button
                  disabled={busyId !== null}
                  onClick={() => {
                    setActionError(null);
                    setDecision({ action: "discard", item });
                  }}
                  variant="danger"
                >
                  Descartar
                </Button>
              </div>
            ) : (
              <StatusChip
                label={item.status === "retry_queued" ? "Reintento en cola" : "Descartado"}
                tone={item.status === "retry_queued" ? "warning" : "neutral"}
              />
            )}
          </li>
        ))}
      </ul>
      {decision === null ? null : (
        <RecoveryDecisionSheet
          action={decision.action}
          busy={busyId === decision.item.id}
          consequence={
            decision.action === "retry"
              ? "Se creará una nueva copia en la cola local y el servidor volverá a validar todos sus datos."
              : "El registro no llegará al servidor. La decisión y el motivo quedarán en el historial local."
          }
          description={`Registro: ${uploadTableLabel(decision.item.source_table)} · intento ${decision.item.attempts}.`}
          error={actionError}
          itemName={uploadTableLabel(decision.item.source_table)}
          onCancel={() => setDecision(null)}
          onConfirm={(reason) => void confirmDecision(reason)}
        />
      )}
    </section>
  );
}

function uploadTableLabel(table: string): string {
  const labels: Readonly<Record<string, string>> = {
    odometer_entries: "Kilometraje",
    fuel_entries: "Combustible",
    expenses: "Gasto",
    incidents: "Incidencia",
    trip_transition_requests: "Cambio de estado del viaje",
  };
  return labels[table] ?? "Registro operativo";
}

function AttachmentRecoveryPanel({
  items,
}: {
  readonly items: readonly FailedAttachmentRow[];
}): React.JSX.Element | null {
  const database = usePowerSync();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{
    readonly action: "retry" | "discard";
    readonly item: FailedAttachmentRow;
  } | null>(null);

  if (items.length === 0) return null;

  const run = async (id: string, action: () => Promise<void>): Promise<boolean> => {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo recuperar la evidencia.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmDecision = async (reason: string): Promise<void> => {
    if (decision === null) return;
    const succeeded = await run(decision.item.id, async () => {
      if (decision.action === "retry") {
        await retryFailedAttachment(database, decision.item.id, true);
      } else {
        await discardFailedAttachment(
          database,
          new OpfsAttachmentBlobSource(),
          decision.item.id,
          true,
          reason,
        );
      }
    });
    if (succeeded) setDecision(null);
  };

  return (
    <section className="driver-recovery" aria-labelledby="attachment-recovery-title">
      <div>
        <p className="driver-eyebrow">Evidencia local</p>
        <h2 id="attachment-recovery-title">Archivos que no pudieron enviarse</h2>
        <p>
          Alcanzaron el límite automático. Puedes reintentar o descartar únicamente la copia local;
          la operación relacionada nunca se elimina.
        </p>
      </div>
      {actionError === null ? null : (
        <div className="driver-feedback driver-feedback--error" role="alert">
          {actionError}
        </div>
      )}
      <ul className="driver-recovery__list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="driver-recovery__summary">
              <strong>{item.original_name}</strong>
              <small>
                {attachmentEntityLabel(item.entity_type)} · {formatFileSize(item.size_bytes)} ·
                {item.attempts} intentos
              </small>
              <small>Registro: {item.entity_id}</small>
              <p>
                {item.status === "discarding"
                  ? "El descarte quedó incompleto. Confírmalo nuevamente para finalizarlo."
                  : (item.last_error ?? "El servidor no aceptó el archivo.")}
              </p>
            </div>
            <div className="driver-recovery__actions">
              {item.status === "failed" ? (
                <Button
                  disabled={busyId !== null}
                  onClick={() => {
                    setActionError(null);
                    setDecision({ action: "retry", item });
                  }}
                  variant="secondary"
                >
                  {busyId === item.id ? "Procesando…" : "Reintentar"}
                </Button>
              ) : null}
              <Button
                disabled={busyId !== null}
                onClick={() => {
                  setActionError(null);
                  setDecision({ action: "discard", item });
                }}
                variant="danger"
              >
                {item.status === "discarding" ? "Finalizar descarte" : "Descartar archivo"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {decision === null ? null : (
        <RecoveryDecisionSheet
          action={decision.action}
          busy={busyId === decision.item.id}
          consequence={
            decision.action === "retry"
              ? "Conservará el mismo archivo local y volverá a la cola desde el primer intento."
              : `Se eliminará únicamente la copia local «${decision.item.original_name}». No se borrará el gasto, combustible o incidencia relacionado.`
          }
          description={`${attachmentEntityLabel(decision.item.entity_type)} · ${formatFileSize(decision.item.size_bytes)} · ${decision.item.attempts} intentos.`}
          error={actionError}
          itemName={decision.item.original_name}
          onCancel={() => setDecision(null)}
          onConfirm={(reason) => void confirmDecision(reason)}
        />
      )}
    </section>
  );
}

interface RecoveryDecisionSheetProps {
  readonly action: "retry" | "discard";
  readonly busy: boolean;
  readonly consequence: string;
  readonly description: string;
  readonly error: string | null;
  readonly itemName: string;
  readonly onCancel: () => void;
  readonly onConfirm: (reason: string) => void;
}

function RecoveryDecisionSheet({
  action,
  busy,
  consequence,
  description,
  error,
  itemName,
  onCancel,
  onConfirm,
}: RecoveryDecisionSheetProps): React.JSX.Element {
  const titleId = useId();
  const descriptionId = useId();
  const sheetRef = useRef<HTMLFormElement>(null);
  const cancelRef = useRef(onCancel);
  const busyRef = useRef(busy);
  const [reason, setReason] = useState("");
  const isDiscard = action === "discard";

  useEffect(() => {
    cancelRef.current = onCancel;
    busyRef.current = busy;
  }, [busy, onCancel]);

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        if (!busyRef.current) cancelRef.current();
        return;
      }
      if (event.key !== "Tab" || sheetRef.current === null) return;

      const focusable = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [href]",
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy) return;
    onConfirm(reason.trim());
  };

  return (
    <div
      className="driver-decision-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <form
        aria-busy={busy}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="driver-decision-sheet"
        onSubmit={submit}
        ref={sheetRef}
        role="dialog"
      >
        <div className="driver-decision-sheet__handle" aria-hidden="true" />
        <header>
          <div>
            <p className="driver-eyebrow">Decisión de recuperación</p>
            <h2 id={titleId}>
              {isDiscard ? "Descartar" : "Reintentar"} {itemName}
            </h2>
          </div>
          <button
            aria-label="Cerrar decisión"
            className="driver-decision-sheet__close"
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="driver-decision-sheet__description" id={descriptionId}>
          <p>{description}</p>
          <strong>{consequence}</strong>
        </div>
        {isDiscard ? (
          <label className="driver-decision-sheet__field">
            <span>Motivo del descarte</span>
            <textarea
              data-autofocus
              maxLength={500}
              minLength={3}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explica brevemente por qué ya no debe enviarse"
              required
              rows={4}
              value={reason}
            />
            <small>
              Ejemplo: comprobante duplicado o viaje cancelado. {reason.length}/500 caracteres.
            </small>
          </label>
        ) : null}
        {error === null ? null : (
          <div className="driver-feedback driver-feedback--error" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}
        <footer>
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
          <Button
            {...(!isDiscard ? { "data-autofocus": true } : {})}
            disabled={busy || (isDiscard && reason.trim().length < 3)}
            type="submit"
            variant={isDiscard ? "danger" : "primary"}
          >
            {busy ? "Procesando…" : isDiscard ? "Descartar del dispositivo" : "Crear reintento"}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function attachmentEntityLabel(type: FailedAttachmentRow["entity_type"]): string {
  const labels: Readonly<Record<FailedAttachmentRow["entity_type"], string>> = {
    fuel_entry: "Combustible",
    expense: "Gasto",
    incident: "Incidencia",
  };
  return labels[type];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function useDriverAttachmentRecoveryState(): {
  readonly pending: number;
  readonly failed: readonly FailedAttachmentRow[];
  readonly error: Error | null;
  readonly isLoading: boolean;
} {
  const pending = useQuery<{ readonly count: number }>(
    `SELECT COUNT(*) AS count FROM attachment_queue
     WHERE status IN ('pending', 'uploading', 'failed', 'discarding')`,
  );
  const failed = useQuery<FailedAttachmentRow>(
    `SELECT id, entity_type, entity_id, local_uri, original_name, mime_type,
      size_bytes, attempts, last_error, status, updated_at
     FROM attachment_queue
     WHERE (status = 'failed' AND attempts >= ?) OR status = 'discarding'
     ORDER BY updated_at DESC`,
    [MAX_AUTOMATIC_ATTACHMENT_ATTEMPTS],
  );

  return {
    pending: pending.data[0]?.count ?? 0,
    failed: failed.data,
    error: pending.error ?? failed.error ?? null,
    isLoading: pending.isLoading || failed.isLoading,
  };
}
