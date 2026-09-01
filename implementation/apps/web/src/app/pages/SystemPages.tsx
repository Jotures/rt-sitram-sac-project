import { useState } from "react";
import { Button } from "../../components/primitives/Button";
import { useAuth } from "../../features/auth/AuthProvider";
import { useIdentity } from "../../features/identity/IdentityProvider";

function getNoAccessMessage(state: ReturnType<typeof useIdentity>["state"]): string {
  if (state.status !== "UNAVAILABLE") {
    return "Tu cuenta todavía no tiene acceso activo al centro de control.";
  }

  switch (state.reason) {
    case "NOT_CONFIGURED":
      return "Este dispositivo todavía no está listo para abrir el centro de control. Comunícate con Gerencia.";
    case "NOT_FOUND":
      return "Tu cuenta existe, pero todavía no fue habilitada para usar el centro de control.";
    case "QUERY_FAILED":
      return "No pudimos comprobar los permisos de tu cuenta en este momento. Revisa tu conexión e inténtalo más tarde.";
    case "INVALID_DATA":
      return "Tu cuenta necesita una revisión antes de poder ingresar. Comunícate con Gerencia.";
  }
}

export function NoAccessPage(): React.JSX.Element {
  const { state } = useIdentity();
  const { signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const message = getNoAccessMessage(state);

  const handleSignOut = async (): Promise<void> => {
    setSignOutError(null);
    const result = await signOut();

    if (!result.ok) {
      setSignOutError(result.message);
    }
  };

  return (
    <main className="system-page">
      <section className="system-page__panel">
        <span className="system-page__code">Estado del acceso</span>
        <h1>Tu cuenta aún no está habilitada</h1>
        <p>{message}</p>
        <p className="system-page__hint">
          No necesitas crear otra cuenta. Gerencia debe revisar la habilitación y el rol asignado.
        </p>
        {signOutError === null ? null : <p role="alert">{signOutError}</p>}
        <Button onClick={() => void handleSignOut()} variant="secondary">
          Cerrar sesión en este dispositivo
        </Button>
      </section>
    </main>
  );
}

export function NotFoundPage(): React.JSX.Element {
  return (
    <section className="system-page system-page--embedded">
      <div className="system-page__panel">
        <span className="system-page__code">Página no disponible</span>
        <h1>No encontramos esta página</h1>
        <p>La dirección que abriste no pertenece al centro de control.</p>
        <Button onClick={() => window.history.back()} variant="secondary">
          Volver a la página anterior
        </Button>
      </div>
    </section>
  );
}

export function LoadingPage(): React.JSX.Element {
  return (
    <main className="app-loading" aria-live="polite">
      <span className="app-loading__mark" aria-hidden="true">
        R&amp;T
      </span>
      <p>Verificando acceso…</p>
    </main>
  );
}
