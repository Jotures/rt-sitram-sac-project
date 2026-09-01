export const PASSWORD_MINIMUM_LENGTH = 10;

export type PasswordSetupIntent = "invite" | "recovery";

export interface PasswordRequirements {
  readonly hasDigit: boolean;
  readonly hasLowercase: boolean;
  readonly hasMinimumLength: boolean;
  readonly hasUppercase: boolean;
  readonly valid: boolean;
}

export interface PasswordSetupLink {
  readonly errorMessage: string | null;
  readonly intent: PasswordSetupIntent | null;
}

function readParameter(
  queryParameters: URLSearchParams,
  fragmentParameters: URLSearchParams,
  name: string,
): string | null {
  return queryParameters.get(name) ?? fragmentParameters.get(name);
}

function isPasswordSetupIntent(value: string | null): value is PasswordSetupIntent {
  return value === "invite" || value === "recovery";
}

export function inspectPasswordSetupLink(url: URL): PasswordSetupLink {
  const queryParameters = url.searchParams;
  const fragmentParameters = new URLSearchParams(url.hash.replace(/^#/u, ""));
  const intentValue =
    readParameter(queryParameters, fragmentParameters, "intent") ??
    readParameter(queryParameters, fragmentParameters, "type");
  const errorCode = readParameter(queryParameters, fragmentParameters, "error_code");
  const error = readParameter(queryParameters, fragmentParameters, "error");

  if (errorCode !== null || error !== null) {
    return {
      intent: isPasswordSetupIntent(intentValue) ? intentValue : null,
      errorMessage:
        "El enlace ya venció, fue utilizado o no es válido. Solicita una nueva invitación a Gerencia.",
    };
  }

  return {
    intent: isPasswordSetupIntent(intentValue) ? intentValue : null,
    errorMessage: null,
  };
}

export function inspectPasswordRequirements(password: string): PasswordRequirements {
  const hasDigit = /[0-9]/u.test(password);
  const hasLowercase = /[a-z]/u.test(password);
  const hasMinimumLength = password.length >= PASSWORD_MINIMUM_LENGTH;
  const hasUppercase = /[A-Z]/u.test(password);

  return {
    hasDigit,
    hasLowercase,
    hasMinimumLength,
    hasUppercase,
    valid: hasDigit && hasLowercase && hasMinimumLength && hasUppercase,
  };
}

export function validatePasswordSetup(password: string, confirmation: string): string | null {
  if (!inspectPasswordRequirements(password).valid) {
    return "La contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula y un número.";
  }

  if (password !== confirmation) {
    return "Las contraseñas no coinciden.";
  }

  return null;
}

export function createSanitizedPasswordSetupUrl(url: URL): string {
  const sanitizedUrl = new URL(url);
  const sensitiveParameters = [
    "access_token",
    "code",
    "error",
    "error_code",
    "error_description",
    "expires_at",
    "expires_in",
    "provider_refresh_token",
    "provider_token",
    "refresh_token",
    "token",
    "token_hash",
    "type",
  ];

  sanitizedUrl.hash = "";
  for (const parameter of sensitiveParameters) {
    sanitizedUrl.searchParams.delete(parameter);
  }

  return `${sanitizedUrl.pathname}${sanitizedUrl.search}`;
}
