import { usePowerSync } from "@powersync/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/primitives/Button";
import { Icon } from "../../components/primitives/Icon";
import { powerSyncIdentityStore } from "../../lib/powersync/identity-store";
import {
  actionFromSearch,
  cycleIdentity,
  cycleNextStep,
  cycleStateLabel,
  matchesSearch,
  outingPath,
  possibleDuplicate,
  PossibleDuplicateError,
  type QuickAction,
} from "./workspace-model";
import { useOperationActivity } from "./useOperationActivity";
import { CaptureAssistance } from "./CaptureAssistance";
import { getOrCreateDeviceId } from "../driver-ui/device-and-evidence";
import type {
  AdminDataGateway,
  AdminOperationalCycleRow,
  AdminTripSetupOptions,
  AdminWriteContext,
  AdminOption,
} from "../admin-ui/admin-data";
import { MoreDetails } from "./OperationModeProvider";
import { CycleCaptureChannel } from "./CycleCaptureChannel";
import { CycleReportPanel } from "../reports/CycleReportPanel";
import {
  enqueueOperationCommand,
  makeOperationCommand,
  operationCommandLabel,
  operationCommandSummary,
  operationMovementId,
  type FuelInput,
  type OperationCommandBody,
  type ServiceInput,
} from "./operation-command";

function nowInput(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}
function optional(form: FormData, name: string): string | null {
  return text(form, name) || null;
}
function amount(form: FormData, name: string): number {
  const raw = text(form, name);
  const n = Number(raw);
  if (!raw || !Number.isFinite(n) || n <= 0)
    throw new Error("Revisa los importes: deben ser mayores que cero.");
  return n;
}
function occurredAt(form: FormData): string {
  return new Date(text(form, "occurred_at")).toISOString();
}

function service(form: FormData): ServiceInput {
  return {
    client_id: text(form, "client_id"),
    origin: text(form, "origin"),
    destination: text(form, "destination"),
    cargo_description: text(form, "cargo_description"),
    cargo_tons: text(form, "cargo_tons") ? amount(form, "cargo_tons") : null,
    freight_amount: text(form, "freight_amount") ? amount(form, "freight_amount") : null,
    leg_kind:
      text(form, "leg_kind") === "return"
        ? "return"
        : text(form, "leg_kind") === "continuation"
          ? "continuation"
          : "outbound",
  };
}
function fuel(form: FormData, id: string): FuelInput {
  const quantity = amount(form, "quantity"),
    total = amount(form, "total_amount");
  const odometer = optional(form, "odometer_km");
  if (odometer !== null && (!Number.isFinite(Number(odometer)) || Number(odometer) < 0))
    throw new Error("Revisa el kilometraje indicado.");
  return {
    id,
    quantity,
    total_amount: total,
    unit_price: Math.round((total / quantity) * 10_000) / 10_000,
    volume_unit: text(form, "volume_unit") === "liter" ? "liter" : "gallon",
    payment_source: text(form, "payment_source") === "driver_fund" ? "driver_fund" : "company",
    odometer_km: odometer === null ? null : Number(odometer),
  };
}

