import { useState, type FormEvent } from "react";
import {
  recordExpenseOffline,
  recordFuelOffline,
  recordOdometerOffline,
  reportIncidentOffline,
} from "../../lib/powersync/product-writes";
import {
  CaptureResult,
  DriverField,
  DriverFormCard,
  DriverLoadingState,
  DriverPageHeader,
  DriverSubmitButton,
  DriverTripSummary,
  NoActiveTrip,
} from "./DriverUiParts";
import { discardEvidenceFile, persistEvidenceFile } from "./device-and-evidence";
import { useDriverTrips, useExpenseCategories, useSuppliers } from "./driver-data";
import {
  deriveFuelUnitPrice,
  localDateTimeValue,
  parseNonNegativeNumber,
  parsePositiveNumber,
  requireDriverText,
  toIsoFromLocalInput,
} from "./driver-validation";
import { useDriverCapture } from "./use-driver-capture";

function useActiveTripCapture() {
  const trips = useDriverTrips();
  const capture = useDriverCapture();

  return { ...trips, ...capture };
}

function OfficeCaptureBlocked(): React.JSX.Element {
  return (
    <div className="driver-page">
      <DriverPageHeader
        description="La oficina está registrando este viaje en línea para evitar información duplicada."
        eyebrow="Operación desde oficina"
        title="Registro temporalmente bloqueado"
      />
      <div className="driver-state">
        Puedes consultar el viaje en Mi viaje. Las acciones volverán a estar disponibles si Gerencia
        o Administración devuelve la captura a tu aplicación.
      </div>
    </div>
  );
}

function EvidenceField({ onChange }: { readonly onChange: (file: File | null) => void }) {
  return (
    <DriverField
      hint="Foto o PDF, máximo 10 MB. La evidencia queda vinculada al registro en este dispositivo hasta subirla. Ejemplo: una foto completa y legible del comprobante."
      label="Evidencia del registro"
    >
      <input
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        onChange={(event) => onChange(event.currentTarget.files?.[0] ?? null)}
        type="file"
      />
    </DriverField>
  );
}

export function DriverFuelPage(): React.JSX.Element {
  const context = useActiveTripCapture();
  const suppliers = useSuppliers();
  const [odometer, setOdometer] = useState("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [unit, setUnit] = useState<"gallon" | "liter">("gallon");
  const [supplierId, setSupplierId] = useState("");
  const [location, setLocation] = useState("");
  const [when, setWhen] = useState(() => localDateTimeValue());
  const [file, setFile] = useState<File | null>(null);

  if (context.isLoading) return <DriverLoadingState />;
  if (context.activeTrip === null || context.activeTrip.vehicle_id === null)
    return <NoActiveTrip />;
  if (context.activeTrip.capture_mode !== "driver_app") return <OfficeCaptureBlocked />;

  const trip = context.activeTrip;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await context.run(async (writeContext) => {
      const amount = parsePositiveNumber(total, "El monto total");
      const fuelQuantity = parsePositiveNumber(quantity, "La cantidad");
      const attachment = file === null ? undefined : await persistEvidenceFile(file);
      try {
        return await recordFuelOffline(
          context.database,
          {
            tripId: trip.id,
            vehicleId: trip.vehicle_id ?? "",
            supplierId: supplierId || null,
            fueledAt: toIsoFromLocalInput(when),
            location: location || null,
            odometerKm: parseNonNegativeNumber(odometer, "El kilometraje"),
            quantity: fuelQuantity,
            volumeUnit: unit,
            unitPrice: deriveFuelUnitPrice(fuelQuantity, amount),
            totalAmount: amount,
            ...(attachment === undefined ? {} : { attachment }),
          },
          writeContext,
        );
      } catch (error) {
        if (attachment !== undefined) await discardEvidenceFile(attachment.localUri);
        throw error;
      }
    });
    if (ok) {
      setOdometer("");
      setQuantity("");
      setTotal("");
      setLocation("");
      setFile(null);
    }
  };

  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Registra importe, volumen, lectura y evidencia del abastecimiento."
        eyebrow="Bitácora de ruta"
        title="Combustible"
      />
      <DriverTripSummary compact trip={trip} />
      <DriverFormCard>
        <form className="driver-form" onSubmit={(event) => void submit(event)}>
          <div className="driver-form__pair">
            <DriverField label="Kilometraje">
              <input
                inputMode="decimal"
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="Ej.: 12 500"
                required
                value={odometer}
              />
            </DriverField>
            <DriverField label="Cantidad">
              <input
                inputMode="decimal"
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ej.: 18.5"
                required
                value={quantity}
              />
            </DriverField>
          </div>
          <DriverField label="Unidad">
            <select onChange={(e) => setUnit(e.target.value as "gallon" | "liter")} value={unit}>
              <option value="gallon">Galones</option>
              <option value="liter">Litros</option>
            </select>
          </DriverField>
          <DriverField label="Monto total (S/)">
            <input
              inputMode="decimal"
              onChange={(e) => setTotal(e.target.value)}
              placeholder="Ej.: 320.00"
              required
              value={total}
            />
          </DriverField>
          <DriverField label="Grifo">
            <select onChange={(e) => setSupplierId(e.target.value)} value={supplierId}>
              <option value="">No identificado</option>
              {suppliers.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </DriverField>
          <DriverField label="Ubicación">
            <input
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej.: Km 48 de la Panamericana Sur"
              value={location}
            />
          </DriverField>
          <DriverField label="Fecha y hora">
            <input
              onChange={(e) => setWhen(e.target.value)}
              required
              type="datetime-local"
              value={when}
            />
          </DriverField>
          <EvidenceField onChange={setFile} />
          <CaptureResult error={context.error} saved={context.saved} />
          <DriverSubmitButton busy={context.busy} icon="fuel">
            Guardar abastecimiento
          </DriverSubmitButton>
        </form>
      </DriverFormCard>
    </div>
  );
}

