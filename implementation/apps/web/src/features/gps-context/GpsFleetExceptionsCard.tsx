import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { getSupabaseClient } from "../../lib/supabase";
import type { AppRole } from "../identity/identity-model";
import {
  canViewGpsTelemetry,
  createSupabaseGpsContextGateway,
  type GpsFleetContextGateway,
  type GpsFleetContextSource,
} from "./gps-context-data";
import {
  deriveGpsFleetExceptions,
  type GpsFleetException,
  type GpsFleetVehicle,
} from "./gps-fleet-exceptions";
import "./gps-context.css";

interface GpsFleetExceptionsCardProps {
  readonly role: AppRole;
  readonly online: boolean;
  readonly vehicles: readonly GpsFleetVehicle[];
  readonly gateway?: GpsFleetContextGateway;
}

type GpsFleetContextLoadState =
  | { readonly kind: "LOADING" }
  | { readonly kind: "READY"; readonly source: GpsFleetContextSource };

/**
 * A deliberately quiet dashboard exception surface: GPS appears here only when the
 * current online evidence identifies a unit that needs a link or a first
 * signal. Freshness is intentionally not inferred in this early cut.
 */
export function GpsFleetExceptionsCard({
  role,
  online,
  vehicles,
  gateway: suppliedGateway,
}: GpsFleetExceptionsCardProps): React.JSX.Element | null {
  const mayView = canViewGpsTelemetry(role);
  const defaultGateway = useMemo(() => {
    if (!mayView || !online) return null;
    const client = getSupabaseClient();
    return client === null ? null : createSupabaseGpsContextGateway(client);
  }, [mayView, online]);
  const gateway = suppliedGateway ?? defaultGateway;
  const [state, setState] = useState<GpsFleetContextLoadState>({ kind: "LOADING" });

  useEffect(() => {
    if (!mayView) return undefined;
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
    void gateway.loadFleetContext().then(
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
  }, [gateway, mayView, online]);

  // Accounting and drivers must not learn whether GPS evidence exists.
  if (!mayView || state.kind === "LOADING") return null;

  const exceptions = deriveGpsFleetExceptions(vehicles, state.source);
  if (exceptions.length === 0) return null;

  return <GpsFleetExceptionEvidence exceptions={exceptions} />;
}

function GpsFleetExceptionEvidence({
  exceptions,
}: {
  readonly exceptions: readonly GpsFleetException[];
}): React.JSX.Element {
  const heading =
    exceptions.length === 1
      ? "Una unidad requiere revisión GPS"
      : `${exceptions.length} unidades requieren revisión GPS`;

  return (
    <section
      className="admin-card gps-fleet-exceptions"
      aria-labelledby="gps-fleet-exceptions-title"
    >
      <div className="gps-fleet-exceptions__heading">
        <div>
          <p className="admin-section-kicker">Telemetría por revisar</p>
          <h2 id="gps-fleet-exceptions-title">{heading}</h2>
        </div>
        <StatusChip label="Requiere revisión" tone="warning" />
      </div>
      <ul className="admin-priority-list">
        {exceptions.map((exception) => (
          <li
            className="admin-priority-list__item"
            key={`${exception.kind}-${exception.vehicleId}`}
          >
            <span className="admin-priority-list__icon" aria-hidden="true">
              <Icon name="gauge" size={18} />
            </span>
            <div>
              <strong>{exception.vehicleLabel}</strong>
              <small>{exceptionCopy(exception.kind)}</small>
            </div>
            <Link
              aria-label={`Abrir ficha de ${exception.vehicleLabel}`}
              to={`/flota/${encodeURIComponent(exception.vehicleId)}`}
            >
              <Icon name="chevron" size={17} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="gps-fleet-exceptions__note">
        Es evidencia GPS para revisión; no cambia el estado operativo de la unidad.
      </p>
    </section>
  );
}

function exceptionCopy(kind: GpsFleetException["kind"]): string {
  switch (kind) {
    case "NO_LINK":
      return "Sin vínculo GPS aprobado. Revisa la ficha de la unidad.";
    case "NO_SIGNAL":
      return "Tiene vínculo GPS aprobado, pero aún no hay una señal disponible.";
  }
}
