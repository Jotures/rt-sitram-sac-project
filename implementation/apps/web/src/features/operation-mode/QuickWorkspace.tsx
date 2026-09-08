import { usePowerSync, useQuery } from "@powersync/react";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/primitives/Button";
import { powerSyncIdentityStore } from "../../lib/powersync/identity-store";
import { operationActivitySql } from "../../lib/powersync/operation-journal";
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

type QuickAction = "departure" | "service" | "advance" | "expense" | "fuel" | "return" | "start";
interface LocalCommand {
  readonly id: string;
  readonly kind: string;
  readonly payload: string;
  readonly status: string;
  readonly dependency_id: string | null;
  readonly created_at: string;
  readonly error_message: string | null;
}

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
}: {
  readonly gateway: AdminDataGateway;
  readonly context: AdminWriteContext;
  readonly initialAction?: QuickAction | undefined;
  readonly compact?: boolean;
}): React.JSX.Element {
  const database = usePowerSync();
  const [search, setSearch] = useSearchParams();
  const [cycles, setCycles] = useState<readonly AdminOperationalCycleRow[]>([]);
  const [options, setOptions] = useState<AdminTripSetupOptions | null>(null);
  const [categories, setCategories] = useState<readonly AdminOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<QuickAction | null>(
    initialAction ?? (search.get("accion") === "servicio" ? "service" : null),
  );
  const [repeat, setRepeat] = useState<AdminOperationalCycleRow | null>(null);
  const { data: commands } = useQuery<LocalCommand>(
    `SELECT o.*, d.error_message FROM (${operationActivitySql}) o
    LEFT JOIN upload_dead_letters d ON d.source_table = 'operation_commands' AND d.source_record_id = o.id AND d.status = 'pending_review'
    WHERE o.company_id = ? ORDER BY o.created_at DESC LIMIT 80`,
    [context.companyId],
  );
  const confirmation = commands.map((c) => `${c.id}:${c.status}`).join(",");
  const reload = useCallback(async () => {
    try {
      const [nextCycles, nextOptions, capture] = await Promise.all([
        gateway.listOperationalCycles(),
        gateway.loadTripSetupOptions(),
        gateway.loadStaffCaptureOptions(),
      ]);
      setCycles(nextCycles);
      setOptions(nextOptions);
      setCategories(capture.expenseCategories);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron preparar los datos de la operación.",
      );
    }
  }, [gateway]);
  useEffect(() => {
    void reload();
  }, [reload, confirmation]);

  const pendingCycles = commands.filter(
    (c) =>
      c.kind === "departure" &&
      c.status !== "confirmed" &&
      !cycles.some((cycle) => cycle.id === c.id),
  );
  const selectedId = search.get("salida") ?? "";
  const selected = cycles.find((cycle) => cycle.id === selectedId);
  const pendingSelected = pendingCycles.find((cycle) => cycle.id === selectedId);
  const selectCycle = (id: string): void => {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      next.set("salida", id);
      return next;
    });
  };
  const save = async (body: OperationCommandBody, id: string): Promise<void> => {
    await database.init();
    if (powerSyncIdentityStore.read() !== context.profileId)
      throw new Error(
        "Se está preparando el guardado local. Espera unos segundos e inténtalo nuevamente.",
      );
    await enqueueOperationCommand(database, makeOperationCommand(body, id), {
      ...context,
      sourceDeviceId: getOrCreateDeviceId(),
    });
    if (body.kind === "departure") selectCycle(id);
  };
  const chooseAction = (next: QuickAction): void => {
    setAction(next);
    if (next === "departure") setRepeat(null);
  };
  return (
    <section className="quick-workspace" aria-label="Registro de operaciones">
      {!compact && (
        <header className="page-header">
          <div>
            <h1>Operación del día</h1>
            <p>
              Registra lo que ocurrió. Cada salida reúne la cuenta del conductor hasta su regreso a
              Cusco.
            </p>
          </div>
        </header>
      )}
      {error && (
        <p className="admin-notice" role="alert">
          {error}
          <Button variant="quiet" onClick={() => void reload()}>
            Volver a cargar
          </Button>
        </p>
      )}
      <div className="operation-quick-actions" aria-label="Acciones frecuentes">
        <Button onClick={() => chooseAction("departure")}>Registrar salida</Button>
        <Button variant="quiet" onClick={() => chooseAction("advance")}>
          Entregar dinero
        </Button>
        <Button variant="quiet" onClick={() => chooseAction("expense")}>
          Registrar gasto
        </Button>
        <Button variant="quiet" onClick={() => chooseAction("fuel")}>
          Combustible
        </Button>
      </div>
      {action !== null && action !== "departure" && (
        <label className="admin-field">
          <span>Salida de la unidad</span>
          <select value={selectedId} onChange={(event) => selectCycle(event.target.value)} required>
            <option value="">Selecciona la salida</option>
            {cycles
              .filter((cycle) => cycle.status !== "cancelled")
              .map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.title} · {cycle.description}
                </option>
              ))}
            {pendingCycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                Salida guardada en este dispositivo · {cycle.id.slice(0, 6)}
              </option>
            ))}
          </select>
        </label>
      )}
      {action === "departure" && options !== null && (
        <DepartureForm
          key={repeat?.id ?? "new"}
          context={context}
          options={options}
          repeat={repeat}
          onSave={save}
        />
      )}
      {action !== null && action !== "departure" && selectedId && (selected || pendingSelected) && (
        <MovementForm
          key={`${selectedId}:${action}`}
          context={context}
          cycleId={selectedId}
          action={action}
          options={options}
          categories={categories}
          onSave={save}
        />
      )}
      {selected !== undefined && (
        <section className="admin-card">
          <div className="admin-card__heading">
            <div>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
            </div>
            <span>
              {selected.status === "completed"
                ? "Regresó a Cusco"
                : selected.status === "planned"
                  ? "Programada"
                  : "En recorrido"}
            </span>
          </div>
          <div className="operation-quick-actions">
            {selected.status === "planned" && (
              <Button onClick={() => chooseAction("start")}>Registrar partida</Button>
            )}
            {selected.status === "active" && !selected.returnedAt && (
              <Button onClick={() => chooseAction("return")}>Registrar regreso a Cusco</Button>
            )}
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
          <CycleServices
            gateway={gateway}
            cycleId={selected.id}
            confirmation={confirmation}
            onSave={save}
            context={context}
          />
          <CycleCaptureChannel cycleId={selected.id} />
        </section>
      )}
      {!compact && (
        <section className="admin-card">
          <h2>Salidas recientes</h2>
          {cycles.length === 0 && pendingCycles.length === 0 && (
            <p>
              Todavía no hay salidas. Puedes registrar una sin conocer el cliente o el primer flete.
            </p>
          )}
          {pendingCycles.map((cycle) => (
            <article className="admin-list-row" key={cycle.id}>
              <div>
                <strong>Salida por confirmar</strong>
                <p>
                  {cycle.error_message ??
                    "Guardado en este dispositivo · pendiente de confirmación"}
                </p>
              </div>
              <Button variant="quiet" onClick={() => selectCycle(cycle.id)}>
                Ver salida
              </Button>
            </article>
          ))}
          {cycles.slice(0, 20).map((cycle) => (
            <article className="admin-list-row" key={cycle.id}>
              <div>
                <strong>{cycle.title}</strong>
                <p>{cycle.description}</p>
              </div>
              <div className="admin-row-buttons">
                <Button variant="quiet" onClick={() => selectCycle(cycle.id)}>
                  Ver movimientos
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setRepeat(cycle);
                    setAction("departure");
                  }}
                >
                  Repetir salida
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="admin-card">
        <h2>{selectedId ? "Actividad de esta salida" : "Actividad reciente"}</h2>
        {commands
          .filter((c) => !selectedId || c.id === selectedId || c.dependency_id === selectedId)
          .map((command) => (
            <article className="admin-list-row" key={command.id}>
              <div>
                <strong>{operationCommandLabel(command.kind)}</strong>
                <p>{operationCommandSummary(command.payload)}</p>
                <p>{new Date(command.created_at).toLocaleString("es-PE")}</p>
                <p role="status">
                  {command.error_message
                    ? `Requiere atención: ${command.error_message}`
                    : command.status === "confirmed"
                      ? "Confirmado"
                      : "Guardado en este dispositivo · pendiente de confirmación"}
                </p>
                {command.error_message && (
                  <Link to="/sincronizacion">Revisar el registro conservado</Link>
                )}
              </div>
            </article>
          ))}
      </section>
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
  readonly onSave: (body: OperationCommandBody, id: string) => Promise<void>;
  readonly context: AdminWriteContext;
}): React.JSX.Element {
  const [trips, setTrips] = useState<
    Awaited<ReturnType<AdminDataGateway["loadOperationalCycleDetail"]>>["trips"]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    void gateway
      .loadOperationalCycleDetail(cycleId)
      .then((data) => {
        if (current) setTrips(data.trips);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [gateway, cycleId, confirmation]);
  return (
    <div>
      <h3>Servicios y fletes</h3>
      {trips.length === 0 ? (
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
  context,
  options,
  repeat,
  onSave,
}: {
  readonly context: AdminWriteContext;
  readonly options: AdminTripSetupOptions;
  readonly repeat: AdminOperationalCycleRow | null;
  readonly onSave: (body: OperationCommandBody, id: string) => Promise<void>;
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
      onSave={(form, id) =>
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
    </PersistentForm>
  );
}

export function MovementForm({
  context,
  cycleId,
  action,
  options,
  categories,
  onSave,
}: {
  readonly context: AdminWriteContext;
  readonly cycleId: string;
  readonly action: Exclude<QuickAction, "departure">;
  readonly options: AdminTripSetupOptions | null;
  readonly categories: readonly AdminOption[];
  readonly onSave: (body: OperationCommandBody, id: string) => Promise<void>;
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
      onSave={(form, id) => {
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
          );
        if (action === "fuel")
          return onSave({ kind: action, payload: { ...common, ...fuel(form, id) } }, id);
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
  readonly onSave: (form: FormData, id: string) => Promise<void>;
  readonly children: ReactNode;
  readonly onSaved?: () => void;
}): React.JSX.Element {
  const key = `rt-sitram:operation-draft:v1:${draftKey}`;
  const [draft, setDraft] = useState(() => loadDraft(key));
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
      if (typeof value === "string") fields[name] = value;
    const next = { id: draft.id, fields };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError("No se pudo conservar este formulario al cerrar la aplicación.");
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = event.currentTarget;
    remember(form);
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onSave(new FormData(form), draft.id);
      localStorage.removeItem(key);
      setDraft({ id: crypto.randomUUID(), fields: {} });
      form.reset();
      onSaved?.();
      setMessage(
        "Guardado en este dispositivo. La actividad mostrará la confirmación del servidor.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar. El formulario se conserva.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      ref={ref}
      className="admin-form"
      onChange={(event) => remember(event.currentTarget)}
      onSubmit={(event) => void submit(event)}
    >
      <div className="admin-form__heading">
        <h2>{title}</h2>
      </div>
      <div className="admin-form__fields">{children}</div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="admin-form__actions">
        <Button disabled={busy} type="submit">
          {busy ? "Guardando…" : "Guardar operación"}
        </Button>
      </div>
    </form>
  );
}