export function QuickWorkspace({
  gateway,
  context,
  initialAction,
  compact = false,
  scheduledOnly = false,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly initialAction?: QuickAction | undefined;
  readonly compact?: boolean;
  readonly scheduledOnly?: boolean;
}): React.JSX.Element {
  const database = usePowerSync();
  const navigate = useNavigate();
  const workspaceRef = useRef<HTMLElement>(null);
  const [search, setSearch] = useSearchParams();
  const [cycles, setCycles] = useState<readonly AdminOperationalCycleRow[]>([]);
  const [options, setOptions] = useState<AdminTripSetupOptions | null>(null);
  const [categories, setCategories] = useState<readonly AdminOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<AdminOperationalCycleRow | null>(null);
  const [limit, setLimit] = useState(20);
  const commands = useOperationActivity(context.companyId);
  const confirmation = commands.map((c) => `${c.id}:${c.status}`).join(",");
  const action = compact
    ? (initialAction ?? null)
    : (actionFromSearch(search) ?? initialAction ?? null);
  const reload = useCallback(async () => {
    try {
      setCycles(await gateway.listOperationalCycles());
      setError(null);
    } catch {
      setError("No se pudieron consultar las salidas. Vuelve a intentarlo.");
    } finally {
      setLoading(false);
    }
  }, [gateway]);
  useEffect(() => {
    void reload();
  }, [reload, confirmation]);
  useEffect(() => {
    let current = true;
    setFormError(null);
    if (action === "departure" || action === "service") {
      void gateway
        .loadTripSetupOptions()
        .then((data) => {
          if (current) setOptions(data);
        })
        .catch(() => {
          if (current)
            setFormError("No se pudieron preparar las unidades, conductores y clientes.");
        });
    }
    if (action === "expense") {
      void gateway
        .loadStaffCaptureOptions()
        .then((data) => {
          if (current) setCategories(data.expenseCategories);
        })
        .catch(() => {
          if (current) setFormError("No se pudieron consultar las categorías de gasto.");
        });
    }
    return () => {
      current = false;
    };
  }, [gateway, action]);
  const pendingCycles = commands.filter(
    (c) =>
      c.kind === "departure" &&
      c.status !== "confirmed" &&
      !cycles.some((cycle) => cycle.id === c.id),
  );
  const currentCycles = cycles.filter(
    (cycle) => (cycle.status === "active" || cycle.status === "planned") && !cycle.returnedAt,
  );
  // An explicit choice always wins; only prefill when the current context is unambiguous.
  const suggestedId =
    action && action !== "departure" && currentCycles.length === 1 && pendingCycles.length === 0
      ? (currentCycles[0]?.id ?? "")
      : "";
  const selectedId = search.get("salida") ?? suggestedId;
  useEffect(() => {
    if (!compact && (selectedId || action))
      workspaceRef.current?.scrollIntoView({ block: "start" });
  }, [compact, selectedId, action]);
  const selected = cycles.find((cycle) => cycle.id === selectedId);
  const pendingSelected = pendingCycles.find((cycle) => cycle.id === selectedId);
  const visibleCommands = commands.filter(
    (command) =>
      (!selectedId || command.id === selectedId || command.dependency_id === selectedId) &&
      (!compact || command.kind === action),
  );
  const updateSearch = (name: string, value: string): void => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set(name, value);
      return next;
    });
  };
  const selectCycle = (id: string): void => updateSearch("salida", id);
  const chooseAction = (next: QuickAction): void => {
    setSearch((previous) => {
      const params = new URLSearchParams(previous);
      const actionParam = new URLSearchParams(outingPath(undefined, next).split("?")[1]).get(
        "accion",
      );
      params.set("accion", actionParam ?? "");
      if (next === "departure") params.delete("salida");
      else if (selectedId) params.set("salida", selectedId);
      return params;
    });
    if (next === "departure") setRepeat(null);
  };
  const save = async (
    body: OperationCommandBody,
    id: string,
    duplicateConfirmed = false,
  ): Promise<void> => {
    const duplicate = possibleDuplicate(body, id, commands);
    if (duplicate && !duplicateConfirmed) throw new PossibleDuplicateError(duplicate);
    await database.init();
    if (powerSyncIdentityStore.read() !== context.profileId)
      throw new Error(
        "Se está preparando el guardado local. Espera unos segundos e inténtalo nuevamente.",
      );
    await enqueueOperationCommand(database, makeOperationCommand(body, id), {
      ...context,
      sourceDeviceId: getOrCreateDeviceId(),
    });
    if (body.kind === "departure") navigate(outingPath(id));
  };
  const status = search.get("estado") ?? (scheduledOnly ? "planned" : "");
  const query = search.get("q") ?? "";
  const filteredCycles = cycles.filter(
    (cycle) =>
      (!status ||
        (status === "returned"
          ? Boolean(cycle.returnedAt) || cycle.status === "completed"
          : cycle.status === status && (status !== "active" || !cycle.returnedAt))) &&
      matchesSearch(
        `${cycle.title} ${cycle.description} ${cycle.notes ?? ""} ${cycle.date ?? ""} ${cycle.date ? new Date(cycle.date).toLocaleDateString("es-PE") : ""} ${cycleStateLabel(cycle)}`,
        query,
      ),
  );
  const canRecord = selected?.status !== "cancelled";
  return (
    <section
      ref={workspaceRef}
      className="quick-workspace"
      aria-label={compact ? "Registrar movimiento" : "Salidas"}
    >
      {!compact && (
        <header className="operation-page-heading">
          <div>
            <h1>{scheduledOnly ? "Salidas programadas" : "Salidas"}</h1>
            <p>Un recorrido de la unidad, desde la partida hasta el regreso a Cusco.</p>
          </div>
          {selectedId || action ? (
            <Link className="button button--quiet" to={outingPath()}>
              Volver a salidas
            </Link>
          ) : (
            <Button icon="truck" onClick={() => chooseAction("departure")}>
              Registrar salida
            </Button>
          )}
        </header>
      )}
      {error && (
        <p className="admin-notice" role="alert">
          {error}{" "}
          <Button variant="quiet" onClick={() => void reload()}>
            Volver a cargar
          </Button>
        </p>
      )}
      {loading && <p role="status">Consultando salidas…</p>}
      {action === "departure" && (
        <section className="admin-card">
          {options ? (
            <DepartureForm
              gateway={gateway}
              cycles={cycles}
              key={repeat?.id ?? "new"}
              context={context}
              options={options}
              repeat={repeat}
              onSave={save}
            />
          ) : (
            <p role="status">Preparando el formulario…</p>
          )}
        </section>
      )}
      {action !== null && action !== "departure" && (
        <section className="admin-card operation-capture-context">
          <label className="admin-field">
            <span>Salida de la unidad</span>
            <select
              value={selectedId}
              onChange={(event) => selectCycle(event.target.value)}
              required
            >
              <option value="">Selecciona la salida</option>
              {cycles
                .filter((cycle) => cycle.status !== "cancelled")
                .map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.title} · {cycle.description} · {cycleStateLabel(cycle)}
                  </option>
                ))}
              {pendingCycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  Salida guardada en este dispositivo · {cycle.id.slice(0, 6)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <p className="operation-context-note">
              {selected.description} · {cycleStateLabel(selected)}
            </p>
          )}
          {pendingSelected && (
            <p className="operation-context-note">
              Salida guardada aquí; todavía requiere confirmación.
            </p>
          )}
          {!loading && cycles.length === 0 && pendingCycles.length === 0 && (
            <p>
              Primero necesitas una salida.{" "}
              <Link to={outingPath(undefined, "departure")}>Registrar salida</Link>
            </p>
          )}
          {selectedId && !selected && !pendingSelected && !loading && (
            <p role="alert">Esta salida no está disponible. Selecciona una de la lista.</p>
          )}
          {selected?.status === "cancelled" && (
            <p>La salida está cancelada. Puedes consultar su historial.</p>
          )}
          {selectedId && (selected || pendingSelected) && canRecord && (
            <MovementForm
              gateway={gateway}
              vehicleId={selected?.vehicleId}
              key={`${selectedId}:${action}`}
              context={context}
              cycleId={selectedId}
              action={action}
              options={options}
              categories={categories}
              onSave={save}
            />
          )}
        </section>
      )}
      {formError && (
        <p className="admin-notice" role="alert">
          {formError}
        </p>
      )}
      {!compact && selected && action !== "departure" && (
        <section className="admin-card quick-cycle-detail">
          <div className="admin-card__heading quick-cycle-detail__heading">
            <div>
              <h2>{cycleIdentity(selected)}</h2>
              <p>
                {selected.notes ? `${selected.notes} · ` : ""}
                {selected.title}
              </p>
            </div>
            <span>{cycleStateLabel(selected)}</span>
          </div>
          {canRecord && (
            <div className="operation-quick-actions" aria-label="Acciones de esta salida">
              {selected.status === "planned" && (
                <Button onClick={() => chooseAction("start")}>Registrar partida</Button>
              )}
              {selected.status === "active" && !selected.returnedAt && (
                <Button onClick={() => chooseAction("return")}>Registrar regreso a Cusco</Button>
              )}
              <Button variant="secondary" icon="money" onClick={() => chooseAction("advance")}>
                Entregar dinero
              </Button>
              <Button variant="secondary" icon="file" onClick={() => chooseAction("expense")}>
                Registrar gasto
              </Button>
              <Button variant="secondary" icon="fuel" onClick={() => chooseAction("fuel")}>
                Registrar combustible
              </Button>
              {(selected.status === "active" || selected.status === "planned") &&
                !selected.returnedAt && (
                  <Button variant="quiet" onClick={() => chooseAction("service")}>
                    Agregar servicio
                  </Button>
                )}
              {selected.primaryDriverId && (
                <OpenSettlement
                  gateway={gateway}
                  cycleId={selected.id}
                  driverId={selected.primaryDriverId}
                />
              )}
            </div>
          )}
          {(selected.returnedAt || selected.status === "completed") && (
            <p className="operation-context-note">
              El regreso y la cuenta se revisan por separado. Consulta los servicios y la rendición
              de esta salida.
            </p>
          )}
          <CycleServices
            gateway={gateway}
            cycleId={selected.id}
            confirmation={confirmation}
            onSave={save}
            context={context}
          />
          <MoreDetails label="Cuenta, documentos y opciones de la salida">
            <CycleCaptureChannel cycleId={selected.id} />
            <CycleReportPanel key={selected.id} gateway={gateway} cycleId={selected.id} />
          </MoreDetails>
        </section>
      )}
      {!compact && action !== "departure" && (!selectedId || pendingSelected) && (
        <section className="quick-outings" aria-labelledby="quick-outings-title">
          <div className="quick-section-heading">
            <h2 id="quick-outings-title">{selected ? "Otras salidas" : "Salidas registradas"}</h2>
            <span>{filteredCycles.length}</span>
          </div>
          <div className="operation-list-filters">
            <label className="admin-field">
              <span>Buscar salida</span>
              <input
                type="search"
                value={query}
                placeholder="Placa, conductor, fecha o recorrido"
                onChange={(event) => {
                  updateSearch("q", event.target.value);
                  setLimit(20);
                }}
              />
            </label>
            <label className="admin-field">
              <span>Estado</span>
              <select
                value={status}
                onChange={(event) => {
                  updateSearch("estado", event.target.value);
                  setLimit(20);
                }}
              >
                <option value="">Todas</option>
                <option value="active">En recorrido</option>
                <option value="planned">Programadas</option>
                <option value="returned">Con regreso registrado</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </label>
          </div>
          {pendingCycles.map((cycle) => (
            <article className="quick-outing-card quick-outing-card--pending" key={cycle.id}>
              <div>
                <strong>Salida por confirmar</strong>
                <p>{cycle.error_message ?? "Guardada en este dispositivo"}</p>
              </div>
              <Button variant="secondary" onClick={() => selectCycle(cycle.id)}>
                Ver salida
              </Button>
            </article>
          ))}
          {pendingSelected && !action && (
            <div className="operation-quick-actions">
              <Button variant="secondary" onClick={() => chooseAction("advance")}>
                Entregar dinero
              </Button>
              <Button variant="secondary" onClick={() => chooseAction("expense")}>
                Registrar gasto
              </Button>
              <Button variant="secondary" onClick={() => chooseAction("fuel")}>
                Registrar combustible
              </Button>
            </div>
          )}
          {!loading && !error && filteredCycles.length === 0 && (
            <p className="quick-outings__empty">
              {cycles.length === 0
                ? "Todavía no hay salidas registradas. Puedes registrar una sin conocer el cliente o el primer flete."
                : "No hay salidas con estos filtros."}
            </p>
          )}
          {filteredCycles.slice(0, limit).map((cycle) => (
            <article className="quick-outing-card" key={cycle.id}>
              <div className="quick-outing-card__date">
                <Icon name="calendar" size={17} />
                <span>
                  {cycle.date
                    ? new Date(cycle.date).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "short",
                      })
                    : "Sin fecha"}
                </span>
              </div>
              <div className="quick-outing-card__main">
                <strong>{cycleIdentity(cycle)}</strong>
                <p>
                  {cycle.notes ? `${cycle.notes} · ` : ""}
                  {cycle.title}
                </p>
              </div>
              <span
                className={`quick-outing-card__status quick-outing-card__status--${cycle.status}`}
              >
                {cycleStateLabel(cycle)}
              </span>
              <div className="admin-row-buttons">
                <Link
                  className="button button--secondary"
                  to={outingPath(cycle.id, cycleNextStep(cycle).action ?? undefined)}
                >
                  {cycleNextStep(cycle).label}
                </Link>
                <Button
                  variant="quiet"
                  onClick={() => {
                    chooseAction("departure");
                    setRepeat(cycle);
                  }}
                >
                  Repetir salida
                </Button>
              </div>
            </article>
          ))}
          {filteredCycles.length > limit && (
            <Button variant="quiet" onClick={() => setLimit((value) => value + 20)}>
              Mostrar más salidas
            </Button>
          )}
        </section>
      )}
      {visibleCommands.length > 0 && (
        <section className="quick-activity" aria-labelledby="quick-activity-title">
          <div className="quick-section-heading">
            <h2 id="quick-activity-title">
              {selectedId ? "Actividad de esta salida" : "Actividad reciente"}
            </h2>
          </div>
          {visibleCommands.slice(0, 8).map((command) => (
            <article className="quick-activity-item" key={command.id}>
              <span
                aria-hidden="true"
                className={`quick-activity-item__marker quick-activity-item__marker--${command.status}`}
              />
              <div className="quick-activity-item__body">
                <strong>{operationCommandLabel(command.kind)}</strong>
                <p>{operationCommandSummary(command.payload)}</p>
              </div>
              <div className="quick-activity-item__meta">
                <time dateTime={command.created_at}>
                  {new Date(command.created_at).toLocaleString("es-PE")}
                </time>
                <span role="status">
                  {command.error_message
                    ? `Requiere atención: ${command.error_message}`
                    : command.status === "confirmed"
                      ? "Confirmado"
                      : "Pendiente de confirmación"}
                </span>
                {command.error_message && <Link to="/sincronizacion">Revisar registro</Link>}
              </div>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}

export function FinanceCapture({
  gateway,
  context,
  action,
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly action: "advance" | "expense" | "fuel";
}): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const open = params.get("registrar") === "1";
  const label =
    action === "advance"
      ? "Entregar dinero"
      : action === "expense"
        ? "Registrar gasto"
        : "Registrar combustible";
  return (
    <section className="finance-capture">
      <Button
        variant={open ? "quiet" : "primary"}
        aria-expanded={open}
        onClick={() =>
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            if (open) next.delete("registrar");
            else next.set("registrar", "1");
            return next;
          })
        }
      >
        {open ? "Volver a los registros" : label}
      </Button>
      {open && (
        <QuickWorkspace
          key={action}
          gateway={gateway}
          context={context}
          compact
          initialAction={action}
        />
      )}
    </section>
  );
}
function OpenSettlement({
  gateway,
  cycleId,
  driverId,
}: {
  readonly gateway: AdminDataGateway;
  readonly cycleId: string;
  readonly driverId: string;
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant="quiet"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void gateway
            .createCycleSettlement({ id: crypto.randomUUID(), cycleId, driverId, notes: null })
            .then(() => {
              globalThis.location.assign(`/finanzas/rendiciones?salida=${cycleId}`);
            })
            .catch((cause: unknown) =>
              setError(cause instanceof Error ? cause.message : "La rendición requiere conexión."),
            )
            .finally(() => setBusy(false));
        }}
      >
        Rendir gastos
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}