export function DriverExpensePage(): React.JSX.Element {
  const context = useActiveTripCapture();
  const categories = useExpenseCategories();
  const suppliers = useSuppliers();
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState(() => localDateTimeValue());
  const [file, setFile] = useState<File | null>(null);
  if (context.isLoading) return <DriverLoadingState />;
  if (context.activeTrip === null) return <NoActiveTrip />;
  if (context.activeTrip.capture_mode !== "driver_app") return <OfficeCaptureBlocked />;
  const trip = context.activeTrip;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await context.run(async (writeContext) => {
      const attachment = file === null ? undefined : await persistEvidenceFile(file);
      try {
        return await recordExpenseOffline(
          context.database,
          {
            tripId: trip.id,
            vehicleId: trip.vehicle_id,
            categoryId: requireDriverText(categoryId, "La categoría"),
            supplierId: supplierId || null,
            incurredAt: toIsoFromLocalInput(when),
            amount: parsePositiveNumber(amount, "El monto"),
            description: description || null,
            ...(attachment === undefined ? {} : { attachment }),
          },
          writeContext,
        );
      } catch (error) {
        if (attachment !== undefined) await discardEvidenceFile(attachment.localUri);
        throw error;
      }
    });
    if (ok) {
      setAmount("");
      setDescription("");
      setFile(null);
    }
  };
  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Registra el desembolso y su evidencia sin perder el contexto del viaje."
        eyebrow="Bitácora de ruta"
        title="Gasto"
      />
      <DriverTripSummary compact trip={trip} />
      <DriverFormCard>
        <form className="driver-form" onSubmit={(event) => void submit(event)}>
          <DriverField label="Categoría">
            <select onChange={(e) => setCategoryId(e.target.value)} required value={categoryId}>
              <option value="">Selecciona una categoría</option>
              {categories.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </DriverField>
          <DriverField label="Monto (S/)">
            <input
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ej.: 42.50"
              required
              value={amount}
            />
          </DriverField>
          <DriverField label="Proveedor">
            <select onChange={(e) => setSupplierId(e.target.value)} value={supplierId}>
              <option value="">No identificado</option>
              {suppliers.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </DriverField>
          <DriverField label="Fecha y hora">
            <input
              onChange={(e) => setWhen(e.target.value)}
              required
              type="datetime-local"
              value={when}
            />
          </DriverField>
          <DriverField hint="Opcional" label="Nota">
            <textarea
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej.: Peaje de salida en Pucusana"
              rows={3}
              value={description}
            />
          </DriverField>
          <EvidenceField onChange={setFile} />
          <CaptureResult error={context.error} saved={context.saved} />
          <DriverSubmitButton busy={context.busy} icon="money">
            Guardar gasto
          </DriverSubmitButton>
        </form>
      </DriverFormCard>
    </div>
  );
}

