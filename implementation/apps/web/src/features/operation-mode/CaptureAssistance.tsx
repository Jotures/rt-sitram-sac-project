import { useEffect, useRef, useState } from "react";
import type {
  AdminDataGateway,
  AdminListRow,
  AdminOperationalCycleRow,
  AdminTripRow,
} from "../admin-ui/admin-data";
import { captureWarnings, comparableHistory, type CaptureValues } from "./assistance-model";

type Fields = Readonly<Record<string, string>>;
const quickNames = {
  date: "occurred_at",
  amount: "total_amount",
  unit: "volume_unit",
  odometer: "odometer_km",
  category: "category_id",
};
const fullNames = {
  date: "fueledAt",
  amount: "totalAmount",
  unit: "volumeUnit",
  odometer: "odometerKm",
  category: "categoryId",
};

/** Reads only its enclosing form. Applying a suggestion follows the same dirty/draft path as typing. */
export function CaptureAssistance({
  gateway,
  kind,
  vehicleId,
  legacy = false,
  cycles = [],
}: {
  readonly gateway: AdminDataGateway;
  readonly kind: "fuel" | "expense" | "departure";
  readonly vehicleId?: string | null | undefined;
  readonly legacy?: boolean;
  readonly cycles?: readonly AdminOperationalCycleRow[];
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<Fields>({});
  const [history, setHistory] = useState<readonly AdminListRow[]>([]);
  const [trips, setTrips] = useState<readonly AdminTripRow[]>([]);
  const [unavailable, setUnavailable] = useState(false);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setHistory([]);
    setUnavailable(false);
    const movement =
      kind === "fuel"
        ? gateway.listFuelEntries()
        : kind === "expense"
          ? gateway.listExpenses()
          : Promise.resolve([]);
    void Promise.all([movement, legacy ? gateway.listTrips() : Promise.resolve([])])
      .then(([rows, services]) => {
        if (current) {
          setHistory(rows);
          setTrips(services);
        }
      })
      .catch(() => {
        if (current) setUnavailable(true);
      });
    return () => {
      current = false;
    };
  }, [gateway, kind, legacy, revision]);
  useEffect(() => {
    const form = host.current?.closest("form");
    if (!form) return;
    const read = (event?: Event): void => {
      if (event?.target instanceof HTMLInputElement && event.target.name === "assistance_ack")
        return;
      const next: Record<string, string> = {};
      for (const [name, value] of new FormData(form))
        if (typeof value === "string" && name !== "assistance_ack") next[name] = value;
      setFields(next);
      setAcknowledged(null);
    };
    const frame = requestAnimationFrame(() => read());
    const reset = (): void => {
      requestAnimationFrame(() => read());
      setRevision((value) => value + 1);
    };
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    form.addEventListener("reset", reset);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
      form.removeEventListener("reset", reset);
    };
  }, []);
  const names = legacy ? fullNames : quickNames;
  const unit =
    vehicleId ??
    (legacy ? trips.find((trip) => trip.id === fields.tripId)?.vehicleId : fields.vehicle_id) ??
    "";
  const dateField = kind === "expense" && legacy ? "incurredAt" : names.date;
  const values: CaptureValues = {
    vehicleId: unit,
    occurredAt: fields[dateField] ?? "",
    amount: fields[kind === "expense" ? "amount" : names.amount] ?? "",
    quantity: fields.quantity ?? "",
    volumeUnit: fields[names.unit] ?? "",
    categoryId: fields[names.category] ?? "",
    odometerKm: fields[names.odometer] ?? "",
  };
  const warnings = kind === "departure" ? [] : captureWarnings(kind, history, values);
  const warningSignature = JSON.stringify([values, warnings]);
  const recent = comparableHistory(history, values)[0];
  const form = host.current?.closest("form");
  const available = (name: string, value: string): boolean => {
    const input = form?.elements.namedItem(name);
    return input instanceof HTMLSelectElement
      ? Array.from(input.options).some((option) => option.value === value && !option.disabled)
      : input instanceof HTMLInputElement;
  };
  const apply = (name: string, value: string): void => {
    const input = form?.elements.namedItem(name);
    if (
      !(input instanceof HTMLInputElement || input instanceof HTMLSelectElement) ||
      !available(name, value)
    )
      return;
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype,
      "value",
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const suggestions: { name: string; value: string; label: string; source: string }[] = [];
  if (kind === "fuel" && recent?.captureContext) {
    const source = `Último abastecimiento validado de esta unidad: ${new Date(recent.date!).toLocaleDateString("es-PE")}${recent.captureContext.local ? " · copia local" : ""}.`;
    const volume = recent.captureContext.volumeUnit;
    if (volume && fields[names.unit] !== volume && available(names.unit, volume))
      suggestions.push({
        name: names.unit,
        value: volume,
        label: volume === "liter" ? "Usar litros" : "Usar galones",
        source,
      });
    const supplier = recent.captureContext.supplierId;
    if (legacy && !fields.supplierId && supplier && available("supplierId", supplier)) {
      const select = form?.elements.namedItem("supplierId") as HTMLSelectElement;
      const label =
        Array.from(select.options).find((option) => option.value === supplier)?.text ??
        "proveedor anterior";
      suggestions.push({ name: "supplierId", value: supplier, label: `Usar ${label}`, source });
    }
  }
  if (kind === "departure" && unit && Number.isFinite(Date.parse(values.occurredAt))) {
    const previous = cycles
      .filter(
        (cycle) =>
          cycle.vehicleId === unit &&
          cycle.status !== "cancelled" &&
          cycle.status !== "planned" &&
          cycle.date &&
          Date.parse(cycle.date) <= Date.parse(values.occurredAt),
      )
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
    if (previous) {
      const source = `Salida anterior de esta unidad: ${previous.title} · ${new Date(previous.date!).toLocaleDateString("es-PE")}.`;
      if (
        !fields.driver_id &&
        previous.primaryDriverId &&
        available("driver_id", previous.primaryDriverId)
      ) {
        const select = form?.elements.namedItem("driver_id") as HTMLSelectElement;
        const label =
          Array.from(select.options).find((option) => option.value === previous.primaryDriverId)
            ?.text ?? "conductor anterior";
        suggestions.push({
          name: "driver_id",
          value: previous.primaryDriverId,
          label: `Usar ${label}`,
          source,
        });
      }
      if (!fields.notes && previous.notes)
        suggestions.push({
          name: "notes",
          value: previous.notes,
          label: `Usar recorrido: ${previous.notes}`,
          source,
        });
    }
  }
  return (
    <div ref={host} className="capture-assistance admin-field--wide">
      {unavailable && (
        <p className="admin-form-note">
          No se pudo consultar el historial para ayudarte. Puedes completar los datos reales.{" "}
          <button type="button" onClick={() => setRevision((value) => value + 1)}>
            Reintentar ayuda
          </button>
        </p>
      )}
      {suggestions.map((suggestion) => (
        <div className="assistance-suggestion" key={suggestion.name}>
          <p>{suggestion.source}</p>
          <button type="button" onClick={() => apply(suggestion.name, suggestion.value)}>
            {suggestion.label}
          </button>
        </div>
      ))}
      {warnings.length > 0 && (
        <div className="assistance-warning" role="status">
          <strong>Revisa estos datos</strong>
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <label>
            <input
              type="checkbox"
              name="assistance_ack"
              required
              checked={acknowledged === warningSignature}
              onChange={(event) => setAcknowledged(event.target.checked ? warningSignature : null)}
            />{" "}
            Revisé los datos y confirmo este caso excepcional.
          </label>
        </div>
      )}
    </div>
  );
}