function CycleServices({
  gateway,
  cycleId,
  confirmation,
  onSave,
  context,
}: {
  readonly gateway: AdminDataGateway;
  readonly cycleId: string;
  readonly confirmation: string;
  readonly onSave: (
    body: OperationCommandBody,
    id: string,
    duplicateConfirmed?: boolean,
  ) => Promise<void>;
  readonly context: AdminWriteContext;
}): React.JSX.Element {
  const [trips, setTrips] = useState<
    Awaited<ReturnType<AdminDataGateway["loadOperationalCycleDetail"]>>["trips"]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let current = true;
    setLoaded(false);
    setLoadError(false);
    void gateway
      .loadOperationalCycleDetail(cycleId)
      .then((data) => {
        if (current) {
          setTrips(data.trips);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (current) setLoadError(true);
      });
    return () => {
      current = false;
    };
  }, [gateway, cycleId, confirmation]);
  return (
    <div>
      <h3>Servicios y fletes</h3>
      {loadError ? (
        <p role="alert">
          No se pudieron consultar los servicios de esta salida. Vuelve a abrirla para intentarlo de
          nuevo.
        </p>
      ) : !loaded ? (
        <p role="status">Consultando servicios…</p>
      ) : trips.length === 0 ? (
        <p>Sin servicios comerciales. La cuenta del conductor sigue disponible.</p>
      ) : (
        trips.map((trip) => (
          <div key={trip.id} className="admin-list-row">
            <Link to={`/viajes/${trip.id}/resumen`}>{trip.title}</Link>
            <span>{trip.status}</span>
            {!/complet|cancel/i.test(trip.status) && (
              <Button variant="quiet" onClick={() => setSelected(trip.id)}>
                Registrar entrega
              </Button>
            )}
          </div>
        ))
      )}
      {selected && (
        <PersistentForm
          draftKey={`${context.profileId}:deliver:${selected}`}
          title="Entrega del servicio"
          onSave={async (form, id) => {
            await onSave(
              {
                kind: "service_complete",
                payload: {
                  cycle_id: cycleId,
                  trip_id: selected,
                  occurred_at: occurredAt(form),
                  cargo_delivered: true,
                },
              },
              id,
            );
            setSelected(null);
          }}
        >
          <Input
            label="Fecha y hora de entrega"
            name="occurred_at"
            type="datetime-local"
            defaultValue={nowInput()}
            required
          />
          <label className="admin-checkbox">
            <input type="checkbox" required />
            Confirmo que la carga de este servicio fue entregada
          </label>
        </PersistentForm>
      )}
    </div>
  );
}

