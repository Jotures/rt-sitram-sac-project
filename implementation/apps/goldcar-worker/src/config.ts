import { GpsProviderError } from "@rt-sitram/integrations";
import { normalizeGoldcarPortalNameCanonicalId } from "./goldcar-target";

export type GoldcarBrowserChannel = "chrome" | "msedge";

export interface GoldcarWorkerConfig {
  readonly baseUrl: URL;
  readonly email: string;
  readonly password: string;
  readonly timeZoneOffset: string;
  readonly maxAssets: number;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly headless: boolean;
  readonly browserChannel?: GoldcarBrowserChannel;
  readonly browserExecutablePath?: string;
}

export interface GoldcarManualSyncConfig extends GoldcarWorkerConfig {
  readonly supabaseUrl: URL;
  readonly supabaseServiceRoleKey: string;
  readonly companyId: string;
  readonly operatorProfileId: string;
  readonly leaseSeconds: number;
  readonly maxDurationSeconds: number;
  readonly persistenceMaxAttempts: number;
  readonly persistenceRetryBaseMs: number;
}

/**
 * A deliberately separate, ephemeral read of the visible sensor detail for
 * one approved Goldcar asset. It cannot persist telemetry or accept an
 * arbitrary portal route from the environment.
 */
export interface GoldcarSensorInspectionConfig extends GoldcarWorkerConfig {
  readonly sensorTargetCanonicalId: string;
  /**
   * This literal is present only when both sensor-specific kill switches are
   * enabled. It cannot carry a route, method, or caller-controlled limit.
   */
  readonly objectsBootstrapAllowDynamicRead: true;
}

/**
 * A separate, ephemeral diagnostic for the one approved visible target in
 * `/objects`. Unlike sensor inspection, it never opens a detail document or
 * reads a sensor value. Its only output is a fixed availability category and
 * fixed routing-policy flags.
 */
export interface GoldcarTargetAvailabilityInspectionConfig extends GoldcarWorkerConfig {
  readonly sensorTargetCanonicalId: string;
  /**
   * This literal is present only after the availability-specific and
   * DEC-033 bootstrap switches have both passed. It cannot carry a route,
   * method, or caller-controlled request limit.
   */
  readonly objectsBootstrapAllowDynamicRead: true;
}

/**
 * A separate one-shot read of the already approved CSV export. It has no
 * persistence settings and exposes only schema metadata to its CLI caller.
 */
export type GoldcarCsvSchemaInspectionConfig = GoldcarWorkerConfig;

/**
 * A passive, non-persistent observation of requests that the existing
 * objects page attempts to initiate. Candidate XHR/fetch requests are
 * intercepted and aborted before they can leave the browser.
 */
export type GoldcarRequestManifestInspectionConfig = GoldcarWorkerConfig;

/**
 * A passive, non-persistent classification of static resources that the
 * existing request policy already blocks while loading the objects page.
 */
export type GoldcarStaticResourceManifestInspectionConfig = GoldcarWorkerConfig;

export function loadGoldcarWorkerConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarWorkerConfig {
  if (environment.GOLDCAR_PORTAL_ALLOW_LIVE_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La lectura live de Goldcar está deshabilitada por el kill switch.",
    );
  }

  const baseUrl = parseBaseUrl(
    environment.GOLDCAR_PORTAL_BASE_URL ?? "https://satelital.gpsgoldcar.com",
  );
  const browserChannel = parseBrowserChannel(environment.GOLDCAR_BROWSER_CHANNEL);
  const browserExecutablePath = optionalSecret(environment.GOLDCAR_BROWSER_EXECUTABLE_PATH);
  if (browserChannel && browserExecutablePath) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "Configure un canal de navegador o una ruta de ejecutable, no ambos.",
    );
  }

  return {
    baseUrl,
    email: requiredSecret(environment.GOLDCAR_PORTAL_EMAIL, "correo técnico de Goldcar"),
    password: requiredSecret(environment.GOLDCAR_PORTAL_PASSWORD, "contraseña técnica de Goldcar"),
    timeZoneOffset: parseTimeZoneOffset(environment.GOLDCAR_PORTAL_TIME_ZONE_OFFSET ?? "-05:00"),
    maxAssets: parseBoundedInteger(
      environment.GOLDCAR_PORTAL_MAX_ASSETS ?? "100",
      "máximo de activos",
      1,
      1_000,
    ),
    timeoutMs: parseBoundedInteger(
      environment.GOLDCAR_PORTAL_TIMEOUT_MS ?? "30000",
      "timeout",
      5_000,
      60_000,
    ),
    maxResponseBytes: parseBoundedInteger(
      environment.GOLDCAR_PORTAL_MAX_RESPONSE_BYTES ?? "1000000",
      "máximo de bytes de respuesta",
      1_024,
      5_000_000,
    ),
    headless: environment.GOLDCAR_BROWSER_HEADLESS !== "false",
    ...(browserChannel ? { browserChannel } : {}),
    ...(browserExecutablePath ? { browserExecutablePath } : {}),
  };
}

