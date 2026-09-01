import { useEffect, useMemo, useState, type FormEvent, type PropsWithChildren } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLockup, BrandRouteMotif } from "../../components/brand/BrandLockup";
import { Button } from "../../components/primitives/Button";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  createSanitizedPasswordSetupUrl,
  inspectPasswordRequirements,
  inspectPasswordSetupLink,
  validatePasswordSetup,
} from "../../features/auth/password-setup";
import { describeSupabaseConfigurationProblems, supabaseConfiguration } from "../../lib/supabase";
import { routePaths } from "../routing/route-model";
import "./login-page.css";
import "./password-setup-page.css";

function PasswordSetupLayout({ children }: PropsWithChildren): React.JSX.Element {
  return (
    <main className="login-page password-setup-page">
      <section className="login-brand" aria-label="R&T SITRAM SAC">
        <BrandLockup descriptor="Centro de control digital" inverse />
        <BrandRouteMotif className="login-brand__motif" />
        <div className="login-brand__copy">
          <p>Cuenta administrada</p>
          <h1>Tu acceso empieza con una cuenta bien protegida.</h1>
          <p>
            La contraseña protege los viajes, documentos y movimientos que corresponden a tu función
            dentro de R&amp;T SITRAM.
          </p>
        </div>
        <p className="login-brand__footnote">Acceso privado · R&amp;T SITRAM SAC</p>
      </section>

      <section className="login-panel" aria-labelledby="password-setup-title">
        <div className="login-panel__inner">
          <BrandLockup className="login-panel__mobile-brand" descriptor="Centro de control" />
          {children}
        </div>
      </section>
    </main>
  );
}

function InvalidPasswordSetupLink({ message }: { readonly message: string }): React.JSX.Element {
  return (
    <PasswordSetupLayout>
      <p className="login-panel__eyebrow">Enlace no disponible</p>
      <h2 id="password-setup-title">No pudimos validar tu acceso</h2>
      <div className="password-setup__notice password-setup__notice--error" role="alert">
        <strong>Necesitas un enlace vigente</strong>
        <p>{message}</p>
      </div>
      <Link className="password-setup__link" replace to={routePaths.login}>
        Volver al inicio de sesión
      </Link>
    </PasswordSetupLayout>
  );
}

export function PasswordSetupPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { state, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [link] = useState(() => inspectPasswordSetupLink(new URL(window.location.href)));
  const requirements = useMemo(() => inspectPasswordRequirements(password), [password]);

  useEffect(() => {
    if (state.status !== "INITIALIZING") {
      const sanitizedUrl = createSanitizedPasswordSetupUrl(new URL(window.location.href));
      window.history.replaceState(window.history.state, "", sanitizedUrl);
    }
  }, [state.status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationError = validatePasswordSetup(password, confirmation);

    if (validationError !== null) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const result = await updatePassword(password);

    if (!result.ok) {
      setPassword("");
      setConfirmation("");
      setFormError(result.message);
      setSubmitting(false);
      return;
    }

    navigate("/", { replace: true });
  };

  if (supabaseConfiguration.status === "NOT_CONFIGURED") {
    return (
      <PasswordSetupLayout>
        <p className="login-panel__eyebrow">Configuración requerida</p>
        <h2 id="password-setup-title">El acceso aún no está disponible</h2>
        <div className="login-panel__configuration" role="alert">
          <strong>El acceso no está listo en este dispositivo</strong>
          <p>{describeSupabaseConfigurationProblems(supabaseConfiguration.problems)}</p>
        </div>
      </PasswordSetupLayout>
    );
  }

  if (link.errorMessage !== null) {
    return <InvalidPasswordSetupLink message={link.errorMessage} />;
  }

  if (link.intent === null) {
    return (
      <InvalidPasswordSetupLink message="Abre esta página desde la invitación enviada a tu correo. Si ya la utilizaste, ingresa normalmente." />
    );
  }

  if (state.status === "INITIALIZING") {
    return (
      <PasswordSetupLayout>
        <p className="login-panel__eyebrow">Verificando acceso</p>
        <h2 id="password-setup-title">Validando tu enlace…</h2>
        <p className="login-panel__intro" aria-live="polite">
          Espera un momento mientras confirmamos tu sesión segura.
        </p>
      </PasswordSetupLayout>
    );
  }

  if (state.status !== "AUTHENTICATED") {
    return (
      <InvalidPasswordSetupLink
        message={
          state.error ??
          "El enlace ya venció, fue utilizado o no es válido. Solicita un nuevo enlace a Gerencia."
        }
      />
    );
  }

  return (
    <PasswordSetupLayout>
      <p className="login-panel__eyebrow">
        {link.intent === "invite" ? "Activa tu cuenta" : "Recupera tu cuenta"}
      </p>
      <h2 id="password-setup-title">Crea una contraseña segura</h2>
      <p className="login-panel__intro">
        {link.intent === "invite"
          ? "Protege tu acceso con una contraseña personal que solo tú conozcas."
          : "Crea una contraseña nueva para recuperar el acceso a tu cuenta."}
      </p>
      <p className="password-setup__account">
        Cuenta: {state.session?.user.email ?? "correo verificado"}
      </p>

      <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
        <label htmlFor="new-password">Nueva contraseña</label>
        <p className="login-form__field-help" id="new-password-help">
          Elige una contraseña que no uses en otros servicios y no la compartas.
        </p>
        <input
          aria-describedby="new-password-help password-requirements"
          autoComplete="new-password"
          disabled={submitting}
          id="new-password"
          maxLength={256}
          name="new-password"
          onChange={(event) => {
            setPassword(event.target.value);
            setFormError(null);
          }}
          required
          type="password"
          value={password}
        />

        <ul
          aria-label="Requisitos de contraseña"
          aria-live="polite"
          className="password-setup__requirements"
          id="password-requirements"
        >
          <li data-complete={requirements.hasMinimumLength}>
            {requirements.hasMinimumLength ? "Cumplido: " : "Pendiente: "}10 caracteres como mínimo
          </li>
          <li data-complete={requirements.hasUppercase && requirements.hasLowercase}>
            {requirements.hasUppercase && requirements.hasLowercase ? "Cumplido: " : "Pendiente: "}
            Una mayúscula y una minúscula
          </li>
          <li data-complete={requirements.hasDigit}>
            {requirements.hasDigit ? "Cumplido: " : "Pendiente: "}Un número
          </li>
        </ul>

        <label htmlFor="confirm-password">Confirma tu contraseña</label>
        <p className="login-form__field-help" id="confirm-password-help">
          Escríbela exactamente igual para confirmar que no tiene errores.
        </p>
        <input
          aria-describedby="confirm-password-help"
          autoComplete="new-password"
          disabled={submitting}
          id="confirm-password"
          maxLength={256}
          name="confirm-password"
          onChange={(event) => {
            setConfirmation(event.target.value);
            setFormError(null);
          }}
          required
          type="password"
          value={confirmation}
        />

        <Button disabled={submitting} type="submit">
          {submitting ? "Guardando contraseña…" : "Guardar contraseña y continuar"}
        </Button>
        {formError === null ? null : (
          <p className="login-form__error" role="alert">
            {formError}
          </p>
        )}
      </form>

      <p className="login-panel__support">
        Este enlace es personal. No lo reenvíes ni compartas tu contraseña.
      </p>
    </PasswordSetupLayout>
  );
}
