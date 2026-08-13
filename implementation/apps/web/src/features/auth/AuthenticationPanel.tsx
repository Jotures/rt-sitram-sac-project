import { useState, type FormEvent } from "react";
import { describeSupabaseConfigurationProblems, supabaseConfiguration } from "../../lib/supabase";
import { useAuth } from "./AuthProvider";

export function AuthenticationPanel(): React.JSX.Element {
  const { state, signInWithPassword, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (supabaseConfiguration.status === "NOT_CONFIGURED") {
    return (
      <section className="technical-status__auth" aria-labelledby="auth-title">
        <h2 id="auth-title">Supabase no configurado</h2>
        <p>{describeSupabaseConfigurationProblems(supabaseConfiguration.problems)}</p>
      </section>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);

    await signInWithPassword({ email, password });
    setPassword("");
    setIsSubmitting(false);
  };

  if (state.status === "AUTHENTICATED") {
    return (
      <section className="technical-status__auth" aria-labelledby="auth-title">
        <h2 id="auth-title">Sesión autenticada</h2>
        <p>{state.session?.user.email ?? "Correo no disponible"}</p>
        <button type="button" onClick={() => void signOut()}>
          Cerrar sesión en este dispositivo
        </button>
      </section>
    );
  }

  return (
    <section className="technical-status__auth" aria-labelledby="auth-title">
      <h2 id="auth-title">Acceso técnico</h2>
      <p>Solo usuarios creados administrativamente pueden iniciar sesión.</p>
      <form className="technical-status__form" onSubmit={(event) => void onSubmit(event)}>
        <label>
          Correo
          <input
            autoComplete="email"
            disabled={state.status === "INITIALIZING" || isSubmitting}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Contraseña
          <input
            autoComplete="current-password"
            disabled={state.status === "INITIALIZING" || isSubmitting}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button disabled={state.status === "INITIALIZING" || isSubmitting} type="submit">
          {isSubmitting ? "Verificando…" : "Iniciar sesión"}
        </button>
      </form>
      {state.error === null ? null : <p role="alert">{state.error}</p>}
    </section>
  );
}