/**
 * The persistence command has its own explicit gate. It deliberately reuses
 * the read gate, so a manual sync cannot silently turn a disabled portal PoC
 * into a data-writing process.
 */
export function loadGoldcarManualSyncConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarManualSyncConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_SYNC_ALLOW_PERSIST !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La persistencia manual de Goldcar está deshabilitada por su kill switch.",
    );
  }

  const leaseSeconds = parseBoundedInteger(
    environment.GOLDCAR_SYNC_LEASE_SECONDS ?? "120",
    "lease de sincronización",
    15,
    120,
  );
  const maxDurationSeconds = parseBoundedInteger(
    environment.GOLDCAR_SYNC_MAX_DURATION_SECONDS ?? "240",
    "duración máxima de sincronización",
    30,
    300,
  );
  if (leaseSeconds > maxDurationSeconds) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El lease de sincronización no puede superar su duración máxima.",
    );
  }
  if (leaseSeconds * 1_000 <= workerConfig.timeoutMs * 3 + 10_000) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El lease de sincronización no cubre los timeouts autorizados del portal.",
    );
  }

  return {
    ...workerConfig,
    supabaseUrl: parseSupabaseUrl(
      requiredSecret(environment.SUPABASE_URL, "URL server-side de Supabase"),
    ),
    supabaseServiceRoleKey: requiredSecret(
      environment.SUPABASE_SERVICE_ROLE_KEY,
      "clave service role de Supabase",
    ),
    companyId: parseUuid(
      requiredSecret(environment.GOLDCAR_SYNC_COMPANY_ID, "empresa de sincronización"),
      "empresa de sincronización",
    ),
    operatorProfileId: parseUuid(
      requiredSecret(
        environment.GOLDCAR_SYNC_OPERATOR_PROFILE_ID,
        "perfil de Gerencia autorizador",
      ),
      "perfil de Gerencia autorizador",
    ),
    leaseSeconds,
    maxDurationSeconds,
    persistenceMaxAttempts: parseBoundedInteger(
      environment.GOLDCAR_SYNC_PERSISTENCE_MAX_ATTEMPTS ?? "3",
      "máximo de intentos de persistencia",
      1,
      3,
    ),
    persistenceRetryBaseMs: parseBoundedInteger(
      environment.GOLDCAR_SYNC_PERSISTENCE_RETRY_BASE_MS ?? "250",
      "backoff base de persistencia",
      100,
      5_000,
    ),
  };
}

/**
 * Sensor inspection is intentionally not covered by the snapshot or
 * persistence switches. The target is a canonical, approved selector that is
 * kept only in process and is redacted from diagnostics.
 */
export function loadGoldcarSensorInspectionConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarSensorInspectionConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_SENSOR_INSPECTION_ALLOW_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La inspección de sensores Goldcar está deshabilitada por su kill switch.",
    );
  }
  if (environment.GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El bootstrap dinámico de objetos Goldcar está deshabilitado por su kill switch.",
    );
  }

  return {
    ...workerConfig,
    objectsBootstrapAllowDynamicRead: true,
    sensorTargetCanonicalId: normalizeGoldcarPortalNameCanonicalId(
      requiredSecret(
        environment.GOLDCAR_SENSOR_TARGET_CANONICAL_ID,
        "identificador canónico de la unidad aprobada",
      ),
    ),
  };
}

/**
 * This availability diagnostic has its own kill switch so a caller cannot
 * accidentally turn a sensor-detail read into a list-rendering probe. It
 * deliberately shares the same constrained canonical target selector but
 * does not require or enable the sensor-detail switch.
 */
export function loadGoldcarTargetAvailabilityInspectionConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarTargetAvailabilityInspectionConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_TARGET_AVAILABILITY_INSPECTION_ALLOW_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La inspección de disponibilidad Goldcar está deshabilitada por su kill switch.",
    );
  }
  if (environment.GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El bootstrap dinámico de objetos Goldcar está deshabilitado por su kill switch.",
    );
  }

  return {
    ...workerConfig,
    objectsBootstrapAllowDynamicRead: true,
    sensorTargetCanonicalId: normalizeGoldcarPortalNameCanonicalId(
      requiredSecret(
        environment.GOLDCAR_SENSOR_TARGET_CANONICAL_ID,
        "identificador canónico de la unidad aprobada",
      ),
    ),
  };
}

export function loadGoldcarCsvSchemaInspectionConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarCsvSchemaInspectionConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_CSV_SCHEMA_INSPECTION_ALLOW_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La inspección de esquema CSV Goldcar está deshabilitada por su kill switch.",
    );
  }
  return workerConfig;
}

export function loadGoldcarRequestManifestInspectionConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarRequestManifestInspectionConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_REQUEST_MANIFEST_INSPECTION_ALLOW_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La inspección pasiva de solicitudes Goldcar está deshabilitada por su kill switch.",
    );
  }
  return workerConfig;
}

export function loadGoldcarStaticResourceManifestInspectionConfig(
  environment: Readonly<NodeJS.ProcessEnv>,
): GoldcarStaticResourceManifestInspectionConfig {
  const workerConfig = loadGoldcarWorkerConfig(environment);
  if (environment.GOLDCAR_STATIC_RESOURCE_MANIFEST_INSPECTION_ALLOW_READ !== "true") {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La inspección pasiva de recursos estáticos Goldcar está deshabilitada por su kill switch.",
    );
  }
  return workerConfig;
}

export function sanitizeGoldcarError(
  error: unknown,
  config: Pick<GoldcarWorkerConfig, "email" | "password">,
): string {
  return sanitizeMessage(error, [config.email, config.password]);
}

export function sanitizeGoldcarManualSyncError(
  error: unknown,
  config: Pick<GoldcarManualSyncConfig, "email" | "password" | "supabaseServiceRoleKey">,
): string {
  return sanitizeMessage(error, [config.email, config.password, config.supabaseServiceRoleKey]);
}

export function sanitizeGoldcarSensorInspectionError(
  error: unknown,
  config: Pick<GoldcarSensorInspectionConfig, "email" | "password" | "sensorTargetCanonicalId">,
): string {
  return sanitizeMessage(error, [config.email, config.password, config.sensorTargetCanonicalId]);
}

export function sanitizeGoldcarTargetAvailabilityInspectionError(
  error: unknown,
  config: Pick<
    GoldcarTargetAvailabilityInspectionConfig,
    "email" | "password" | "sensorTargetCanonicalId"
  >,
): string {
  return sanitizeMessage(error, [config.email, config.password, config.sensorTargetCanonicalId]);
}

function sanitizeMessage(error: unknown, secrets: readonly string[]): string {
  let message = error instanceof Error ? error.message : "Falla desconocida del worker Goldcar.";
  for (const secret of secrets) {
    if (secret !== "") message = message.replaceAll(secret, "[REDACTED]");
  }
  message = message.replace(/https?:\/\/[^\s]+/giu, "[URL_REDACTED]");
  return message.slice(0, 500);
}

function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GpsProviderError("CONFIGURATION", "La URL base de Goldcar no es válida.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "satelital.gpsgoldcar.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La URL base debe ser el host HTTPS aprobado de satelital.gpsgoldcar.com.",
    );
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function parseSupabaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new GpsProviderError("CONFIGURATION", "La URL server-side de Supabase no es válida.");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname === "" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La URL server-side de Supabase debe ser una raíz HTTPS sin ruta ni credenciales.",
    );
  }
  return url;
}

function parseUuid(value: string, label: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) {
    throw new GpsProviderError("CONFIGURATION", `El valor de ${label} debe ser un UUID válido.`);
  }
  return value.toLowerCase();
}

function requiredSecret(value: string | undefined, label: string): string {
  if (value === undefined || value.trim() === "") {
    throw new GpsProviderError("CONFIGURATION", `Falta configurar ${label}.`);
  }
  return value;
}

function optionalSecret(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim();
}

function parseBrowserChannel(value: string | undefined): GoldcarBrowserChannel | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (value === "chrome" || value === "msedge") return value;
  throw new GpsProviderError("CONFIGURATION", "El canal de navegador debe ser chrome o msedge.");
}

function parseTimeZoneOffset(value: string): string {
  if (!/^[+-](?:0\d|1\d|2[0-3]):[0-5]\d$/u.test(value)) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "La zona horaria de Goldcar debe tener formato +HH:MM o -HH:MM.",
    );
  }
  return value;
}

function parseBoundedInteger(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/u.test(value)) {
    throw new GpsProviderError("CONFIGURATION", `${label} debe ser un entero.`);
  }
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    throw new GpsProviderError(
      "CONFIGURATION",
      `${label} debe estar entre ${minimum} y ${maximum}.`,
    );
  }
  return parsed;
}
