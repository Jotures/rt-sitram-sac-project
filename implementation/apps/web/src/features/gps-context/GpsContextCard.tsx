import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { getSupabaseClient } from "../../lib/supabase";
import type { AppRole } from "../identity/identity-model";
import {
  canViewGpsTelemetry,
  createSupabaseGpsContextGateway,
  type GpsContextGateway,
} from "./gps-context-data";
import {
  createGpsContextPresentation,
  shouldRenderGpsContext,
  type GpsContextPresentation,
  type GpsContextSource,
  type GpsContextStatus,
  type GpsFreshnessPolicy,
} from "./gps-context";
import "./gps-context.css";

interface GpsContextCardProps {
  readonly vehicleId: string | null;
  readonly role: AppRole;
  readonly online: boolean;
  readonly gateway?: GpsContextGateway;
  /** Null keeps the exact signal time visible without inventing a freshness threshold. */
  readonly freshnessPolicy?: GpsFreshnessPolicy | null;
  readonly now?: () => Date;
}

type GpsContextLoadState =
  | { readonly kind: "LOADING" }
  | { readonly kind: "READY"; readonly source: GpsContextSource };

/**
 * Online-only, read-only GPS context for an already-authorized unit. It never
 * reads PowerSync, emits commands, renders coordinates, or changes operation.
 */
export function GpsContextCard({
  vehicleId,
  role,
  online,
  gateway: suppliedGateway,
  freshnessPolicy,
  now = () => new Date(),
}: GpsContextCardProps): React.JSX.Element | null {
  const mayView = canViewGpsTelemetry(role);
  const defaultGateway = useMemo(() => {
    if (!mayView || vehicleId === null || !online) return null;
    const client = getSupabaseClient();
    return client === null ? null : createSupabaseGpsContextGateway(client);
  }, [mayView, online, vehicleId]);
  const gateway = suppliedGateway ?? defaultGateway;
  const [state, setState] = useState<GpsContextLoadState>({ kind: "LOADING" });

  useEffect(() => {
    if (!mayView || vehicleId === null) return undefined;
    if (!online) {
      setState({ kind: "READY", source: { kind: "UNAVAILABLE", reason: "OFFLINE" } });
      return undefined;
    }
    if (gateway === null) {
      setState({ kind: "READY", source: { kind: "UNAVAILABLE", reason: "REMOTE" } });
      return undefined;
    }

    let active = true;
    setState({ kind: "LOADING" });
    void gateway.load(vehicleId).then(
      (source) => {
        if (active) setState({ kind: "READY", source });
      },
      () => {
        if (active) setState({ kind: "READY", source: { kind: "UNAVAILABLE", reason: "REMOTE" } });
      },
    );
    return () => {
      active = false;
    };
  }, [gateway, mayView, online, vehicleId]);

  // Do not reveal whether a link or signal exists to roles outside the GPS RLS scope.
  if (!mayView || vehicleId === null) return null;
  if (state.kind === "LOADING") return <GpsContextLoadingCard />;
  if (!shouldRenderGpsContext(state.source)) return null;

  const referenceTime = now();
  const presentation = createGpsContextPresentation(
    state.source,
    referenceTime.toISOString(),
    freshnessPolicy ?? null,
  );
  return <GpsContextEvidenceCard presentation={presentation} referenceTime={referenceTime} />;
}

function GpsContextLoadingCard(): React.JSX.Element {
  return (
    <section className="admin-card gps-context-card" aria-busy="true" aria-live="polite">
      <div className="gps-context-card__heading">
        <div>
          <p className="admin-section-kicker">Telemetría online</p>
          <h2>Consultando última señal GPS</h2>
        </div>
        <Icon name="gauge" size={22} />
      </div>
      <p className="admin-muted">La evidencia GPS no forma parte de la copia local.</p>
    </section>
  );
}

function GpsContextEvidenceCard({
  presentation,
  referenceTime,
}: {
  readonly presentation: GpsContextPresentation;
  readonly referenceTime: Date;
}): React.JSX.Element {
  const hasSignal = presentation.recordedAt !== null;
  return (
    <section className="admin-card gps-context-card" aria-labelledby="gps-context-title">
      <div className="gps-context-card__heading">
        <div>
          <p className="admin-section-kicker">Telemetría online</p>
          <h2 id="gps-context-title">Última señal GPS</h2>
        </div>
        <StatusChip label={presentation.label} tone={gpsStatusTone(presentation.status)} />
      </div>
      <p className="gps-context-card__summary">{presentation.copy}</p>
      {hasSignal ? (
        <GpsEvidenceTerms presentation={presentation} referenceTime={referenceTime} />
      ) : null}
      <p className="gps-context-card__note">
        <Icon name="gauge" size={17} />
        GPS no cambia el estado operativo. El maestro solo puede cambiar con una lectura Goldcar de
        detalle validada y una acción explícita de Gerencia.
      </p>
    </section>
  );
}

function GpsEvidenceTerms({
  presentation,
  referenceTime,
}: {
  readonly presentation: GpsContextPresentation;
  readonly referenceTime: Date;
}): React.JSX.Element {
  const recordedAt = presentation.recordedAt;
  if (recordedAt === null) return <></>;
  return (
    <dl className="gps-context-card__terms">
      <div>
        <dt>Hora de la señal</dt>
        <dd>
          <time dateTime={recordedAt}>{formatGpsDate(recordedAt)}</time>
          <small>{formatSignalAge(recordedAt, referenceTime)}</small>
        </dd>
      </div>
      <div>
        <dt>Velocidad reportada</dt>
        <dd>
          {presentation.speedKmh === null
            ? "No reportada"
            : `${formatGpsNumber(presentation.speedKmh)} km/h`}
          <small>{presentation.movement.label}</small>
        </dd>
      </div>
      <div>
        <dt>Ignición reportada</dt>
        <dd>{ignitionLabel(presentation.ignition)}</dd>
      </div>
      <div>
        <dt>Odómetro reportado por GPS</dt>
        <dd>
          {presentation.odometerKm === null
            ? "No reportado"
            : `${formatGpsNumber(presentation.odometerKm)} km`}
        </dd>
      </div>
    </dl>
  );
}

function gpsStatusTone(
  status: GpsContextStatus,
): "neutral" | "success" | "info" | "warning" | "risk" | "critical" {
  switch (status) {
    case "FRESH":
      return "success";
    case "STALE":
      return "warning";
    case "CLOCK_SKEW":
      return "critical";
    case "FRESHNESS_UNCONFIGURED":
      return "info";
    case "NO_SIGNAL":
      return "warning";
    case "NO_LINK":
      return "neutral";
    case "UNAVAILABLE":
      return "risk";
  }
}

function ignitionLabel(ignition: boolean | null): string {
  if (ignition === null) return "No reportada";
  return ignition ? "Encendida" : "Apagada";
}

function formatGpsDate(value: string): string {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSignalAge(value: string, referenceTime: Date): string {
  const elapsedMinutes = Math.round((referenceTime.getTime() - new Date(value).getTime()) / 60_000);
  if (!Number.isFinite(elapsedMinutes)) return "Hora no disponible";
  if (elapsedMinutes < 0) return "Hora GPS posterior a la consulta";
  if (elapsedMinutes < 1) return "Hace menos de 1 min";
  if (elapsedMinutes < 60) return `Hace ${elapsedMinutes} min`;
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return minutes === 0 ? `Hace ${hours} h` : `Hace ${hours} h ${minutes} min`;
}

function formatGpsNumber(value: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(value);
}
