import { GpsProviderError, type GpsProviderErrorCode } from "@rt-sitram/integrations";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright-core";
import type { GoldcarCsvSchemaInspectionConfig } from "./config";
import { loginGoldcarPortal } from "./playwright-source";
import { assertGoldcarCsvExportUrl, installGoldcarReadOnlyRouting } from "./read-policy";

export type GoldcarCsvSchemaInspectionFailurePhase =
  | "CONFIGURATION"
  | "BROWSER_LAUNCH"
  | "LOGIN"
  | "FETCH_CSV"
  | "PARSE_CSV";

export interface GoldcarCsvSchemaInspectionSummary {
  readonly headers: readonly string[];
  readonly rowCount: number;
}

export interface GoldcarCsvSchemaInspectionOutput {
  readonly status: "completed";
  readonly headers: readonly string[];
  readonly rowCount: number;
}

export interface GoldcarCsvSchemaInspectionFailureOutput {
  readonly status: "failed";
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarCsvSchemaInspectionFailurePhase;
}

export interface GoldcarCsvSchemaResponseMetadata {
  readonly status: number;
  readonly responseUrl: string;
  readonly contentType: string | undefined;
  readonly contentLength: string | undefined;
}

export interface GoldcarCsvSchemaInspectionDependencies {
  readonly launchBrowser: (options: LaunchOptions) => Promise<Browser>;
  readonly login: (page: Page, config: GoldcarCsvSchemaInspectionConfig) => Promise<void>;
}

const defaultGoldcarCsvSchemaInspectionDependencies: GoldcarCsvSchemaInspectionDependencies = {
  launchBrowser: (options) => chromium.launch(options),
  login: loginGoldcarPortal,
};

/**
 * Reads exactly the existing visible CSV export once and returns schema-only
 * metadata. The raw CSV exists only in this ephemeral process and never
 * crosses the CLI boundary.
 */
export class PlaywrightGoldcarCsvSchemaInspector {
  readonly #config: GoldcarCsvSchemaInspectionConfig;
  readonly #dependencies: GoldcarCsvSchemaInspectionDependencies;

  constructor(
    config: GoldcarCsvSchemaInspectionConfig,
    dependencies: GoldcarCsvSchemaInspectionDependencies = defaultGoldcarCsvSchemaInspectionDependencies,
  ) {
    this.#config = config;
    this.#dependencies = dependencies;
  }

