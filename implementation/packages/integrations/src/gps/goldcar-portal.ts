import {
  normalizeGpsPosition,
  normalizeGpsProviderKind,
  type GpsPosition,
  type GpsProviderKind,
} from "@rt-sitram/domain";
import {
  GpsProviderError,
  type GpsExternalAsset,
  type GpsPositionHistoryQuery,
  type GpsProvider,
} from "./contract";

export const GOLDCAR_PORTAL_PROVIDER_KIND = normalizeGpsProviderKind("GOLDCAR_PORTAL_RPA");

export interface GoldcarPortalVehicleSnapshot {
  readonly providerAssetId: string;
  readonly displayName: string;
  readonly connectionStatus: string;
  readonly recordedAt: string | null;
  /** Instant the authorized CSV response was fully received by the source. */
  readonly receivedAt: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface GoldcarPortalSnapshotSource {
  loadVehicleSnapshots(): Promise<readonly GoldcarPortalVehicleSnapshot[]>;
}

export interface GoldcarPortalCsvOptions {
  readonly timeZoneOffset: string;
  readonly maxRows: number;
  readonly receivedAt: string;
}

/**
 * Schema-only view of a Goldcar CSV export. It intentionally excludes every
 * row value so diagnostics cannot retain asset names or location evidence.
 */
export interface GoldcarPortalProviderOptions {
  readonly providerKind?: GpsProviderKind;
}

/**
 * Temporary read-only bridge approved by DEC-029. It consumes a user-visible
 * CSV export and deliberately does not implement historical scraping.
 */
export class GoldcarPortalProvider implements GpsProvider {
  readonly kind: GpsProviderKind;
  readonly #source: GoldcarPortalSnapshotSource;
  #snapshotsPromise: Promise<readonly GoldcarPortalVehicleSnapshot[]> | null = null;

  constructor(source: GoldcarPortalSnapshotSource, options: GoldcarPortalProviderOptions = {}) {
    this.#source = source;
    this.kind = options.providerKind ?? GOLDCAR_PORTAL_PROVIDER_KIND;
  }

  async listAssets(): Promise<readonly GpsExternalAsset[]> {
    const snapshots = await this.loadSnapshots();
    return snapshots.map((snapshot) => ({
      provider: this.kind,
      externalAssetId: snapshot.providerAssetId,
      displayName: snapshot.displayName,
    }));
  }

  async getLatestPosition(externalAssetId: string): Promise<GpsPosition | null> {
    const snapshots = await this.loadSnapshots();
    const snapshot = snapshots.find((candidate) => candidate.providerAssetId === externalAssetId);
    if (!snapshot) {
      throw new GpsProviderError(
        "ASSET_NOT_FOUND",
        "El activo externo no aparece en la exportación autorizada de Goldcar.",
      );
    }
    if (snapshot.recordedAt === null || snapshot.latitude === null || snapshot.longitude === null) {
      return null;
    }

    return normalizeGpsPosition({
      provider: this.kind,
      providerAssetId: snapshot.providerAssetId,
      providerEventId: null,
      recordedAt: snapshot.recordedAt,
      receivedAt: snapshot.receivedAt,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
    });
  }

  async getPositionHistory(_query: GpsPositionHistoryQuery): Promise<readonly GpsPosition[]> {
    throw new GpsProviderError(
      "CONFIGURATION",
      "El puente temporal de Goldcar no tiene habilitada la consulta de histórico.",
    );
  }

  private loadSnapshots(): Promise<readonly GoldcarPortalVehicleSnapshot[]> {
    this.#snapshotsPromise ??= this.#source.loadVehicleSnapshots().catch((error: unknown) => {
      // A failed portal read is not a valid snapshot. Clearing only the failed
      // promise lets a later, explicitly authorized manual invocation retry;
      // it never reuses partial CSV data or a browser session.
      this.#snapshotsPromise = null;
      throw error;
    });
    return this.#snapshotsPromise;
  }
}

