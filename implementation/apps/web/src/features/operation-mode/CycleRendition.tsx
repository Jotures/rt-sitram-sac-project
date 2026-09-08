import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/primitives/Button";
import { getSupabaseClient } from "../../lib/supabase";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { operationActivitySql } from "../../lib/powersync/operation-journal";
import { retryFailedAttachment } from "../../lib/powersync/attachment-recovery";
import { useIdentity } from "../identity/IdentityProvider";
import {
  getOrCreateDeviceId,
  persistEvidenceFile,
  discardEvidenceFile,
} from "../driver-ui/device-and-evidence";
import {
  enqueueOperationCommand,
  makeOperationCommand,
  type RenditionLineInput,
} from "./operation-command";
import { MoreDetails } from "./OperationModeProvider";
import { createSupabaseAdminDataGateway } from "../admin-ui/admin-data";
import { CycleReportPanel } from "../reports/CycleReportPanel";

interface Movement {
  readonly incurred_at?: string;
  readonly fueled_at?: string;
  readonly version: number;
  readonly id: string;
  readonly category_id?: string;
  readonly amount?: number;
  readonly total_amount?: number;
  readonly approved_amount: number | null;
  readonly validation_status: string;
  readonly updated_at: string;
  readonly description?: string | null;
  readonly payment_source?: string;
}
export interface Snapshot {
  readonly cycle: {
    id: string;
    code: string;
    primary_driver_id: string;
    status: string;
    started_at?: string | null;
    returned_at?: string | null;
    notes?: string | null;
    is_test?: boolean;
  };
  readonly settlement: { id: string; status: string } | null;
  readonly summary: {
    lines: readonly RenditionLineInput[];
    version: number;
    status: string;
    baseline: string;
  } | null;
  readonly baseline: string;
  readonly total_advances: number;
  readonly expense_total: number;
  readonly driver_fuel: number;
  readonly company_fuel: number;
  readonly balance: number;
  readonly remaining: number;
  readonly advances_list: readonly {
    id: string;
    amount: number;
    version: number;
    status: string;
    delivered_at: string;
  }[];
  readonly expenses: readonly Movement[];
  readonly fuel: readonly Movement[];
  readonly categories: readonly { id: string; name: string }[];
  readonly evidence: readonly { id: string; file_id: string }[];
  readonly payments: readonly {
    id: string;
    amount: number;
    direction: string;
    occurred_at: string;
    cancelled_at: string | null;
  }[];
}
interface RpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (client === null) throw new Error("No se pudo conectar con la cuenta.");
  const result = await (client as unknown as RpcClient).rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
export function loadRenditionSnapshot(cycleId: string): Promise<Snapshot> {
  return call<Snapshot>("get_cycle_rendition", { p_cycle_id: cycleId });
}
const money = (value: number): string =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
const amountOf = (row: Movement): number => Number(row.amount ?? row.total_amount ?? 0);
const recognizedOf = (row: Movement): number =>
  row.validation_status === "validated" ? Number(row.approved_amount ?? amountOf(row)) : 0;