  async inspect(): Promise<GoldcarCsvSchemaInspectionSummary> {
    let browser: Browser | null = null;
    try {
      const launchedBrowser = await runGoldcarCsvSchemaInspectionPhase("BROWSER_LAUNCH", () =>
        this.#dependencies.launchBrowser(createLaunchOptions(this.#config)),
      );
      browser = launchedBrowser;
      const context = await runGoldcarCsvSchemaInspectionPhase("BROWSER_LAUNCH", () =>
        launchedBrowser.newContext({
          acceptDownloads: false,
          serviceWorkers: "block",
        }),
      );
      await runGoldcarCsvSchemaInspectionPhase("BROWSER_LAUNCH", () =>
        installGoldcarReadOnlyRouting(context, this.#config.baseUrl),
      );
      const page = await runGoldcarCsvSchemaInspectionPhase("BROWSER_LAUNCH", () =>
        context.newPage(),
      );
      page.setDefaultTimeout(this.#config.timeoutMs);
      page.setDefaultNavigationTimeout(this.#config.timeoutMs);

      await runGoldcarCsvSchemaInspectionPhase("LOGIN", () =>
        this.#dependencies.login(page, this.#config),
      );
      const csv = await runGoldcarCsvSchemaInspectionPhase("FETCH_CSV", async () => {
        const exportUrl = new URL("/objects/list/data?action=csv", this.#config.baseUrl);
        assertGoldcarCsvExportUrl(exportUrl, this.#config.baseUrl);
        const response = await context.request.get(exportUrl.toString(), {
          failOnStatusCode: false,
          headers: { Accept: "text/csv,application/csv,text/plain;q=0.9,*/*;q=0.1" },
          maxRedirects: 0,
          timeout: this.#config.timeoutMs,
        });
        assertGoldcarCsvSchemaResponse(
          {
            status: response.status(),
            responseUrl: response.url(),
            contentType: response.headers()["content-type"],
            contentLength: response.headers()["content-length"],
          },
          exportUrl,
          this.#config.baseUrl,
          this.#config.maxResponseBytes,
        );
        const body = await response.body();
        if (body.byteLength > this.#config.maxResponseBytes) {
          throw new GpsProviderError(
            "MALFORMED_RESPONSE",
            "La exportación CSV Goldcar supera el tamaño máximo autorizado.",
          );
        }
        return new TextDecoder("utf-8", { fatal: true }).decode(body);
      });
      return runGoldcarCsvSchemaInspectionPhase("PARSE_CSV", () =>
        inspectGoldcarCsvSchema(csv, this.#config.maxAssets),
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}

export function assertGoldcarCsvSchemaResponse(
  metadata: GoldcarCsvSchemaResponseMetadata,
  requestedUrl: URL,
  baseUrl: URL,
  maxResponseBytes: number,
): void {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El máximo de bytes CSV debe ser un entero positivo seguro.",
    );
  }
  if (metadata.status >= 300 && metadata.status < 400) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "La inspección de esquema CSV no admite redirecciones Goldcar.",
    );
  }
  if (metadata.status === 401 || metadata.status === 403) {
    throw new GpsProviderError("UNAUTHORIZED", "Goldcar rechazó la exportación CSV autorizada.");
  }
  if (metadata.status === 429) {
    throw new GpsProviderError("RATE_LIMITED", "Goldcar limitó temporalmente la exportación CSV.");
  }
  if (metadata.status < 200 || metadata.status >= 300) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "Goldcar no completó la exportación CSV autorizada.",
    );
  }

  let responseUrl: URL;
  try {
    responseUrl = new URL(metadata.responseUrl);
  } catch {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar devolvió una URL de exportación CSV no válida.",
    );
  }
  assertGoldcarCsvExportUrl(requestedUrl, baseUrl);
  assertGoldcarCsvExportUrl(responseUrl, baseUrl);
  if (responseUrl.href !== requestedUrl.href) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      "Goldcar no respondió exactamente en la exportación CSV autorizada.",
    );
  }

  if (!isAllowedGoldcarCsvContentType(metadata.contentType)) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no devolvió un contenido CSV autorizado.",
    );
  }

  const contentLength = metadata.contentLength;
  if (contentLength === undefined || !/^\d+$/u.test(contentLength)) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "Goldcar no declaró un tamaño de exportación CSV verificable.",
    );
  }
  if (Number(contentLength) > maxResponseBytes) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "La exportación CSV Goldcar supera el tamaño máximo autorizado.",
    );
  }
}

/**
 * Parses the header row and counts nonblank, structurally complete data rows
 * without returning any asset value. Delimiter, quoting, duplicate headers,
 * header safety, row width, and row count are all fail-closed.
 */
export function inspectGoldcarCsvSchema(
  csv: string,
  maxRows: number,
): GoldcarCsvSchemaInspectionSummary {
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    throw new GpsProviderError("CONFIGURATION", "El máximo de filas CSV debe ser positivo.");
  }
  const input = csv.replace(/^\uFEFF/u, "");
  if (input.trim() === "") {
    throw new GpsProviderError("MALFORMED_RESPONSE", "La exportación CSV Goldcar está vacía.");
  }
  const delimiter = detectGoldcarCsvDelimiter(input);
  return parseGoldcarCsvSchema(input, delimiter, maxRows);
}

export function toGoldcarCsvSchemaInspectionOutput(
  summary: GoldcarCsvSchemaInspectionSummary,
): GoldcarCsvSchemaInspectionOutput {
  return { status: "completed", headers: summary.headers, rowCount: summary.rowCount };
}