function DepartureForm({
  gateway,
  cycles,
  context,
  options,
  repeat,
  onSave,
}: {
  readonly gateway: AdminDataGateway;
  readonly cycles: readonly AdminOperationalCycleRow[];
  readonly context: AdminWriteContext;
  readonly options: AdminTripSetupOptions;
  readonly repeat: AdminOperationalCycleRow | null;
  readonly onSave: (
    body: OperationCommandBody,
    id: string,
    duplicateConfirmed?: boolean,
  ) => Promise<void>;
}): React.JSX.Element {
  const storedFields = loadDraft(
    `rt-sitram:operation-draft:v1:${context.profileId}:departure:${repeat?.id ?? "new"}`,
  ).fields;
  const [withService, setWithService] = useState(storedFields.with_service === "on"),
    [withFuel, setWithFuel] = useState(storedFields.with_fuel === "on");
  return (
    <PersistentForm
      draftKey={`${context.profileId}:departure:${repeat?.id ?? "new"}`}
      title="Registrar salida"
      onSaved={() => {
        setWithFuel(false);
        setWithService(false);
      }}
      onSave={(form, id, duplicateConfirmed) =>
        onSave(
          {
            kind: "departure",
            payload: {
              vehicle_id: text(form, "vehicle_id"),
              driver_id: text(form, "driver_id"),
              status: text(form, "status") === "planned" ? "planned" : "active",
              capture_channel:
                text(form, "capture_channel") === "driver_app" ? "driver_app" : "office",
              occurred_at: occurredAt(form),
              notes: optional(form, "notes"),
              advance: text(form, "advance_amount")
                ? {
                    id: operationMovementId(id, 1),
                    amount: amount(form, "advance_amount"),
                    method: text(form, "method"),
                  }
                : null,
              fuel:
                text(form, "with_fuel") === "on" ? fuel(form, operationMovementId(id, 2)) : null,
              service: text(form, "with_service") === "on" ? service(form) : null,
            },
          },
          id,
          duplicateConfirmed,
        )
      }
    >
      {repeat && (
        <p className="admin-form-note">
          Revisa la unidad, el conductor y el recorrido sugeridos. Confirma la fecha y registra los
          importes de esta nueva salida.
        </p>
      )}
      <Select
        label="Unidad"
        name="vehicle_id"
        options={options.vehicles}
        defaultValue={repeat?.vehicleId ?? undefined}
        required
      />
      <Select
        label="Conductor responsable"
        name="driver_id"
        options={options.drivers}
        defaultValue={repeat?.primaryDriverId ?? undefined}
        required
      />
      <label className="admin-field">
        <span>Estado</span>
        <select name="status" defaultValue="active">
          <option value="active">Ya salió de Cusco</option>
          <option value="planned">Salida programada</option>
        </select>
      </label>
      <Input
        label="Fecha y hora"
        name="occurred_at"
        type="datetime-local"
        defaultValue={nowInput()}
        required
      />
      <Input
        label="Recorrido conocido (opcional)"
        name="notes"
        defaultValue={repeat?.notes ?? undefined}
        placeholder="Cusco → Lima → Cusco"
      />
      <Input
        label="Dinero entregado al conductor (S/, opcional)"
        name="advance_amount"
        type="number"
      />
      <MoreDetails label="Detalles de la entrega">
        <PaymentMethod />
        <label className="admin-field">
          <span>Quién registrará la actividad del recorrido</span>
          <select name="capture_channel">
            <option value="office">Oficina</option>
            <option value="driver_app">Conductor desde su aplicación</option>
          </select>
        </label>
      </MoreDetails>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          name="with_fuel"
          checked={withFuel}
          onChange={(event) => setWithFuel(event.target.checked)}
        />
        Registrar combustible junto con la salida
      </label>
      {withFuel && <FuelFields />}
      <label className="admin-checkbox">
        <input
          type="checkbox"
          name="with_service"
          checked={withService}
          onChange={(event) => setWithService(event.target.checked)}
        />
        Ya conozco el primer servicio y su cliente
      </label>
      {withService && <ServiceFields options={options} />}
      <CaptureAssistance gateway={gateway} kind="departure" cycles={cycles} />
      {withFuel && <CaptureAssistance gateway={gateway} kind="fuel" />}
    </PersistentForm>
  );
}

