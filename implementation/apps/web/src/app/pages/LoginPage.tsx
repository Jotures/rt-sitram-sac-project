import { useState, type FormEvent } from "react";
import { BrandLockup, BrandRouteMotif } from "../../components/brand/BrandLockup";
import { Button } from "../../components/primitives/Button";
import { useAuth } from "../../features/auth/AuthProvider";
import { describeSupabaseConfigurationProblems, supabaseConfiguration } from "../../lib/supabase";
import "./login-page.css";

export function LoginPage(): React.JSX.Element {
  const { state, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    const result = await signInWithPassword({ email: email.trim(), password });
    if (!result.ok) {
      setPassword("");
    }
    setSubmitting(false);
  };

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="R&T SITRAM SAC">
        <BrandLockup descriptor="Centro de control digital" inverse />
        <BrandRouteMotif className="login-brand__motif" />
        <div className="login-brand__copy">
          <p>Operación de carga · Cusco</p>
          <h1>Del despacho al retorno, sin perder el hilo.</h1>
          <p>
            Viajes, unidades, gastos y rendiciones permanecen conectados a la operación, incluso
            cuando una zona de la ruta no tiene señal.
          </p>
          <ol className="login-brand__continuity" aria-label="Continuidad de la operación">
            <li>
              <span>01</span>
              <strong>Registro local</strong>
              <small>El trabajo continúa sin cobertura.</small>
            </li>
            <li>
              <span>02</span>
              <strong>Envío al reconectar</strong>
              <small>Cada registro conserva su trazabilidad.</small>
            </li>
          </ol>
        </div>
        <p className="login-brand__footnote">R&amp;T SITRAM SAC · Cusco, Perú</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__inner">
          <BrandLockup className="login-panel__mobile-brand" descriptor="Centro de control" />
          <p className="login-panel__eyebrow">Acceso privado</p>
          <h2 id="login-title">Ingresa a tu turno</h2>
          <p className="login-panel__intro">
            Usa la cuenta asignada por Gerencia. El sistema mostrará únicamente las funciones de tu
            rol.
          </p>

          {supabaseConfiguration.status === "NOT_CONFIGURED" ? (
            <div className="login-panel__configuration" role="alert">
              <strong>El acceso no está listo en este dispositivo</strong>
              <p>{describeSupabaseConfigurationProblems(supabaseConfiguration.problems)}</p>
            </div>
          ) : (
            <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
              <label htmlFor="login-email">Correo de trabajo</label>
              <p className="login-form__field-help" id="login-email-help">
                Ejemplo: usuario@empresa.com
              </p>
              <input
                aria-describedby="login-email-help"
                autoComplete="email"
                disabled={submitting || state.status === "INITIALIZING"}
                id="login-email"
                inputMode="email"
                maxLength={254}
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                required
                type="email"
                value={email}
              />

              <label htmlFor="login-password">Contraseña</label>
              <p className="login-form__field-help" id="login-password-help">
                Usa la contraseña que creaste al activar tu cuenta.
              </p>
              <input
                aria-describedby="login-password-help"
                autoComplete="current-password"
                disabled={submitting || state.status === "INITIALIZING"}
                id="login-password"
                maxLength={256}
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />

              <Button disabled={submitting || state.status === "INITIALIZING"} type="submit">
                {submitting ? "Verificando acceso…" : "Ingresar a mi cuenta"}
              </Button>
              {state.error === null ? null : (
                <p className="login-form__error" role="alert">
                  {state.error}
                </p>
              )}
            </form>
          )}

          <p className="login-panel__support">
            Las cuentas se habilitan internamente. Si no puedes ingresar o no reconoces este acceso,
            comunícate con Gerencia.
          </p>
        </div>
      </section>
    </main>
  );
}