export function toGoldcarCsvSchemaInspectionFailureOutput(
  error: unknown,
): GoldcarCsvSchemaInspectionFailureOutput {
  const failure =
    error instanceof GoldcarCsvSchemaInspectionError
      ? error
      : classifyGoldcarCsvSchemaInspectionFailure(
          error instanceof GpsProviderError ? "CONFIGURATION" : "BROWSER_LAUNCH",
          error,
        );
  return { status: "failed", code: failure.code, phase: failure.phase };
}

function createLaunchOptions(config: GoldcarCsvSchemaInspectionConfig): LaunchOptions {
  return {
    headless: config.headless,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
}

function detectGoldcarCsvDelimiter(input: string): "," | ";" {
  let commaCount = 0;
  let semicolonCount = 0;
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === "\n" || character === "\r") {
      if (quoted) {
        throw malformedCsv("El encabezado CSV Goldcar no puede ocupar varias líneas.");
      }
      break;
    }
    if (!quoted && character === ",") commaCount += 1;
    if (!quoted && character === ";") semicolonCount += 1;
  }
  if (quoted) throw malformedCsv("El encabezado CSV Goldcar tiene una comilla sin cierre.");
  if ((commaCount > 0 && semicolonCount > 0) || (commaCount === 0 && semicolonCount === 0)) {
    throw malformedCsv("El delimitador CSV Goldcar no es inequívoco.");
  }
  return commaCount > 0 ? "," : ";";
}

function parseGoldcarCsvSchema(
  input: string,
  delimiter: "," | ";",
  maxRows: number,
): GoldcarCsvSchemaInspectionSummary {
  let inQuotes = false;
  let closedQuote = false;
  let fieldAtStart = true;
  let fieldHasNonWhitespaceContent = false;
  let rowHasNonWhitespaceContent = false;
  let rowTouched = false;
  let headerComplete = false;
  let headerField = "";
  let headerFields: string[] = [];
  let dataColumnCount = 0;
  let rowCount = 0;

  const finishField = (): void => {
    if (!headerComplete) {
      headerFields.push(headerField);
      headerField = "";
    } else {
      dataColumnCount += 1;
      if (fieldHasNonWhitespaceContent) rowHasNonWhitespaceContent = true;
    }
    fieldAtStart = true;
    closedQuote = false;
    fieldHasNonWhitespaceContent = false;
  };

  const finishRow = (): void => {
    if (!headerComplete) {
      headerFields = normalizeGoldcarCsvHeaders(headerFields);
      headerComplete = true;
    } else if (rowTouched) {
      if (dataColumnCount !== headerFields.length) {
        throw malformedCsv("Una fila CSV Goldcar no coincide con el encabezado aprobado.");
      }
      if (rowHasNonWhitespaceContent) {
        rowCount += 1;
        if (rowCount > maxRows) {
          throw malformedCsv("La exportación CSV supera el máximo de filas autorizado.");
        }
      }
    }
    rowHasNonWhitespaceContent = false;
    rowTouched = false;
    dataColumnCount = 0;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (inQuotes) {
      rowTouched = true;
      if (character === '"') {
        if (input[index + 1] === '"') {
          if (!headerComplete) {
            headerField += '"';
            assertGoldcarCsvHeaderFieldLength(headerField);
          }
          fieldHasNonWhitespaceContent = true;
          index += 1;
        } else {
          inQuotes = false;
          closedQuote = true;
        }
      } else {
        if (character === "\r" || character === "\n") {
          throw malformedCsv("La exportación CSV Goldcar no admite campos de varias líneas.");
        }
        if (!headerComplete) {
          headerField += character;
          assertGoldcarCsvHeaderFieldLength(headerField);
        }
        if (!/\s/u.test(character)) fieldHasNonWhitespaceContent = true;
      }
      continue;
    }

    if (character === '"') {
      if (!fieldAtStart) throw malformedCsv("La exportación CSV contiene una comilla inesperada.");
      inQuotes = true;
      fieldAtStart = false;
      rowTouched = true;
      continue;
    }
    if (closedQuote && character !== delimiter && character !== "\r" && character !== "\n") {
      throw malformedCsv("La exportación CSV contiene texto después de una comilla de cierre.");
    }
    if (character === delimiter) {
      finishField();
      rowTouched = true;
      continue;
    }
    if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      else if (character === "\r")
        throw malformedCsv("La exportación CSV usa un salto de línea no válido.");
      finishField();
      finishRow();
      continue;
    }

    if (!headerComplete) {
      headerField += character;
      assertGoldcarCsvHeaderFieldLength(headerField);
    }
    if (!/\s/u.test(character)) fieldHasNonWhitespaceContent = true;
    fieldAtStart = false;
    rowTouched = true;
  }

  if (inQuotes) throw malformedCsv("La exportación CSV contiene una comilla sin cierre.");
  if (rowTouched) {
    finishField();
    finishRow();
  }
  if (!headerComplete) {
    throw malformedCsv("La exportación CSV Goldcar no contiene un encabezado válido.");
  }
  return { headers: headerFields, rowCount };
}