export function parseGoldcarVehicleCsv(
  csv: string,
  options: GoldcarPortalCsvOptions,
): readonly GoldcarPortalVehicleSnapshot[] {
  const receivedAt = parseReceivedAt(options.receivedAt);
  assertPositiveInteger(options.maxRows, "El máximo de unidades Goldcar");
  const delimiter = detectDelimiter(csv);
  const rows = parseCsvRows(csv, delimiter);
  if (rows.length === 0) {
    throw malformedCsv("La exportación CSV de Goldcar está vacía.");
  }

  const headers = rows[0]?.map(normalizeHeader) ?? [];
  const nameIndex = requireHeader(headers, "nombre");
  const statusIndex = requireHeader(headers, "estado");
  const recordedAtIndex = requireHeader(headers, "ultimaconexion");
  const positionIndex = requireHeader(headers, "posicion");

  const dataRows = rows.slice(1).filter((row) => row.some((value) => value.trim() !== ""));

  if (dataRows.length > options.maxRows) {
    throw malformedCsv("La exportación CSV supera el máximo de unidades autorizado.");
  }

  const seenAssetIds = new Set<string>();
  return dataRows.map((row) => {
    const displayName = requiredCell(row, nameIndex, "nombre");
    const providerAssetId = createProvisionalAssetId(displayName);
    if (seenAssetIds.has(providerAssetId)) {
      throw malformedCsv("La exportación CSV contiene unidades duplicadas.");
    }
    seenAssetIds.add(providerAssetId);

    const recordedAtCell = cell(row, recordedAtIndex);
    const positionCell = cell(row, positionIndex);
    const hasRecordedAt = !isMissingCell(recordedAtCell);
    const hasPosition = !isMissingCell(positionCell);
    if (hasPosition && !hasRecordedAt) {
      throw malformedCsv("Una unidad con posición no incluye hora de última conexión.");
    }

    const coordinates = hasPosition ? parseCoordinates(positionCell) : null;
    return {
      providerAssetId,
      displayName,
      connectionStatus: cell(row, statusIndex).trim(),
      recordedAt: hasRecordedAt
        ? parseGoldcarPortalTimestamp(recordedAtCell, options.timeZoneOffset)
        : null,
      receivedAt,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    };
  });
}

export function parseGoldcarPortalTimestamp(value: string, timeZoneOffset: string): string {
  const timestampMatch = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/u.exec(value.trim());
  const offsetMatch = /^([+-])(\d{2}):(\d{2})$/u.exec(timeZoneOffset);
  if (!timestampMatch || !offsetMatch) {
    throw malformedCsv("La hora de Goldcar o su zona horaria no tienen el formato esperado.");
  }

  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = timestampMatch;
  const [, offsetSign, offsetHourText, offsetMinuteText] = offsetMatch;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText);
  const offsetMinute = Number(offsetMinuteText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    throw malformedCsv("La hora de Goldcar contiene valores fuera de rango.");
  }

  const signedOffsetMinutes = (offsetSign === "+" ? 1 : -1) * (offsetHour * 60 + offsetMinute);
  const utcTimestamp =
    Date.UTC(year, month - 1, day, hour, minute, second) - signedOffsetMinutes * 60_000;
  return new Date(utcTimestamp).toISOString();
}

function parseReceivedAt(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw malformedCsv("La recepción de la exportación Goldcar no tiene una hora válida.");
  }
  return new Date(timestamp).toISOString();
}