function localTime(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function initialLines(data: Snapshot): readonly RenditionLineInput[] {
  return data.categories.map((category) => {
    const rows = data.expenses.filter(
      (e) => e.category_id === category.id && e.validation_status !== "rejected",
    );
    const previous = data.summary?.lines?.find((l) => l.category_id === category.id);
    return (
      previous ?? {
        category_id: category.id,
        declared: rows.reduce((sum, e) => sum + amountOf(e), 0),
        recognized: rows.reduce((sum, e) => sum + recognizedOf(e), 0),
        description: "",
      }
    );
  });
}

export function CycleRendition({ cycleId }: { readonly cycleId: string }): React.JSX.Element {
  const reportClient = getSupabaseClient();
  const identity = useIdentity().state;
  const database = usePowerSync();
  const online = useNetworkStatus() === "ONLINE";
  const companyId = identity.status === "READY" ? identity.identity.company.id : "";
  const profileId = identity.status === "READY" ? identity.identity.profile.id : "";
  const role = identity.status === "READY" ? identity.identity.profile.role : null;
  const canEdit = role === "management" || role === "administration";
  const cacheKey = `rt-sitram:rendition:v1:${profileId}:${cycleId}`;
  const [data, setData] = useState<Snapshot | null>(null);
  const [lines, setLines] = useState<readonly RenditionLineInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [reconciled, setReconciled] = useState(false);
  const [usingLocal, setUsingLocal] = useState(false);
  const { data: attachments } = useQuery<{
    id: string;
    original_name: string;
    status: string;
    last_error: string | null;
    attempts: number;
  }>(
    "SELECT id, original_name, status, last_error, attempts FROM attachment_queue WHERE entity_type = 'settlement' AND entity_id = ? ORDER BY created_at",
    [data?.settlement?.id ?? cycleId],
  );
  const { data: commands } = useQuery<{ id: string; status: string; payload: string }>(
    `SELECT id,status,payload FROM (${operationActivitySql}) WHERE kind='rendition' AND dependency_id=? ORDER BY created_at`,
    [cycleId],
  );
  const confirmation = commands.map((c) => c.id + c.status).join(",");
  const attachmentState = attachments.map((a) => a.id + a.status).join(",");
  const load = useCallback(async () => {
    try {
      let next: Snapshot;
      if (!online) {
        const cached = localStorage.getItem(cacheKey);
        if (!cached)
          throw new Error(
            "Abre esta rendición con conexión una vez para preparar sus datos en este dispositivo.",
          );
        next = JSON.parse(cached) as Snapshot;
      } else {
        next = await call<Snapshot>("get_cycle_rendition", { p_cycle_id: cycleId });
        if (next.settlement === null && canEdit) {
          await call("create_cycle_settlement", {
            p_id: cycleId,
            p_cycle_id: cycleId,
            p_driver_id: next.cycle.primary_driver_id,
            p_notes: null,
          });
          next = await call<Snapshot>("get_cycle_rendition", { p_cycle_id: cycleId });
        }
        localStorage.setItem(cacheKey, JSON.stringify(next));
      }
      setData(next);
      setUsingLocal(!online);
      const draft = localStorage.getItem(`${cacheKey}:draft`);
      setLines(draft ? (JSON.parse(draft) as RenditionLineInput[]) : initialLines(next));
      setReconciled(false);
      setError(null);
    } catch (cause) {
      if (cause instanceof Error && /fetch|network|conex/i.test(cause.message)) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const snapshot = JSON.parse(cached) as Snapshot;
          setData(snapshot);
          setUsingLocal(true);
          const draft = localStorage.getItem(`${cacheKey}:draft`);
          setLines(draft ? (JSON.parse(draft) as RenditionLineInput[]) : initialLines(snapshot));
          setError(null);
          return;
        }
      }
      setError(cause instanceof Error ? cause.message : "No se pudo cargar la rendición.");
    }
  }, [cacheKey, canEdit, cycleId, online]);
  useEffect(() => {
    void load();
  }, [load, confirmation, attachmentState]);
  const act = async (action: () => Promise<void>, success: string): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar. Los datos se conservan.",
      );
    } finally {
      setBusy(false);
    }
  };
  const updateLine = (id: string, patch: Partial<RenditionLineInput>): void => {
    setLines((previous) => {
      const next = previous.map((l) => (l.category_id === id ? { ...l, ...patch } : l));
      try {
        localStorage.setItem(`${cacheKey}:draft`, JSON.stringify(next));
      } catch {
        setError("No se pudo conservar la hoja en este dispositivo.");
      }
      return next;
    });
    setReconciled(false);
  };
  const saveSummary = async (
    status: "draft" | "submitted" | "approved" | "observed",
  ): Promise<void> => {
    if (!data?.settlement)
      throw new Error("Prepara la rendición con conexión antes de guardar su hoja.");
    if (!reconciled && status !== "draft")
      throw new Error("Confirma que comparaste los importes con los registros existentes.");
    if (
      lines.some(
        (l) =>
          !Number.isFinite(l.declared) ||
          !Number.isFinite(l.recognized) ||
          l.declared < 0 ||
          l.recognized < 0,
      )
    )
      throw new Error("Revisa los importes de la hoja.");
    if (status === "draft") {
      await enqueueOperationCommand(
        database,
        makeOperationCommand({
          kind: "rendition",
          payload: {
            cycle_id: cycleId,
            settlement_id: data.settlement.id,
            occurred_at: new Date().toISOString(),
            lines,
            baseline: data.baseline,
            expected_version:
              (data.summary?.version ?? 0) +
              commands.filter((c) => c.status !== "confirmed").length,
            reason: reason || null,
          },
        }),
        { companyId, profileId, sourceDeviceId: getOrCreateDeviceId() },
      );
    } else {
      if (attachments.some((a) => a.status !== "uploaded"))
        throw new Error("Espera a que terminen de sincronizarse las fotografías.");
      await call("save_cycle_rendition", {
        p_settlement_id: data.settlement.id,
        p_lines: lines,
        p_baseline: data.baseline,
        p_status: status,
        p_expected_version: data.summary?.version ?? 0,
        p_reason: reason || null,
      });
    }
    if (status !== "draft") localStorage.removeItem(`${cacheKey}:draft`);
  };
  const queueFiles = async (files: readonly File[]): Promise<void> => {
    const settlementId = data?.settlement?.id;
    if (!settlementId) throw new Error("Prepara la rendición antes de adjuntar sus hojas.");
    for (const file of files) {
      const attachment = await persistEvidenceFile(file);
      try {
        const at = new Date().toISOString();
        await database.execute(
          `INSERT INTO attachment_queue (id,entity_type,entity_id,local_uri,original_name,mime_type,size_bytes,status,attempts,created_at,updated_at)
          VALUES (?,'settlement',?,?,?,?,?,'pending',0,?,?)`,
          [
            crypto.randomUUID(),
            settlementId,
            attachment.localUri,
            attachment.originalName,
            attachment.mimeType,
            attachment.sizeBytes,
            at,
            at,
          ],
        );
      } catch (cause) {
        await discardEvidenceFile(attachment.localUri);
        throw cause;
      }
    }
  };
  return (
    <section className="quick-workspace" aria-label="Cuenta del conductor">
      <header className="page-header">
        <div>
          <h1>Cuenta del conductor</h1>
          <p>Una rendición por toda la salida Cusco–Cusco.</p>
        </div>
      </header>
      {reportClient && (
        <CycleReportPanel
          key={cycleId}
          gateway={createSupabaseAdminDataGateway(reportClient)}
          cycleId={cycleId}
          settlementOnly
        />
      )}
      {error && (
        <p role="alert" className="admin-notice">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <Button variant="quiet" disabled={busy} onClick={() => void load()}>
        Actualizar cuenta
      </Button>
      {(!online || usingLocal) && (
        <p role="status">
          Sin conexión. Puedes preparar la hoja y guardar fotografías en este dispositivo. La
          revisión y el cierre requieren conexión.
        </p>
      )}
      {data && (
        <>
          <section className="admin-card">
            <h2>
              {data.cycle.code} ·{" "}
              {data.settlement?.status === "closed" ? "Rendición cerrada" : "Rendición pendiente"}
            </h2>
            <dl>
              <dt>Dinero entregado</dt>
              <dd>{money(data.total_advances)}</dd>
              <dt>Gastos reconocidos</dt>
              <dd>{money(data.expense_total)}</dd>
              <dt>Combustible pagado con el fondo del conductor</dt>
              <dd>{money(data.driver_fuel)}</dd>
              <dt>Combustible pagado por empresa</dt>
              <dd>{money(data.company_fuel)} · costo de la salida</dd>
              <dt>
                {data.remaining > 0
                  ? "El conductor debe devolver"
                  : data.remaining < 0
                    ? "La empresa debe reembolsar"
                    : "Cuenta saldada"}
              </dt>
              <dd>
                <strong>{money(Math.abs(data.remaining))}</strong>
              </dd>
            </dl>
            <p>Los cobros de los clientes se administran en Servicios y fletes.</p>
            <MoreDetails label="Revisar entregas de dinero">
              {(data.advances_list ?? []).map((a) => (
                <div key={`${a.id}:${a.version}`}>
                  <p>
                    {money(a.amount)} · {new Date(a.delivered_at).toLocaleDateString("es-PE")} ·{" "}
                    {a.status === "cancelled" ? "Anulado" : "Entregado"}
                  </p>
                  <MoneyCorrection
                    id={a.id}
                    version={a.version}
                    kind="advance"
                    amount={a.amount}
                    disabled={
                      !canEdit ||
                      !online ||
                      busy ||
                      data.settlement?.status === "closed" ||
                      a.status === "cancelled"
                    }
                    onSaved={load}
                  />
                </div>
              ))}
            </MoreDetails>
          </section>
          <section className="admin-card">
            <h2>Ya registrado en el recorrido</h2>
            <p>
              Revisa estos registros antes de transcribir la hoja. El combustible conserva su propio
              abastecimiento.
            </p>
            {[...data.expenses, ...data.fuel].map((row) => (
              <MovementReview
                key={`${row.id}:${row.updated_at}`}
                row={row}
                fuel={row.total_amount !== undefined}
                label={
                  row.category_id
                    ? (data.categories.find((c) => c.id === row.category_id)?.name ?? "Gasto")
                    : "Combustible"
                }
                disabled={!canEdit || !online || busy || data.settlement?.status === "closed"}
                onReview={(status, amount, note) =>
                  act(async () => {
                    await call(
                      row.total_amount !== undefined ? "review_cycle_fuel" : "review_expense",
                      row.total_amount !== undefined
                        ? {
                            p_id: row.id,
                            p_status: status,
                            p_amount: amount,
                            p_expected_updated_at: row.updated_at,
                            p_reason: note,
                          }
                        : {
                            expense_id: row.id,
                            validation_status: status,
                            approved_amount: amount,
                            note: note,
                          },
                    );
                  }, "Registro revisado.")
                }
              />
            ))}
            {data.expenses.length + data.fuel.length === 0 && (
              <p>Aún no hay gastos ni abastecimientos registrados.</p>
            )}
          </section>
          <section className="admin-card">
            <h2>Hojas y fotografías</h2>
            <MoreDetails label="Corregir importes registrados">
              {[...data.expenses, ...data.fuel].map((row) => (
                <div key={`${row.id}:${row.version}`}>
                  <p>
                    {row.description ?? (row.total_amount !== undefined ? "Combustible" : "Gasto")}{" "}
                    · {money(amountOf(row))}
                  </p>
                  <MoneyCorrection
                    id={row.id}
                    kind={row.total_amount !== undefined ? "fuel" : "expense"}
                    version={row.version}
                    amount={amountOf(row)}
                    disabled={!canEdit || !online || busy || data.settlement?.status === "closed"}
                    onSaved={load}
                  />
                </div>
              ))}
            </MoreDetails>
            <p>{data.evidence.length} archivo(s) confirmado(s).</p>
            {data.evidence.map((e) => (
              <EvidenceLink key={e.id} fileId={e.file_id} />
            ))}
            {attachments
              .filter((a) => a.status !== "uploaded")
              .map((a) => (
                <div key={a.id}>
                  <p>
                    {a.original_name} ·{" "}
                    {a.status === "failed"
                      ? `Requiere atención: ${a.last_error}`
                      : "Guardado en este dispositivo · pendiente de sincronizar"}
                  </p>
                  {canEdit && a.status === "failed" && a.attempts >= 5 && (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => retryFailedAttachment(database, a.id, true),
                          "Archivo preparado para reintentar el envío.",
                        )
                      }
                    >
                      Reintentar envío de {a.original_name}
                    </Button>
                  )}
                </div>
              ))}
            {canEdit && data.settlement?.status !== "closed" && (
              <label className="admin-field">
                <span>Agregar fotografías o PDF</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={busy}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void act(() => queueFiles(files), "Archivos guardados en este dispositivo.");
                  }}
                />
              </label>
            )}
          </section>
          <section className="admin-card">
            <h2>Resumen de la hoja</h2>
            <p>
              Escribe el total por categoría, incluyendo los gastos ya registrados. Solo la
              diferencia identificada se agrega a la cuenta.
            </p>
            <p>
              Estado:{" "}
              {data.summary?.status === "approved"
                ? "Aprobado"
                : data.summary?.status === "submitted"
                  ? "Presentado"
                  : data.summary?.status === "observed"
                    ? "Observado"
                    : "En preparación"}
              .
            </p>
            <div className="rendition-categories">
              {lines.map((line) => {
                const captured = data.expenses
                  .filter(
                    (e) => e.category_id === line.category_id && e.validation_status !== "rejected",
                  )
                  .reduce((sum, e) => sum + amountOf(e), 0);
                return (
                  <fieldset key={line.category_id}>
                    <legend>{data.categories.find((c) => c.id === line.category_id)?.name}</legend>
                    <p>
                      Ya registrado: {money(captured)} · adicional de la hoja:{" "}
                      {money(Math.max(0, line.declared - captured))}
                    </p>
                    <label className="admin-field">
                      <span>Total declarado en la hoja</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.declared}
                        disabled={!canEdit || data.settlement?.status === "closed"}
                        onChange={(e) =>
                          updateLine(line.category_id, {
                            declared: Number(e.target.value),
                            recognized: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <MoreDetails label="Revisar importe reconocido">
                      <label className="admin-field">
                        <span>Total reconocido</span>
                        <input
                          type="number"
                          min="0"
                          max={line.declared}
                          step="0.01"
                          value={line.recognized}
                          disabled={!canEdit || data.settlement?.status === "closed"}
                          onChange={(e) =>
                            updateLine(line.category_id, { recognized: Number(e.target.value) })
                          }
                        />
                      </label>
                      <Button
                        variant="quiet"
                        disabled={!canEdit || data.settlement?.status === "closed"}
                        onClick={() => updateLine(line.category_id, { recognized: line.declared })}
                      >
                        Reconocer el total de esta categoría
                      </Button>
                    </MoreDetails>
                    <label className="admin-field">
                      <span>Conceptos adicionales u observación</span>
                      <input
                        value={line.description}
                        disabled={!canEdit || data.settlement?.status === "closed"}
                        onChange={(e) =>
                          updateLine(line.category_id, { description: e.target.value })
                        }
                      />
                    </label>
                  </fieldset>
                );
              })}
            </div>
            {canEdit && data.settlement?.status !== "closed" && (
              <>
                {data.summary?.status === "approved" && (
                  <label className="admin-field">
                    <span>Motivo de corrección</span>
                    <input value={reason} onChange={(e) => setReason(e.target.value)} required />
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={reconciled}
                    onChange={(e) => setReconciled(e.target.checked)}
                  />{" "}
                  Comparé la hoja con los registros existentes; no estoy duplicando gastos ni
                  combustible.
                </label>
                <div className="operation-quick-actions">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => saveSummary("draft"),
                        "Hoja guardada en este dispositivo; pendiente de confirmación.",
                      )
                    }
                  >
                    Guardar preparación
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={!online || busy || commands.some((c) => c.status !== "confirmed")}
                    onClick={() => void act(() => saveSummary("submitted"), "Hoja presentada.")}
                  >
                    Presentar hoja
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={!online || busy || commands.some((c) => c.status !== "confirmed")}
                    onClick={() => void act(() => saveSummary("approved"), "Resumen aprobado.")}
                  >
                    Aprobar resumen
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={!online || busy || commands.some((c) => c.status !== "confirmed")}
                    onClick={() =>
                      void act(
                        () => saveSummary("observed"),
                        "Observaciones guardadas en las categorías indicadas.",
                      )
                    }
                  >
                    Observar categorías
                  </Button>
                </div>
              </>
            )}
          </section>
          <section className="admin-card">
            <h2>Devoluciones y reembolsos</h2>
            {data.payments.map((p) => (
              <div key={p.id}>
                <p>
                  {p.direction === "DRIVER_RETURNS"
                    ? "Devuelto por el conductor"
                    : "Reembolsado por la empresa"}
                  : {money(p.amount)} · {new Date(p.occurred_at).toLocaleDateString("es-PE")}
                  {p.cancelled_at ? " · anulado" : ""}
                </p>
                {!p.cancelled_at && (
                  <MoneyCorrection
                    id={p.id}
                    kind="balance_payment"
                    version={1}
                    amount={p.amount}
                    disabled={!canEdit || !online || busy || data.settlement?.status === "closed"}
                    onSaved={load}
                  />
                )}
              </div>
            ))}
            {canEdit &&
              data.settlement &&
              data.settlement.status !== "closed" &&
              data.remaining !== 0 && (
                <PaymentForm
                  key={`${data.settlement.id}:${data.remaining}`}
                  remaining={data.remaining}
                  disabled={!online || busy}
                  onSave={(args) =>
                    act(async () => {
                      await call("record_cycle_balance_payment", {
                        ...args,
                        p_settlement_id: data.settlement!.id,
                        p_expected_remaining: data.remaining,
                      });
                    }, "Pago registrado. El remanente se conserva en esta salida.")
                  }
                />
              )}
            {canEdit && data.settlement?.status !== "closed" && (
              <Button
                disabled={
                  !online ||
                  busy ||
                  data.remaining !== 0 ||
                  attachments.some((a) => a.status !== "uploaded")
                }
                onClick={() =>
                  void act(async () => {
                    await call("close_cycle_settlement", {
                      p_settlement_id: data.settlement?.id,
                      p_resolution_method: null,
                      p_resolution_reference: null,
                      p_resolution_note: null,
                    });
                  }, "Rendición cerrada con recálculo del servidor.")
                }
              >
                Cerrar rendición
              </Button>
            )}
            {role === "management" && data.settlement?.status === "closed" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(async () => {
                    await call("reopen_cycle_settlement", {
                      p_settlement_id: data.settlement?.id,
                      p_reason: reason,
                    });
                  }, "Rendición reabierta; se conservan los pagos anteriores.");
                }}
              >
                <label className="admin-field">
                  <span>Motivo de reapertura</span>
                  <input value={reason} required onChange={(e) => setReason(e.target.value)} />
                </label>
                <Button type="submit" disabled={!online || busy}>
                  Reabrir rendición
                </Button>
              </form>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function MovementReview({
  row,
  label,
  fuel,
  disabled,
  onReview,
}: {
  readonly row: Movement;
  readonly label: string;
  readonly fuel: boolean;
  readonly disabled: boolean;
  readonly onReview: (status: string, amount: number | null, note: string | null) => Promise<void>;
}): React.JSX.Element {
  const [amount, setAmount] = useState(Number(row.approved_amount ?? amountOf(row)));
  const [note, setNote] = useState("");
  return (
    <article className="admin-list-row">
      <div>
        <strong>
          {label} · {money(amountOf(row))}
        </strong>
        <p>
          {row.description}{" "}
          {fuel
            ? row.payment_source === "driver_fund"
              ? "Pagado con fondo del conductor"
              : "Pagado por empresa"
            : ""}
        </p>
        <p>
          {row.validation_status === "validated"
            ? `Reconocido: ${money(recognizedOf(row))}`
            : row.validation_status === "rejected"
              ? "Rechazado"
              : row.validation_status === "observed"
                ? "Observado"
                : "Pendiente de revisión"}
        </p>
        <MoreDetails label="Revisar este registro">
          <label className="admin-field">
            <span>Importe reconocido</span>
            <input
              type="number"
              min="0"
              max={amountOf(row)}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={disabled}
            />
          </label>
          <label className="admin-field">
            <span>Motivo de observación o corrección</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} disabled={disabled} />
          </label>
          <div className="operation-quick-actions">
            <Button
              disabled={disabled}
              onClick={() => void onReview("validated", amount, note || null)}
            >
              Reconocer
            </Button>
            <Button
              disabled={disabled}
              variant="quiet"
              onClick={() => void onReview("observed", null, note || null)}
            >
              Observar
            </Button>
            <Button
              disabled={disabled}
              variant="quiet"
              onClick={() => void onReview("rejected", null, note || null)}
            >
              Rechazar
            </Button>
          </div>
        </MoreDetails>
      </div>
    </article>
  );
}
function PaymentForm({
  remaining,
  disabled,
  onSave,
}: {
  readonly remaining: number;
  readonly disabled: boolean;
  readonly onSave: (args: Record<string, unknown>) => Promise<void>;
}): React.JSX.Element {
  const [id] = useState(() => crypto.randomUUID());
  const submit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void onSave({
      p_id: id,
      p_direction: remaining > 0 ? "DRIVER_RETURNS" : "COMPANY_REIMBURSES",
      p_amount: Number(f.get("amount")),
      p_method: String(f.get("method")),
      p_reference: String(f.get("reference") || "") || null,
      p_occurred_at: new Date(String(f.get("occurred_at"))).toISOString(),
    });
  };
  return (
    <form className="admin-form" onSubmit={submit}>
      <h3>
        {remaining > 0
          ? "Registrar dinero devuelto por el conductor"
          : "Registrar reembolso al conductor"}
      </h3>
      <label className="admin-field">
        <span>Importe realmente pagado</span>
        <input
          name="amount"
          type="number"
          required
          min="0.01"
          max={Math.abs(remaining)}
          step="0.01"
        />
      </label>
      <label className="admin-field">
        <span>Fecha del pago</span>
        <input name="occurred_at" type="datetime-local" required defaultValue={localTime()} />
      </label>
      <label className="admin-field">
        <span>Medio</span>
        <select name="method">
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
          <option value="deposit">Depósito</option>
        </select>
      </label>
      <label className="admin-field">
        <span>Referencia (opcional)</span>
        <input name="reference" />
      </label>
      <Button type="submit" disabled={disabled}>
        Registrar pago
      </Button>
    </form>
  );
}
function EvidenceLink({ fileId }: { readonly fileId: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("Hoja de gastos");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <>
      <Button
        variant="quiet"
        onClick={() => {
          const client = getSupabaseClient();
          if (!client) return;
          void createSupabaseAdminDataGateway(client)
            .loadPrivateFile(fileId)
            .then((file) => {
              setUrl(URL.createObjectURL(file.blob));
              setName(file.originalName);
              setError(null);
            })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo."),
            );
        }}
      >
        Ver hoja adjunta
      </Button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir {name}
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function MoneyCorrection({
  id,
  version,
  kind,
  amount,
  disabled,
  onSaved,
}: {
  readonly id: string;
  readonly version: number;
  readonly kind: string;
  readonly amount: number;
  readonly disabled: boolean;
  readonly onSaved: () => Promise<void>;
}): React.JSX.Element {
  const [requestId] = useState(() => crypto.randomUUID()),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <details className="operation-more-details">
      <summary>Corregir o anular con motivo</summary>
      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          void call("correct_cycle_money", {
            p_request_id: requestId,
            p_kind: kind,
            p_id: id,
            p_expected_version: version,
            p_amount: Number(f.get("amount") ?? amount),
            p_cancel: f.get("cancel") === "on",
            p_reason: String(f.get("reason")),
          })
            .then(onSaved)
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "No se pudo corregir."),
            )
            .finally(() => setBusy(false));
        }}
      >
        {kind !== "balance_payment" && (
          <label className="admin-field">
            <span>Importe correcto</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={amount}
              required
            />
          </label>
        )}
        <label>
          <input name="cancel" type="checkbox" required={kind === "balance_payment"} /> Anular este
          registro por error de captura
        </label>
        <label className="admin-field">
          <span>Motivo</span>
          <input name="reason" required minLength={3} />
        </label>
        <p>
          Se conservará el registro original y el motivo. Una anulación por error no representa una
          devolución de dinero.
        </p>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={disabled || busy}>
          Guardar corrección
        </Button>
      </form>
    </details>
  );
}