function normalizeGoldcarCsvHeaders(rawHeaders: readonly string[]): string[] {
  if (rawHeaders.length < 1 || rawHeaders.length > 64) {
    throw malformedCsv("El encabezado CSV Goldcar tiene una cantidad de columnas no permitida.");
  }
  const headers = rawHeaders.map((header) =>
    decodeKnownHtmlEntities(header)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/gu, ""),
  );
  if (headers.some((header) => !/^[a-z][a-z0-9]{0,63}$/u.test(header))) {
    throw malformedCsv("El encabezado CSV Goldcar contiene un nombre de columna no permitido.");
  }
  if (new Set(headers).size !== headers.length) {
    throw malformedCsv("El encabezado CSV Goldcar contiene columnas duplicadas.");
  }
  return headers;
}

function assertGoldcarCsvHeaderFieldLength(headerField: string): void {
  if (headerField.length > 512) {
    throw malformedCsv("El encabezado CSV Goldcar supera el tamaño de columna autorizado.");
  }
}

function isAllowedGoldcarCsvContentType(contentType: string | undefined): boolean {
  const mediaType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/csv" || mediaType === "application/csv" || mediaType === "text/plain";
}

function decodeKnownHtmlEntities(value: string): string {
  const entities: Readonly<Record<string, string>> = {
    "&aacute;": "á",
    "&eacute;": "é",
    "&iacute;": "í",
    "&oacute;": "ó",
    "&uacute;": "ú",
    "&ntilde;": "ñ",
    "&amp;": "&",
  };
  return value.replace(/&[a-z]+;/giu, (entity) => entities[entity.toLowerCase()] ?? entity);
}

function malformedCsv(message: string): GpsProviderError {
  return new GpsProviderError("MALFORMED_RESPONSE", message);
}

export class GoldcarCsvSchemaInspectionError extends Error {
  readonly code: GpsProviderErrorCode;
  readonly phase: GoldcarCsvSchemaInspectionFailurePhase;

  constructor(phase: GoldcarCsvSchemaInspectionFailurePhase, code: GpsProviderErrorCode) {
    super("La inspección de esquema CSV Goldcar no completó la fase solicitada.");
    this.name = "GoldcarCsvSchemaInspectionError";
    this.phase = phase;
    this.code = code;
  }
}

export function classifyGoldcarCsvSchemaInspectionFailure(
  phase: GoldcarCsvSchemaInspectionFailurePhase,
  error: unknown,
): GoldcarCsvSchemaInspectionError {
  if (error instanceof GoldcarCsvSchemaInspectionError) return error;
  if (error instanceof GpsProviderError)
    return new GoldcarCsvSchemaInspectionError(phase, error.code);
  return new GoldcarCsvSchemaInspectionError(phase, "UNAVAILABLE");
}

async function runGoldcarCsvSchemaInspectionPhase<T>(
  phase: GoldcarCsvSchemaInspectionFailurePhase,
  operation: () => Promise<T> | T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw classifyGoldcarCsvSchemaInspectionFailure(phase, error);
  }
}