export function MovementForm({
  gateway,
  vehicleId,
  context,
  cycleId,
  action,
  options,
  categories,
  onSave,
}: {
  readonly gateway?: AdminDataGateway;
  readonly vehicleId?: string | null | undefined;
  readonly context: AdminWriteContext;
  readonly cycleId: string;
  readonly action: Exclude<QuickAction, "departure">;
  readonly options: AdminTripSetupOptions | null;
  readonly categories: readonly AdminOption[];
  readonly onSave: (
    body: OperationCommandBody,
    id: string,
    duplicateConfirmed?: boolean,
  ) => Promise<void>;
}): React.JSX.Element {
  return (
    <PersistentForm
      draftKey={`${context.profileId}:${action}:${cycleId}`}
      title={
        action === "return"
          ? "Registrar regreso a Cusco"
          : action === "start"
            ? "Registrar partida"
            : operationCommandLabel(action)
      }
      onSave={(form, id, duplicateConfirmed) => {
        const common = { cycle_id: cycleId, occurred_at: occurredAt(form) };
        if (action === "advance")
          return onSave(
            {
              kind: action,
              payload: {
                ...common,
                amount: amount(form, "amount"),
                method: text(form, "method"),
                description: optional(form, "description"),
              },
            },
            id,
            duplicateConfirmed,
          );
        if (action === "expense")
          return onSave(
            {
              kind: action,
              payload: {
                ...common,
                category_id: text(form, "category_id"),
                amount: amount(form, "amount"),
                description: optional(form, "description"),
              },
            },
            id,
            duplicateConfirmed,
          );
        if (action === "fuel")
          return onSave(
            { kind: action, payload: { ...common, ...fuel(form, id) } },
            id,
            duplicateConfirmed,
          );
        if (action === "service")
          return onSave({ kind: action, payload: { ...common, ...service(form) } }, id);
        return onSave({ kind: action, payload: common }, id);
      }}
    >
      <Input
        label="Fecha y hora del hecho"
        name="occurred_at"
        type="datetime-local"
        defaultValue={nowInput()}
        required
      />
      {action === "service" && options && <ServiceFields options={options} />}
      {(action === "advance" || action === "expense") && (
        <Input label="Importe (S/)" name="amount" type="number" required />
      )}
      {action === "advance" && <PaymentMethod />}
      {action === "expense" && (
        <Select label="Categoría" name="category_id" options={categories} required />
      )}
      {(action === "expense" || action === "advance") && (
        <Input
          label={
            action === "expense"
              ? "Descripción (necesaria para Otros gastos)"
              : "Concepto (opcional)"
          }
          name="description"
        />
      )}
      {action === "fuel" && <FuelFields />}
      {gateway && (action === "fuel" || action === "expense") && (
        <CaptureAssistance gateway={gateway} kind={action} vehicleId={vehicleId} />
      )}
      {action === "return" && (
        <p>
          La llegada a Cusco se registra ahora. La cuenta del conductor se revisa y resuelve en
          Rendir gastos.
        </p>
      )}
    </PersistentForm>
  );
}