export function DriverIncidentPage(): React.JSX.Element {
  const context = useActiveTripCapture();
  const [type, setType] = useState("delay");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [action, setAction] = useState("");
  const [when, setWhen] = useState(() => localDateTimeValue());
  const [file, setFile] = useState<File | null>(null);
  if (context.isLoading) return <DriverLoadingState />;
  if (context.activeTrip === null || context.activeTrip.vehicle_id === null)
    return <NoActiveTrip />;
  if (context.activeTrip.capture_mode !== "driver_app") return <OfficeCaptureBlocked />;
  const trip = context.activeTrip;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await context.run(async (writeContext) => {
      const attachment = file === null ? undefined : await persistEvidenceFile(file);
      try {
        return await reportIncidentOffline(
          context.database,
          {
            tripId: trip.id,
            vehicleId: trip.vehicle_id ?? "",
            occurredAt: toIsoFromLocalInput(when),
            location: location || null,
            incidentType: type,
            severity,
            description: requireDriverText(description, "La descripción"),
            actionTaken: action || null,
            ...(attachment === undefined ? {} : { attachment }),
          },
          writeContext,
        );
      } catch (error) {
        if (attachment !== undefined) await discardEvidenceFile(attachment.localUri);
        throw error;
      }
    });
    if (ok) {
      setDescription("");
      setLocation("");
      setAction("");
      setFile(null);
    }
  };
  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Informa un problema operativo. Una incidencia crítica no reemplaza el protocolo de emergencia."
        eyebrow="Bitácora de ruta"
        title="Incidencia"
      />
      <DriverTripSummary compact trip={trip} />
      <DriverFormCard>
        <form className="driver-form" onSubmit={(event) => void submit(event)}>
          <DriverField label="¿Qué pasó?">
            <select onChange={(e) => setType(e.target.value)} value={type}>
              <option value="breakdown">Avería</option>
              <option value="road_block">Bloqueo</option>
              <option value="delay">Retraso</option>
              <option value="cargo_issue">Problema con carga</option>
              <option value="documentation">Documentación</option>
              <option value="other">Otro</option>
            </select>
          </DriverField>
          <DriverField label="Severidad">
            <select
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              value={severity}
            >
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </DriverField>
          {severity === "critical" ? (
            <div className="driver-critical-note" role="status">
              Se marcará como urgente para Administración.
            </div>
          ) : null}
          <DriverField label="Descripción">
            <textarea
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej.: Llantas traseras con baja presión en el km 48"
              required
              rows={4}
              value={description}
            />
          </DriverField>
          <DriverField label="Ubicación">
            <input
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej.: Km 48 de la Panamericana Sur"
              value={location}
            />
          </DriverField>
          <DriverField hint="Opcional" label="Acción tomada">
            <textarea
              onChange={(e) => setAction(e.target.value)}
              placeholder="Ej.: Avisé a la central y estacioné en zona segura"
              rows={2}
              value={action}
            />
          </DriverField>
          <DriverField label="Fecha y hora">
            <input
              onChange={(e) => setWhen(e.target.value)}
              required
              type="datetime-local"
              value={when}
            />
          </DriverField>
          <EvidenceField onChange={setFile} />
          <CaptureResult error={context.error} saved={context.saved} />
          <DriverSubmitButton busy={context.busy} icon="alert">
            Enviar incidencia
          </DriverSubmitButton>
        </form>
      </DriverFormCard>
    </div>
  );
}

export function DriverOdometerPage(): React.JSX.Element {
  const context = useActiveTripCapture();
  const [reading, setReading] = useState("");
  const [readingType, setReadingType] = useState<"start" | "current" | "arrival" | "final">(
    "current",
  );
  const [when, setWhen] = useState(() => localDateTimeValue());
  if (context.isLoading) return <DriverLoadingState />;
  if (context.activeTrip === null || context.activeTrip.vehicle_id === null)
    return <NoActiveTrip />;
  if (context.activeTrip.capture_mode !== "driver_app") return <OfficeCaptureBlocked />;
  const trip = context.activeTrip;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await context.run((writeContext) =>
      recordOdometerOffline(
        context.database,
        {
          tripId: trip.id,
          vehicleId: trip.vehicle_id ?? "",
          readingKm: parseNonNegativeNumber(reading, "El kilometraje"),
          readingAt: toIsoFromLocalInput(when),
          readingType,
        },
        writeContext,
      ),
    );
    if (ok) setReading("");
  };
  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Registra la lectura visible del odómetro."
        eyebrow="Bitácora de ruta"
        title="Kilometraje"
      />
      <DriverTripSummary compact trip={trip} />
      <DriverFormCard>
        <form className="driver-form" onSubmit={(event) => void submit(event)}>
          <DriverField label="Lectura (km)">
            <input
              inputMode="decimal"
              onChange={(e) => setReading(e.target.value)}
              placeholder="Ej.: 12 650"
              required
              value={reading}
            />
          </DriverField>
          <DriverField label="Momento">
            <select
              onChange={(e) => setReadingType(e.target.value as typeof readingType)}
              value={readingType}
            >
              <option value="current">Lectura actual</option>
              <option value="start">Inicio</option>
              <option value="arrival">Llegada</option>
              <option value="final">Final</option>
            </select>
          </DriverField>
          <DriverField label="Fecha y hora">
            <input
              onChange={(e) => setWhen(e.target.value)}
              required
              type="datetime-local"
              value={when}
            />
          </DriverField>
          <CaptureResult error={context.error} saved={context.saved} />
          <DriverSubmitButton busy={context.busy} icon="gauge">
            Guardar kilometraje
          </DriverSubmitButton>
        </form>
      </DriverFormCard>
    </div>
  );
}