function detectDelimiter(csv: string): "," | ";" {
  const headerLine = csv.replace(/^\uFEFF/u, "").split(/\r?\n/u, 1)[0] ?? "";
  const commas = [...headerLine].filter((character) => character === ",").length;
  const semicolons = [...headerLine].filter((character) => character === ";").length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvRows(csv: string, delimiter: "," | ";"): string[][] {
  const input = csv.replace(/^\uFEFF/u, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === "") {
      quoted = true;
    } else if (
      character === delimiter &&
      !(delimiter === ";" && /&(?:#[0-9]+|[a-z]+)$/iu.test(field))
    ) {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw malformedCsv("La exportación CSV contiene una comilla sin cierre.");
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(value: string): string {
  return decodeKnownHtmlEntities(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, "");
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

function requireHeader(headers: readonly string[], expected: string): number {
  const index = headers.indexOf(expected);
  if (index === -1) {
    throw malformedCsv(`La exportación CSV no contiene la columna ${expected}.`);
  }
  return index;
}

function cell(row: readonly string[], index: number): string {
  return row[index] ?? "";
}

function requiredCell(row: readonly string[], index: number, label: string): string {
  const value = cell(row, index).trim();
  if (value === "") throw malformedCsv(`Una fila de Goldcar no contiene ${label}.`);
  return value;
}

function isMissingCell(value: string): boolean {
  return value.trim() === "" || value.trim() === "-" || value.trim() === "—";
}

function createProvisionalAssetId(displayName: string): string {
  const normalized = displayName.trim().toUpperCase().replace(/\s+/gu, " ");
  return `portal-name:${encodeURIComponent(normalized)}`;
}

function parseCoordinates(value: string): { latitude: number; longitude: number } {
  const normalized = decodeKnownHtmlEntities(value).replace(/%2c/giu, ",");
  const coordinatePair =
    /(?:^|[?&\s"'=(])(?:q|query|ll|latlng|position)?\s*=?\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;/]\s*(-?\d{1,3}(?:\.\d+)?)(?=$|[&#\s"')<])/giu;
  const labeledCoordinatePair =
    /(?:lat|latitude|latitud)\s*[:=]\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;/]\s*(?:lng|lon|longitude|longitud)\s*[:=]\s*(-?\d{1,3}(?:\.\d+)?)/giu;
  const candidates = [
    ...normalized.matchAll(coordinatePair),
    ...normalized.matchAll(labeledCoordinatePair),
  ]
    .map((match) => ({ latitude: Number(match[1]), longitude: Number(match[2]) }))
    .filter(
      ({ latitude, longitude }) =>
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180,
    );
  const signedNumbers = [...normalized.matchAll(/[+-]\d{1,3}(?:\.\d+)?/gu)].map((match) =>
    Number(match[0]),
  );
  if (
    candidates.length === 0 &&
    signedNumbers.length === 2 &&
    signedNumbers[0]! >= -90 &&
    signedNumbers[0]! <= 90 &&
    signedNumbers[1]! >= -180 &&
    signedNumbers[1]! <= 180
  ) {
    candidates.push({ latitude: signedNumbers[0]!, longitude: signedNumbers[1]! });
  }
  const uniqueCandidates = candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (other) => other.latitude === candidate.latitude && other.longitude === candidate.longitude,
      ) === index,
  );
  if (uniqueCandidates.length !== 1) {
    throw malformedCsv(
      `La posición de Goldcar no tiene una coordenada geográfica inequívoca (${describeCoordinateShape(normalized)}).`,
    );
  }
  return uniqueCandidates[0]!;
}

function describeCoordinateShape(value: string): string {
  const decimalNumbers = value.match(/\d+\.\d+/gu)?.length ?? 0;
  const signedDecimalNumbers = value.match(/[+-]\d+\.\d+/gu)?.length ?? 0;
  return [
    `html=${/<[^>]+>/u.test(value)}`,
    `url=${/https?:\/\//iu.test(value)}`,
    `comma=${value.includes(",")}`,
    `semicolon=${value.includes(";")}`,
    `pipe=${value.includes("|")}`,
    `plus=${value.includes("+")}`,
    `parentheses=${/[()]/u.test(value)}`,
    `decimalNumbers=${decimalNumbers}`,
    `signedDecimalNumbers=${signedDecimalNumbers}`,
  ].join(",");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new GpsProviderError("CONFIGURATION", `${label} debe ser un entero positivo.`);
  }
}

function malformedCsv(message: string): GpsProviderError {
  return new GpsProviderError("MALFORMED_RESPONSE", message);
}
