export const OCR_BENCHMARK_SCHEMA_VERSION = 1 as const;

export type BenchmarkDatasetClassification = "SYNTHETIC_ONLY" | "CONTROLLED_REAL";
export type BenchmarkCaseSource = "SYNTHETIC" | "REAL_AUTHORIZED";
export type BenchmarkImageVariant = "ORIGINAL" | "CORRECTED" | "NOT_APPLICABLE";
export type BenchmarkRunOutcome = "SUCCEEDED" | "FAILED";

export interface BenchmarkDataset {
  readonly id: string;
  readonly classification: BenchmarkDatasetClassification;
  readonly containsRealDocuments: boolean;
}

export interface BenchmarkNormalizationProfile {
  readonly id: string;
  readonly version: string;
}

export interface BenchmarkInputAsset {
  readonly localReference: string;
  readonly sha256: string;
}

export interface BenchmarkExecutionEnvironment {
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly hardwareId: string;
}

export interface BenchmarkFieldDefinition {
  readonly id: string;
  readonly label: string;
}

export interface BenchmarkGroundTruthValue {
  readonly raw: string;
  readonly normalized: string;
}

export interface BenchmarkFixtureCase {
  readonly id: string;
  readonly comparisonGroupId: string;
  readonly imageVariant: BenchmarkImageVariant;
  readonly source: BenchmarkCaseSource;
  readonly input: BenchmarkInputAsset | null;
  readonly conditions: readonly string[];
  readonly groundTruth: Readonly<Record<string, BenchmarkGroundTruthValue>>;
}

export interface OcrBenchmarkFixtureManifest {
  readonly schemaVersion: typeof OCR_BENCHMARK_SCHEMA_VERSION;
  readonly dataset: BenchmarkDataset;
  readonly normalizationProfile: BenchmarkNormalizationProfile;
  readonly fields: readonly BenchmarkFieldDefinition[];
  readonly cases: readonly BenchmarkFixtureCase[];
}

export interface BenchmarkCandidate {
  readonly id: string;
  readonly engine: string;
  readonly engineVersion: string;
  readonly normalizationProfile: BenchmarkNormalizationProfile;
  readonly executionEnvironment: BenchmarkExecutionEnvironment;
}

export interface BenchmarkCandidateFieldOutput {
  readonly raw: string;
  readonly normalized: string;
  readonly confidence?: number;
}

export interface BenchmarkCandidateRun {
  readonly caseId: string;
  readonly outcome: BenchmarkRunOutcome;
  readonly durationMs: number;
  readonly failureCode?: string;
  readonly fields: Readonly<Record<string, BenchmarkCandidateFieldOutput>>;
}

export interface OcrBenchmarkCandidateResultSet {
  readonly schemaVersion: typeof OCR_BENCHMARK_SCHEMA_VERSION;
  readonly candidate: BenchmarkCandidate;
  readonly runs: readonly BenchmarkCandidateRun[];
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const identifierPattern = /^[A-Za-z][A-Za-z0-9._-]{2,127}$/u;
const failureCodePattern = /^[A-Z][A-Z0-9_]{2,63}$/u;
const sha256Pattern = /^[a-fA-F0-9]{64}$/u;

function asRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} debe ser un objeto.`);
  }
  return value as UnknownRecord;
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} debe ser una lista.`);
  return value;
}

function asNonBlankString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} debe ser texto no vacío.`);
  }
  return value;
}

function asIdentifier(value: unknown, label: string): string {
  const identifier = asNonBlankString(value, label);
  if (!identifierPattern.test(identifier))
    throw new Error(`${label} no tiene un identificador permitido.`);
  return identifier;
}

function asVersionTag(value: unknown, label: string): string {
  const version = asNonBlankString(value, label);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(version)) {
    throw new Error(`${label} no tiene una versión permitida.`);
  }
  return version;
}

function asLocalReference(value: unknown, label: string): string {
  const localReference = asNonBlankString(value, label);
  if (
    localReference.startsWith("/") ||
    localReference.includes("\\") ||
    localReference.split("/").some((segment) => segment === ".." || segment.length === 0)
  ) {
    throw new Error(`${label} no es una referencia local opaca permitida.`);
  }
  return localReference;
}

function asSha256(value: unknown, label: string): string {
  const hash = asNonBlankString(value, label);
  if (!sha256Pattern.test(hash)) throw new Error(`${label} no es una huella SHA-256 permitida.`);
  return hash.toLowerCase();
}

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} debe ser booleano.`);
  return value;
}

function asFiniteNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} debe ser un número finito no negativo.`);
  }
  return value;
}

function asUnitConfidence(value: unknown, label: string): number {
  const confidence = asFiniteNonNegativeNumber(value, label);
  if (confidence > 1) throw new Error(`${label} debe estar entre 0 y 1.`);
  return confidence;
}

function asSchemaVersion(value: unknown, label: string): typeof OCR_BENCHMARK_SCHEMA_VERSION {
  if (value !== OCR_BENCHMARK_SCHEMA_VERSION) {
    throw new Error(`${label} no es compatible con el esquema de benchmark.`);
  }
  return OCR_BENCHMARK_SCHEMA_VERSION;
}

function asUniqueIdentifiers(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length)
    throw new Error(`${label} contiene identificadores duplicados.`);
}

function parseDataset(value: unknown): BenchmarkDataset {
  const record = asRecord(value, "dataset");
  const classification = asNonBlankString(record.classification, "dataset.classification");
  if (classification !== "SYNTHETIC_ONLY" && classification !== "CONTROLLED_REAL") {
    throw new Error("dataset.classification no es reconocida.");
  }
  const containsRealDocuments = asBoolean(
    record.containsRealDocuments,
    "dataset.containsRealDocuments",
  );
  if (classification === "SYNTHETIC_ONLY" && containsRealDocuments) {
    throw new Error("Un dataset sintético no puede declarar documentos reales.");
  }
  if (classification === "CONTROLLED_REAL" && !containsRealDocuments) {
    throw new Error("Un dataset real controlado debe declarar documentos reales.");
  }
  return {
    id: asIdentifier(record.id, "dataset.id"),
    classification,
    containsRealDocuments,
  };
}

function parseNormalizationProfile(value: unknown, label: string): BenchmarkNormalizationProfile {
  const record = asRecord(value, label);
  return {
    id: asIdentifier(record.id, `${label}.id`),
    version: asVersionTag(record.version, `${label}.version`),
  };
}

function parseExecutionEnvironment(value: unknown): BenchmarkExecutionEnvironment {
  const record = asRecord(value, "candidate.executionEnvironment");
  return {
    runtimeId: asIdentifier(record.runtimeId, "candidate.executionEnvironment.runtimeId"),
    runtimeVersion: asVersionTag(
      record.runtimeVersion,
      "candidate.executionEnvironment.runtimeVersion",
    ),
    hardwareId: asIdentifier(record.hardwareId, "candidate.executionEnvironment.hardwareId"),
  };
}

function parseInputAsset(value: unknown): BenchmarkInputAsset | null {
  if (value === undefined || value === null) return null;
  const record = asRecord(value, "cases[].input");
  return {
    localReference: asLocalReference(record.localReference, "cases[].input.localReference"),
    sha256: asSha256(record.sha256, "cases[].input.sha256"),
  };
}

function parseFields(value: unknown): readonly BenchmarkFieldDefinition[] {
  const fields = asArray(value, "fields").map((item) => {
    const record = asRecord(item, "fields[]");
    return {
      id: asIdentifier(record.id, "fields[].id"),
      label: asNonBlankString(record.label, "fields[].label"),
    };
  });
  if (fields.length === 0) throw new Error("fields debe contener al menos un campo.");
  asUniqueIdentifiers(
    fields.map((field) => field.id),
    "fields",
  );
  return fields;
}

function parseGroundTruth(
  value: unknown,
  knownFieldIds: ReadonlySet<string>,
): Readonly<Record<string, BenchmarkGroundTruthValue>> {
  const record = asRecord(value, "groundTruth");
  const entries = Object.entries(record);
  if (entries.length === 0)
    throw new Error("groundTruth debe contener al menos un campo esperado.");
  const groundTruth: Record<string, BenchmarkGroundTruthValue> = {};
  for (const [fieldId, fieldValue] of entries) {
    if (!knownFieldIds.has(fieldId)) throw new Error("groundTruth contiene un campo no declarado.");
    const fieldRecord = asRecord(fieldValue, "groundTruth[field]");
    groundTruth[fieldId] = {
      raw: asNonBlankString(fieldRecord.raw, "groundTruth[field].raw"),
      normalized: asNonBlankString(fieldRecord.normalized, "groundTruth[field].normalized"),
    };
  }
  return groundTruth;
}

function parseCase(value: unknown, knownFieldIds: ReadonlySet<string>): BenchmarkFixtureCase {
  const record = asRecord(value, "cases[]");
  const source = asNonBlankString(record.source, "cases[].source");
  if (source !== "SYNTHETIC" && source !== "REAL_AUTHORIZED") {
    throw new Error("cases[].source no es reconocido.");
  }
  const imageVariant = asNonBlankString(record.imageVariant, "cases[].imageVariant");
  if (
    imageVariant !== "ORIGINAL" &&
    imageVariant !== "CORRECTED" &&
    imageVariant !== "NOT_APPLICABLE"
  ) {
    throw new Error("cases[].imageVariant no es reconocido.");
  }
  const conditions = asArray(record.conditions, "cases[].conditions").map((condition) =>
    asIdentifier(condition, "cases[].conditions[]"),
  );
  if (conditions.length === 0)
    throw new Error("cases[].conditions debe contener al menos una condición.");
  asUniqueIdentifiers(conditions, "cases[].conditions");
  const input = parseInputAsset(record.input);
  if (source === "REAL_AUTHORIZED" && input === null) {
    throw new Error("Un caso real autorizado debe identificar su activo local y huella.");
  }
  return {
    id: asIdentifier(record.id, "cases[].id"),
    comparisonGroupId: asIdentifier(record.comparisonGroupId, "cases[].comparisonGroupId"),
    imageVariant,
    source,
    input,
    conditions,
    groundTruth: parseGroundTruth(record.groundTruth, knownFieldIds),
  };
}

function hasSameGroundTruth(left: BenchmarkFixtureCase, right: BenchmarkFixtureCase): boolean {
  const leftEntries = Object.entries(left.groundTruth).sort(([leftId], [rightId]) =>
    leftId.localeCompare(rightId),
  );
  const rightEntries = Object.entries(right.groundTruth).sort(([leftId], [rightId]) =>
    leftId.localeCompare(rightId),
  );
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([fieldId, value], index) => {
      const rightEntry = rightEntries[index];
      return (
        rightEntry !== undefined &&
        fieldId === rightEntry[0] &&
        value.raw === rightEntry[1].raw &&
        value.normalized === rightEntry[1].normalized
      );
    })
  );
}

function validateComparisonGroups(cases: readonly BenchmarkFixtureCase[]): void {
  const casesByGroup = new Map<string, BenchmarkFixtureCase[]>();
  for (const fixture of cases) {
    const group = casesByGroup.get(fixture.comparisonGroupId) ?? [];
    group.push(fixture);
    casesByGroup.set(fixture.comparisonGroupId, group);
  }
  for (const group of casesByGroup.values()) {
    if (new Set(group.map((fixture) => fixture.source)).size > 1) {
      throw new Error("Un grupo de comparación no puede mezclar fuentes de documento.");
    }
    const originals = group.filter((fixture) => fixture.imageVariant === "ORIGINAL");
    const corrected = group.filter((fixture) => fixture.imageVariant === "CORRECTED");
    const notApplicable = group.filter((fixture) => fixture.imageVariant === "NOT_APPLICABLE");
    if (originals.length > 1 || corrected.length > 1 || notApplicable.length > 1) {
      throw new Error("Un grupo de comparación no puede repetir una variante de imagen.");
    }
    if (corrected.length === 1 && originals.length !== 1) {
      throw new Error("Una imagen corregida requiere exactamente un original en su grupo.");
    }
    if (notApplicable.length === 1 && group.length > 1) {
      throw new Error("La variante NOT_APPLICABLE no puede mezclarse con otras variantes.");
    }
    const original = originals[0];
    const correctedVariant = corrected[0];
    if (
      original !== undefined &&
      correctedVariant !== undefined &&
      !hasSameGroundTruth(original, correctedVariant)
    ) {
      throw new Error("Original y corregido deben compartir la misma verdad de campo.");
    }
  }
}

export function parseOcrBenchmarkFixtureManifest(input: unknown): OcrBenchmarkFixtureManifest {
  const record = asRecord(input, "manifest");
  const fields = parseFields(record.fields);
  const knownFieldIds = new Set(fields.map((field) => field.id));
  const dataset = parseDataset(record.dataset);
  const normalizationProfile = parseNormalizationProfile(
    record.normalizationProfile,
    "manifest.normalizationProfile",
  );
  const cases = asArray(record.cases, "cases").map((item) => parseCase(item, knownFieldIds));
  if (cases.length === 0) throw new Error("cases debe contener al menos un caso.");
  asUniqueIdentifiers(
    cases.map((fixture) => fixture.id),
    "cases",
  );
  if (
    dataset.classification === "SYNTHETIC_ONLY" &&
    cases.some((fixture) => fixture.source !== "SYNTHETIC")
  ) {
    throw new Error("Un dataset sintético no puede contener fuentes reales.");
  }
  if (
    dataset.classification === "CONTROLLED_REAL" &&
    cases.some((fixture) => fixture.source !== "REAL_AUTHORIZED")
  ) {
    throw new Error("Un dataset real controlado no puede contener fixtures sintéticos.");
  }
  validateComparisonGroups(cases);
  return {
    schemaVersion: asSchemaVersion(record.schemaVersion, "manifest.schemaVersion"),
    dataset,
    normalizationProfile,
    fields,
    cases,
  };
}

function parseCandidate(
  value: unknown,
  expectedNormalizationProfile: BenchmarkNormalizationProfile,
): BenchmarkCandidate {
  const record = asRecord(value, "candidate");
  const normalizationProfile = parseNormalizationProfile(
    record.normalizationProfile,
    "candidate.normalizationProfile",
  );
  if (
    normalizationProfile.id !== expectedNormalizationProfile.id ||
    normalizationProfile.version !== expectedNormalizationProfile.version
  ) {
    throw new Error("candidate.normalizationProfile no coincide con el perfil del manifest.");
  }
  return {
    id: asIdentifier(record.id, "candidate.id"),
    engine: asIdentifier(record.engine, "candidate.engine"),
    engineVersion: asVersionTag(record.engineVersion, "candidate.engineVersion"),
    normalizationProfile,
    executionEnvironment: parseExecutionEnvironment(record.executionEnvironment),
  };
}

function parseCandidateFields(
  value: unknown,
  knownFieldIds: ReadonlySet<string>,
): Readonly<Record<string, BenchmarkCandidateFieldOutput>> {
  const record = asRecord(value, "runs[].fields");
  const fields: Record<string, BenchmarkCandidateFieldOutput> = {};
  for (const [fieldId, fieldValue] of Object.entries(record)) {
    if (!knownFieldIds.has(fieldId))
      throw new Error("runs[].fields contiene un campo no declarado.");
    const fieldRecord = asRecord(fieldValue, "runs[].fields[field]");
    const confidence =
      fieldRecord.confidence === undefined
        ? undefined
        : asUnitConfidence(fieldRecord.confidence, "runs[].fields[field].confidence");
    const parsedField = {
      raw: asNonBlankString(fieldRecord.raw, "runs[].fields[field].raw"),
      normalized: asNonBlankString(fieldRecord.normalized, "runs[].fields[field].normalized"),
    };
    fields[fieldId] = confidence === undefined ? parsedField : { ...parsedField, confidence };
  }
  return fields;
}

function parseRun(value: unknown, knownFieldIds: ReadonlySet<string>): BenchmarkCandidateRun {
  const record = asRecord(value, "runs[]");
  const outcome = asNonBlankString(record.outcome, "runs[].outcome");
  if (outcome !== "SUCCEEDED" && outcome !== "FAILED")
    throw new Error("runs[].outcome no es reconocido.");
  const fields = parseCandidateFields(record.fields, knownFieldIds);
  const failureCode = record.failureCode;
  if (outcome === "FAILED") {
    if (Object.keys(fields).length > 0)
      throw new Error("Una ejecución fallida no puede declarar campos.");
    const code = asNonBlankString(failureCode, "runs[].failureCode");
    if (!failureCodePattern.test(code))
      throw new Error("runs[].failureCode no es un código permitido.");
    return {
      caseId: asIdentifier(record.caseId, "runs[].caseId"),
      outcome,
      durationMs: asFiniteNonNegativeNumber(record.durationMs, "runs[].durationMs"),
      failureCode: code,
      fields,
    };
  }
  if (failureCode !== undefined)
    throw new Error("Una ejecución exitosa no puede declarar failureCode.");
  return {
    caseId: asIdentifier(record.caseId, "runs[].caseId"),
    outcome,
    durationMs: asFiniteNonNegativeNumber(record.durationMs, "runs[].durationMs"),
    fields,
  };
}

export function parseOcrBenchmarkCandidateResultSet(
  input: unknown,
  manifest: OcrBenchmarkFixtureManifest,
): OcrBenchmarkCandidateResultSet {
  const record = asRecord(input, "results");
  const knownFieldIds = new Set(manifest.fields.map((field) => field.id));
  const runs = asArray(record.runs, "runs").map((item) => parseRun(item, knownFieldIds));
  if (runs.length !== manifest.cases.length)
    throw new Error("runs debe contener exactamente una ejecución por caso.");
  asUniqueIdentifiers(
    runs.map((run) => run.caseId),
    "runs",
  );
  const knownCaseIds = new Set(manifest.cases.map((fixture) => fixture.id));
  if (runs.some((run) => !knownCaseIds.has(run.caseId))) {
    throw new Error("runs contiene un caso no declarado.");
  }
  if (manifest.cases.some((fixture) => !runs.some((run) => run.caseId === fixture.id))) {
    throw new Error("runs no cubre todos los casos del manifest.");
  }
  return {
    schemaVersion: asSchemaVersion(record.schemaVersion, "results.schemaVersion"),
    candidate: parseCandidate(record.candidate, manifest.normalizationProfile),
    runs,
  };
}