function ServiceFields({
  options,
}: {
  readonly options: AdminTripSetupOptions;
}): React.JSX.Element {
  return (
    <fieldset className="admin-field--wide">
      <legend>Servicio comercial</legend>
      <div className="admin-form__fields">
        <Select label="Cliente" name="client_id" options={options.clients} required />
        <Input label="Origen" name="origin" required />
        <Input label="Destino" name="destination" required />
        <Input label="Carga" name="cargo_description" required />
        <label className="admin-field">
          <span>Tramo</span>
          <select name="leg_kind">
            <option value="outbound">Ida</option>
            <option value="return">Retorno</option>
            <option value="continuation">Continuación</option>
          </select>
        </label>
        <MoreDetails>
          <Input label="Peso en toneladas (opcional)" name="cargo_tons" type="number" />
          <Input label="Flete total (S/, opcional)" name="freight_amount" type="number" />
        </MoreDetails>
      </div>
    </fieldset>
  );
}
function FuelFields(): React.JSX.Element {
  return (
    <fieldset className="admin-field--wide">
      <legend>Combustible</legend>
      <div className="admin-form__fields">
        <Input label="Cantidad" name="quantity" type="number" required />
        <label className="admin-field">
          <span>Unidad de medida</span>
          <select name="volume_unit">
            <option value="gallon">Galones</option>
            <option value="liter">Litros</option>
          </select>
        </label>
        <Input label="Total pagado (S/)" name="total_amount" type="number" required />
        <label className="admin-field">
          <span>¿Con qué dinero se pagó?</span>
          <select name="payment_source">
            <option value="company">Pagó la empresa</option>
            <option value="driver_fund">Fondo del conductor</option>
          </select>
        </label>
        <MoreDetails>
          <Input label="Kilometraje (opcional)" name="odometer_km" type="number" />
        </MoreDetails>
      </div>
    </fieldset>
  );
}
function PaymentMethod(): React.JSX.Element {
  return (
    <label className="admin-field">
      <span>Forma de entrega</span>
      <select name="method">
        <option value="cash">Efectivo</option>
        <option value="transfer">Depósito / transferencia</option>
      </select>
    </label>
  );
}
function Input({
  label,
  name,
  type = "text",
  defaultValue,
  required = false,
  placeholder,
}: {
  readonly label: string;
  readonly name: string;
  readonly type?: string;
  readonly defaultValue?: string | undefined;
  readonly required?: boolean;
  readonly placeholder?: string;
}): React.JSX.Element {
  return (
    <label className="admin-field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        {...(type === "number" ? { min: "0", step: "any", inputMode: "decimal" as const } : {})}
      />
    </label>
  );
}
function Select({
  label,
  name,
  options,
  defaultValue,
  required = false,
}: {
  readonly label: string;
  readonly name: string;
  readonly options: readonly AdminOption[];
  readonly defaultValue?: string | undefined;
  readonly required?: boolean;
}): React.JSX.Element {
  return (
    <label className="admin-field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} required={required}>
        <option value="">Selecciona…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

interface SavedDraft {
  readonly id: string;
  readonly fields: Readonly<Record<string, string>>;
}
function loadDraft(key: string): SavedDraft {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (
      value !== null &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "fields" in value &&
      typeof value.fields === "object" &&
      value.fields !== null &&
      !Array.isArray(value.fields) &&
      Object.values(value.fields).every((field) => typeof field === "string")
    )
      return value as SavedDraft;
  } catch {
    /* No draft yet. */
  }
  return { id: crypto.randomUUID(), fields: {} };
}
function PersistentForm({
  draftKey,
  title,
  onSave,
  children,
  onSaved,
}: {
  readonly draftKey: string;
  readonly title: string;
  readonly onSave: (form: FormData, id: string, duplicateConfirmed?: boolean) => Promise<void>;
  readonly children: ReactNode;
  readonly onSaved?: () => void;
}): React.JSX.Element {
  const key = `rt-sitram:operation-draft:v1:${draftKey}`;
  const [draft, setDraft] = useState(() => loadDraft(key));
  const [duplicate, setDuplicate] = useState<{
    readonly signature: string;
    readonly message: string;
  } | null>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    for (const [name, value] of Object.entries(draft.fields)) {
      const field = form.elements.namedItem(name);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLSelectElement ||
        field instanceof HTMLTextAreaElement
      )
        if (field instanceof HTMLInputElement && field.type === "checkbox")
          field.checked = value === "on";
        else field.value = value;
    }
  }, [draft.id]);
  const remember = (form: HTMLFormElement): void => {
    const fields: Record<string, string> = {};
    for (const [name, value] of new FormData(form))
      if (typeof value === "string" && name !== "assistance_ack") fields[name] = value;
    const next = { id: draft.id, fields };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError("No se pudo conservar este formulario al cerrar la aplicación.");
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = event.currentTarget;
    remember(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    const data = new FormData(form);
    const signature = JSON.stringify(Array.from(data.entries()));
    try {
      await onSave(data, draft.id, duplicate?.signature === signature);
      setDuplicate(null);
      localStorage.removeItem(key);
      setDraft({ id: crypto.randomUUID(), fields: {} });
      form.reset();
      onSaved?.();
      setMessage(
        "Guardado en este dispositivo. La actividad mostrará la confirmación del servidor.",
      );
    } catch (cause) {
      if (cause instanceof PossibleDuplicateError) {
        setDuplicate({ signature, message: cause.message });
        return;
      }
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar. El formulario se conserva.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <form
      ref={ref}
      className="admin-form"
      onChange={(event) => {
        remember(event.currentTarget);
        setDuplicate(null);
      }}
      onSubmit={(event) => void submit(event)}
    >
      <div className="admin-form__heading">
        <h2>{title}</h2>
      </div>
      <div className="admin-form__fields">{children}</div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {duplicate && (
        <div className="operation-duplicate-warning" role="alert">
          <strong>Posible registro repetido</strong>
          <p>{duplicate.message}</p>
          <p>Si corresponde a otro hecho real, puedes guardarlo de todos modos.</p>
        </div>
      )}
      <div className="admin-form__actions">
        <Button disabled={busy} type="submit">
          {busy ? "Guardando…" : duplicate ? "Es otro registro: guardar" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
