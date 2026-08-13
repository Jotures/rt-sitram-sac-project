import { formatBuildLabel } from "@rt-sitram/shared";
import { AuthenticationPanel } from "./features/auth/AuthenticationPanel";
import { useAuth } from "./features/auth/AuthProvider";
import { useNetworkStatus } from "./lib/network/use-network-status";
import { usePwaShellStatus } from "./lib/pwa/use-pwa-shell-status";
import { supabaseConfiguration } from "./lib/supabase";
import "./App.css";

const applicationName = "Centro de Control Digital R&T";

export function App(): React.JSX.Element {
  const { state: authState } = useAuth();
  const networkStatus = useNetworkStatus();
  const pwaShellStatus = usePwaShellStatus();
  const supabaseStatus =
    supabaseConfiguration.status === "CONFIGURED" ? "Configured" : "Not configured";

  return (
    <main className="technical-status" aria-labelledby="technical-status-title">
      <section className="technical-status__card">
        <p className="technical-status__eyebrow">Technical Spike</p>
        <h1 id="technical-status-title">Shell PWA y Auth base</h1>
        <p>
          Esta pantalla técnica verifica infraestructura. No contiene funcionalidades ni datos de
          negocio.
        </p>

        <dl className="technical-status__details">
          <div>
            <dt>Build</dt>
            <dd>{formatBuildLabel(applicationName, __APP_VERSION__)}</dd>
          </div>
          <div>
            <dt>Environment</dt>
            <dd>{import.meta.env.MODE}</dd>
          </div>
          <div>
            <dt>App</dt>
            <dd>Ready</dd>
          </div>
          <div>
            <dt>PWA</dt>
            <dd>{pwaShellStatus === "READY" ? "Ready" : "Not ready"}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{networkStatus}</dd>
          </div>
          <div>
            <dt>Supabase</dt>
            <dd>{supabaseStatus}</dd>
          </div>
          <div>
            <dt>Auth</dt>
            <dd>{authState.status}</dd>
          </div>
        </dl>

        <AuthenticationPanel />

        <p className="technical-status__notice">
          ONLINE/OFFLINE es solo una señal de experiencia de usuario. El shell PWA almacena
          únicamente archivos estáticos; SQLite/PowerSync será la futura fuente local de datos
          empresariales.
        </p>
        {authState.session === null ? null : (
          <p className="technical-status__notice">
            La sesión de Auth puede estar almacenada localmente. No equivale a identidad verificada
            por servidor ni a autorización RLS.
          </p>
        )}
      </section>
    </main>
  );
}
