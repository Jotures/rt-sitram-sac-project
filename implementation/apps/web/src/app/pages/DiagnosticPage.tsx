import { formatBuildLabel } from "@rt-sitram/shared";
import { AuthenticationPanel } from "../../features/auth/AuthenticationPanel";
import { useAuth } from "../../features/auth/AuthProvider";
import { PowerSyncPanel } from "../../features/powersync/PowerSyncPanel";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { usePwaShellStatus } from "../../lib/pwa/use-pwa-shell-status";
import { supabaseConfiguration } from "../../lib/supabase";
import "../../App.css";

function getNetworkLabel(networkStatus: "ONLINE" | "OFFLINE"): string {
  return networkStatus === "ONLINE" ? "Internet disponible" : "Sin conexión a internet";
}

function getPwaShellLabel(pwaShellStatus: "READY" | "NOT_READY"): string {
  return pwaShellStatus === "READY"
    ? "La versión sin conexión está disponible"
    : "La versión sin conexión no está activa";
}

function getServerConfigurationLabel(status: "CONFIGURED" | "NOT_CONFIGURED"): string {
  return status === "CONFIGURED" ? "Configuración disponible" : "Requiere configuración";
}

function getAuthLabel(status: "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED"): string {
  switch (status) {
    case "INITIALIZING":
      return "Comprobando acceso";
    case "AUTHENTICATED":
      return "Sesión iniciada";
    case "UNAUTHENTICATED":
      return "Sin sesión iniciada";
  }
}

function getEnvironmentLabel(mode: string): string {
  switch (mode) {
    case "production":
      return "Uso normal";
    case "development":
      return "Pruebas de desarrollo";
    case "test":
      return "Pruebas automáticas";
    default:
      return `Modo técnico: ${mode}`;
  }
}

export function DiagnosticPage(): React.JSX.Element {
  const { state: authState } = useAuth();
  const networkStatus = useNetworkStatus();
  const pwaShellStatus = usePwaShellStatus();

  return (
    <section
      className="technical-status technical-status--embedded"
      aria-labelledby="diagnostic-title"
    >
      <div className="technical-status__card">
        <p className="technical-status__eyebrow">Revisión del dispositivo</p>
        <h1 id="diagnostic-title">Estado del dispositivo</h1>
        <p>
          Revisa aquí si este dispositivo está listo para guardar información y enviarla al
          servidor. Esta revisión no modifica viajes, gastos ni otros datos de la empresa.
        </p>
        <dl className="technical-status__details">
          <div>
            <dt>Versión de la aplicación</dt>
            <dd>{formatBuildLabel("Centro de Control Digital R&T", __APP_VERSION__)}</dd>
          </div>
          <div>
            <dt>Modo de la aplicación</dt>
            <dd>{getEnvironmentLabel(import.meta.env.MODE)}</dd>
          </div>
          <div>
            <dt>Uso sin conexión</dt>
            <dd>{getPwaShellLabel(pwaShellStatus)}</dd>
          </div>
          <div>
            <dt>Conexión detectada</dt>
            <dd>{getNetworkLabel(networkStatus)}</dd>
          </div>
          <div>
            <dt>Configuración del servidor</dt>
            <dd>{getServerConfigurationLabel(supabaseConfiguration.status)}</dd>
          </div>
          <div>
            <dt>Acceso a la cuenta</dt>
            <dd>{getAuthLabel(authState.status)}</dd>
          </div>
        </dl>
        <AuthenticationPanel />
        <PowerSyncPanel networkStatus={networkStatus} />
      </div>
    </section>
  );
}
