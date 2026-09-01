export interface SupabaseEnvironment {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export type SupabaseConfigurationProblem =
  | "MISSING_URL"
  | "INVALID_URL"
  | "MISSING_PUBLISHABLE_KEY";

export interface SupabaseClientConfiguration {
  readonly url: string;
  readonly publishableKey: string;
}

export type SupabaseConfiguration =
  | {
      readonly status: "CONFIGURED";
      readonly config: SupabaseClientConfiguration;
    }
  | {
      readonly status: "NOT_CONFIGURED";
      readonly problems: readonly SupabaseConfigurationProblem[];
    };

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function readValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function readSupabaseConfiguration(environment: SupabaseEnvironment): SupabaseConfiguration {
  const url = readValue(environment.VITE_SUPABASE_URL);
  const publishableKey = readValue(environment.VITE_SUPABASE_PUBLISHABLE_KEY);
  const problems: SupabaseConfigurationProblem[] = [];

  if (url.length === 0) {
    problems.push("MISSING_URL");
  } else if (!isHttpUrl(url)) {
    problems.push("INVALID_URL");
  }

  if (publishableKey.length === 0) {
    problems.push("MISSING_PUBLISHABLE_KEY");
  }

  if (problems.length > 0) {
    return { status: "NOT_CONFIGURED", problems };
  }

  return {
    status: "CONFIGURED",
    config: { url, publishableKey },
  };
}

const problemMessages: Record<SupabaseConfigurationProblem, string> = {
  MISSING_URL: "Falta completar la conexión del sistema.",
  INVALID_URL: "La conexión del sistema necesita una revisión.",
  MISSING_PUBLISHABLE_KEY: "Falta completar la autorización de conexión de este dispositivo.",
};

export function describeSupabaseConfigurationProblems(
  problems: readonly SupabaseConfigurationProblem[],
): string {
  const details = problems.map((problem) => problemMessages[problem]).join(" ");

  return `${details} Comunícate con Gerencia o con la persona responsable de configurar la aplicación.`;
}
