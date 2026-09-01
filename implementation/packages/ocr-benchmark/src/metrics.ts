import type {
  BenchmarkCandidate,
  BenchmarkCandidateFieldOutput,
  BenchmarkFixtureCase,
  BenchmarkImageVariant,
  OcrBenchmarkCandidateResultSet,
  OcrBenchmarkFixtureManifest,
} from "./schema";

export interface BenchmarkConfidenceMetrics {
  readonly sampleCount: number;
  readonly average: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export interface BenchmarkConfidenceBandMetrics {
  readonly lowerInclusive: number;
  readonly upperExclusive: number | null;
  readonly extractedCount: number;
  readonly normalizedMatchCount: number;
  readonly normalizedMismatchCount: number;
  readonly falsePositiveCount: number;
  readonly normalizedMatchRate: number | null;
}

export interface BenchmarkLatencyMetrics {
  readonly sampleCount: number;
  readonly averageMs: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
}

export interface BenchmarkLatencyBreakdown {
  readonly all: BenchmarkLatencyMetrics;
  readonly succeeded: BenchmarkLatencyMetrics;
  readonly failed: BenchmarkLatencyMetrics;
}

export interface BenchmarkFieldMetrics {
  readonly fieldId: string;
  readonly expectedCount: number;
  readonly extractedCount: number;
  readonly rawExactMatchCount: number;
  readonly normalizedMatchCount: number;
  readonly missingExpectedCount: number;
  readonly normalizedMismatchCount: number;
  readonly falsePositiveCount: number;
  readonly confidence: BenchmarkConfidenceMetrics;
  readonly confidenceBands: readonly BenchmarkConfidenceBandMetrics[];
}

export interface BenchmarkMetrics {
  readonly caseCount: number;
  readonly succeededCaseCount: number;
  readonly failedCaseCount: number;
  readonly allExpectedFieldsNormalizedMatchCount: number;
  readonly completeAndCleanNormalizedMatchCount: number;
  readonly expectedFieldCount: number;
  readonly extractedFieldCount: number;
  readonly rawExactMatchCount: number;
  readonly normalizedMatchCount: number;
  readonly missingExpectedCount: number;
  readonly normalizedMismatchCount: number;
  readonly falsePositiveCount: number;
  readonly latency: BenchmarkLatencyBreakdown;
  readonly confidence: BenchmarkConfidenceMetrics;
  readonly confidenceBands: readonly BenchmarkConfidenceBandMetrics[];
  readonly byField: readonly BenchmarkFieldMetrics[];
}

export interface BenchmarkConditionMetrics {
  readonly condition: string;
  readonly metrics: BenchmarkMetrics;
}

export interface BenchmarkImageVariantMetrics {
  readonly imageVariant: BenchmarkImageVariant;
  readonly metrics: BenchmarkMetrics;
}

export interface BenchmarkPairedOriginalCorrectedMetrics {
  readonly groupCount: number;
  readonly original: BenchmarkMetrics;
  readonly corrected: BenchmarkMetrics;
  readonly normalizedMatchDelta: number;
  readonly completeAndCleanNormalizedMatchDelta: number;
}

export interface OcrBenchmarkReport {
  readonly schemaVersion: 1;
  readonly dataset: {
    readonly id: string;
    readonly classification: string;
    readonly containsRealDocuments: boolean;
  };
  readonly candidate: BenchmarkCandidate;
  readonly pairedOriginalCorrectedGroupCount: number;
  readonly pairedOriginalCorrected: BenchmarkPairedOriginalCorrectedMetrics | null;
  readonly metrics: BenchmarkMetrics;
  readonly byCondition: readonly BenchmarkConditionMetrics[];
  readonly byImageVariant: readonly BenchmarkImageVariantMetrics[];
}

interface MutableConfidenceMetrics {
  sampleCount: number;
  sum: number;
  minimum: number | null;
  maximum: number | null;
}

interface MutableConfidenceBandMetrics {
  extractedCount: number;
  normalizedMatchCount: number;
  normalizedMismatchCount: number;
  falsePositiveCount: number;
}

interface MutableFieldMetrics {
  expectedCount: number;
  extractedCount: number;
  rawExactMatchCount: number;
  normalizedMatchCount: number;
  missingExpectedCount: number;
  normalizedMismatchCount: number;
  falsePositiveCount: number;
  confidence: MutableConfidenceMetrics;
  confidenceBands: Map<number, MutableConfidenceBandMetrics>;
}

interface MutableBenchmarkMetrics {
  caseCount: number;
  succeededCaseCount: number;
  failedCaseCount: number;
  allExpectedFieldsNormalizedMatchCount: number;
  completeAndCleanNormalizedMatchCount: number;
  expectedFieldCount: number;
  extractedFieldCount: number;
  rawExactMatchCount: number;
  normalizedMatchCount: number;
  missingExpectedCount: number;
  normalizedMismatchCount: number;
  falsePositiveCount: number;
  latencySamples: number[];
  succeededLatencySamples: number[];
  failedLatencySamples: number[];
  confidence: MutableConfidenceMetrics;
  confidenceBands: Map<number, MutableConfidenceBandMetrics>;
  byField: Map<string, MutableFieldMetrics>;
}

function createMutableConfidenceMetrics(): MutableConfidenceMetrics {
  return { sampleCount: 0, sum: 0, minimum: null, maximum: null };
}

const confidenceBandDefinitions = [
  { lowerInclusive: 0, upperExclusive: 0.2 },
  { lowerInclusive: 0.2, upperExclusive: 0.4 },
  { lowerInclusive: 0.4, upperExclusive: 0.6 },
  { lowerInclusive: 0.6, upperExclusive: 0.8 },
  { lowerInclusive: 0.8, upperExclusive: null },
] as const;

type ConfidenceObservationOutcome = "MATCH" | "MISMATCH" | "FALSE_POSITIVE";

function createMutableConfidenceBands(): Map<number, MutableConfidenceBandMetrics> {
  return new Map(
    confidenceBandDefinitions.map((_, index) => [
      index,
      {
        extractedCount: 0,
        normalizedMatchCount: 0,
        normalizedMismatchCount: 0,
        falsePositiveCount: 0,
      },
    ]),
  );
}

function confidenceBandIndex(confidence: number): number {
  return Math.min(
    Math.floor(confidence * confidenceBandDefinitions.length),
    confidenceBandDefinitions.length - 1,
  );
}

function addConfidence(
  target: MutableConfidenceMetrics,
  output: BenchmarkCandidateFieldOutput,
): void {
  if (output.confidence === undefined) return;
  target.sampleCount += 1;
  target.sum += output.confidence;
  target.minimum =
    target.minimum === null ? output.confidence : Math.min(target.minimum, output.confidence);
  target.maximum =
    target.maximum === null ? output.confidence : Math.max(target.maximum, output.confidence);
}

function addConfidenceBand(
  target: Map<number, MutableConfidenceBandMetrics>,
  output: BenchmarkCandidateFieldOutput,
  outcome: ConfidenceObservationOutcome,
): void {
  if (output.confidence === undefined) return;
  const band = target.get(confidenceBandIndex(output.confidence));
  if (band === undefined) throw new Error("La confianza validada no tiene una banda de benchmark.");
  band.extractedCount += 1;
  if (outcome === "MATCH") band.normalizedMatchCount += 1;
  if (outcome === "MISMATCH") band.normalizedMismatchCount += 1;
  if (outcome === "FALSE_POSITIVE") band.falsePositiveCount += 1;
}

function completeConfidenceMetrics(metrics: MutableConfidenceMetrics): BenchmarkConfidenceMetrics {
  return {
    sampleCount: metrics.sampleCount,
    average: metrics.sampleCount === 0 ? null : metrics.sum / metrics.sampleCount,
    minimum: metrics.minimum,
    maximum: metrics.maximum,
  };
}

function completeConfidenceBands(
  bands: ReadonlyMap<number, MutableConfidenceBandMetrics>,
): readonly BenchmarkConfidenceBandMetrics[] {
  return confidenceBandDefinitions.map((definition, index) => {
    const metrics = bands.get(index);
    if (metrics === undefined) throw new Error("La banda de confianza validada no tiene métricas.");
    return {
      ...definition,
      extractedCount: metrics.extractedCount,
      normalizedMatchCount: metrics.normalizedMatchCount,
      normalizedMismatchCount: metrics.normalizedMismatchCount,
      falsePositiveCount: metrics.falsePositiveCount,
      normalizedMatchRate:
        metrics.extractedCount === 0 ? null : metrics.normalizedMatchCount / metrics.extractedCount,
    };
  });
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * ordered.length) - 1;
  return ordered[index] ?? null;
}

function completeLatencyMetrics(values: readonly number[]): BenchmarkLatencyMetrics {
  if (values.length === 0) {
    return { sampleCount: 0, averageMs: null, p50Ms: null, p95Ms: null };
  }
  return {
    sampleCount: values.length,
    averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
  };
}

function createMutableBenchmarkMetrics(
  manifest: OcrBenchmarkFixtureManifest,
): MutableBenchmarkMetrics {
  return {
    caseCount: 0,
    succeededCaseCount: 0,
    failedCaseCount: 0,
    allExpectedFieldsNormalizedMatchCount: 0,
    completeAndCleanNormalizedMatchCount: 0,
    expectedFieldCount: 0,
    extractedFieldCount: 0,
    rawExactMatchCount: 0,
    normalizedMatchCount: 0,
    missingExpectedCount: 0,
    normalizedMismatchCount: 0,
    falsePositiveCount: 0,
    latencySamples: [],
    succeededLatencySamples: [],
    failedLatencySamples: [],
    confidence: createMutableConfidenceMetrics(),
    confidenceBands: createMutableConfidenceBands(),
    byField: new Map(
      manifest.fields.map((field) => [
        field.id,
        {
          expectedCount: 0,
          extractedCount: 0,
          rawExactMatchCount: 0,
          normalizedMatchCount: 0,
          missingExpectedCount: 0,
          normalizedMismatchCount: 0,
          falsePositiveCount: 0,
          confidence: createMutableConfidenceMetrics(),
          confidenceBands: createMutableConfidenceBands(),
        },
      ]),
    ),
  };
}

function accumulateFixtureCase(
  metrics: MutableBenchmarkMetrics,
  manifest: OcrBenchmarkFixtureManifest,
  fixture: BenchmarkFixtureCase,
  results: OcrBenchmarkCandidateResultSet,
): void {
  const run = results.runs.find((candidateRun) => candidateRun.caseId === fixture.id);
  if (run === undefined) throw new Error("El resultado no cubre un caso validado.");

  metrics.caseCount += 1;
  metrics.latencySamples.push(run.durationMs);
  if (run.outcome === "SUCCEEDED") {
    metrics.succeededCaseCount += 1;
    metrics.succeededLatencySamples.push(run.durationMs);
  } else {
    metrics.failedCaseCount += 1;
    metrics.failedLatencySamples.push(run.durationMs);
  }

  let allExpectedFieldsNormalizedMatch = run.outcome === "SUCCEEDED";
  let hasFalsePositive = false;

  for (const field of manifest.fields) {
    const fieldMetrics = metrics.byField.get(field.id);
    if (fieldMetrics === undefined) throw new Error("El campo validado no tiene acumulador.");
    const expected = fixture.groundTruth[field.id];
    const extracted = run.fields[field.id];

    if (expected === undefined) {
      if (extracted !== undefined) {
        fieldMetrics.extractedCount += 1;
        fieldMetrics.falsePositiveCount += 1;
        metrics.extractedFieldCount += 1;
        metrics.falsePositiveCount += 1;
        hasFalsePositive = true;
        addConfidence(fieldMetrics.confidence, extracted);
        addConfidence(metrics.confidence, extracted);
        addConfidenceBand(fieldMetrics.confidenceBands, extracted, "FALSE_POSITIVE");
        addConfidenceBand(metrics.confidenceBands, extracted, "FALSE_POSITIVE");
      }
      continue;
    }

    fieldMetrics.expectedCount += 1;
    metrics.expectedFieldCount += 1;
    if (extracted === undefined) {
      fieldMetrics.missingExpectedCount += 1;
      metrics.missingExpectedCount += 1;
      allExpectedFieldsNormalizedMatch = false;
      continue;
    }

    fieldMetrics.extractedCount += 1;
    metrics.extractedFieldCount += 1;
    addConfidence(fieldMetrics.confidence, extracted);
    addConfidence(metrics.confidence, extracted);
    const normalizedMatches = extracted.normalized === expected.normalized;
    addConfidenceBand(
      fieldMetrics.confidenceBands,
      extracted,
      normalizedMatches ? "MATCH" : "MISMATCH",
    );
    addConfidenceBand(metrics.confidenceBands, extracted, normalizedMatches ? "MATCH" : "MISMATCH");

    if (extracted.raw === expected.raw) {
      fieldMetrics.rawExactMatchCount += 1;
      metrics.rawExactMatchCount += 1;
    }
    if (normalizedMatches) {
      fieldMetrics.normalizedMatchCount += 1;
      metrics.normalizedMatchCount += 1;
    } else {
      fieldMetrics.normalizedMismatchCount += 1;
      metrics.normalizedMismatchCount += 1;
      allExpectedFieldsNormalizedMatch = false;
    }
  }

  if (allExpectedFieldsNormalizedMatch) {
    metrics.allExpectedFieldsNormalizedMatchCount += 1;
    if (!hasFalsePositive) metrics.completeAndCleanNormalizedMatchCount += 1;
  }
}

function completeMetrics(
  metrics: MutableBenchmarkMetrics,
  manifest: OcrBenchmarkFixtureManifest,
): BenchmarkMetrics {
  return {
    caseCount: metrics.caseCount,
    succeededCaseCount: metrics.succeededCaseCount,
    failedCaseCount: metrics.failedCaseCount,
    allExpectedFieldsNormalizedMatchCount: metrics.allExpectedFieldsNormalizedMatchCount,
    completeAndCleanNormalizedMatchCount: metrics.completeAndCleanNormalizedMatchCount,
    expectedFieldCount: metrics.expectedFieldCount,
    extractedFieldCount: metrics.extractedFieldCount,
    rawExactMatchCount: metrics.rawExactMatchCount,
    normalizedMatchCount: metrics.normalizedMatchCount,
    missingExpectedCount: metrics.missingExpectedCount,
    normalizedMismatchCount: metrics.normalizedMismatchCount,
    falsePositiveCount: metrics.falsePositiveCount,
    latency: {
      all: completeLatencyMetrics(metrics.latencySamples),
      succeeded: completeLatencyMetrics(metrics.succeededLatencySamples),
      failed: completeLatencyMetrics(metrics.failedLatencySamples),
    },
    confidence: completeConfidenceMetrics(metrics.confidence),
    confidenceBands: completeConfidenceBands(metrics.confidenceBands),
    byField: manifest.fields.map((field) => {
      const fieldMetrics = metrics.byField.get(field.id);
      if (fieldMetrics === undefined) throw new Error("El campo validado no tiene métricas.");
      return {
        fieldId: field.id,
        expectedCount: fieldMetrics.expectedCount,
        extractedCount: fieldMetrics.extractedCount,
        rawExactMatchCount: fieldMetrics.rawExactMatchCount,
        normalizedMatchCount: fieldMetrics.normalizedMatchCount,
        missingExpectedCount: fieldMetrics.missingExpectedCount,
        normalizedMismatchCount: fieldMetrics.normalizedMismatchCount,
        falsePositiveCount: fieldMetrics.falsePositiveCount,
        confidence: completeConfidenceMetrics(fieldMetrics.confidence),
        confidenceBands: completeConfidenceBands(fieldMetrics.confidenceBands),
      };
    }),
  };
}

function evaluateCases(
  manifest: OcrBenchmarkFixtureManifest,
  results: OcrBenchmarkCandidateResultSet,
  fixtures: readonly BenchmarkFixtureCase[],
): BenchmarkMetrics {
  const metrics = createMutableBenchmarkMetrics(manifest);
  for (const fixture of fixtures) accumulateFixtureCase(metrics, manifest, fixture, results);
  return completeMetrics(metrics, manifest);
}

interface OriginalCorrectedPair {
  readonly original: BenchmarkFixtureCase;
  readonly corrected: BenchmarkFixtureCase;
}

function findOriginalCorrectedPairs(
  cases: readonly BenchmarkFixtureCase[],
): readonly OriginalCorrectedPair[] {
  const casesByGroup = new Map<string, BenchmarkFixtureCase[]>();
  for (const fixture of cases) {
    const group = casesByGroup.get(fixture.comparisonGroupId) ?? [];
    group.push(fixture);
    casesByGroup.set(fixture.comparisonGroupId, group);
  }
  const pairs: OriginalCorrectedPair[] = [];
  for (const group of casesByGroup.values()) {
    const original = group.find((fixture) => fixture.imageVariant === "ORIGINAL");
    const corrected = group.find((fixture) => fixture.imageVariant === "CORRECTED");
    if (original !== undefined && corrected !== undefined) pairs.push({ original, corrected });
  }
  return pairs;
}

function evaluateOriginalCorrectedPairs(
  manifest: OcrBenchmarkFixtureManifest,
  results: OcrBenchmarkCandidateResultSet,
  pairs: readonly OriginalCorrectedPair[],
): BenchmarkPairedOriginalCorrectedMetrics | null {
  if (pairs.length === 0) return null;
  const original = evaluateCases(
    manifest,
    results,
    pairs.map((pair) => pair.original),
  );
  const corrected = evaluateCases(
    manifest,
    results,
    pairs.map((pair) => pair.corrected),
  );
  return {
    groupCount: pairs.length,
    original,
    corrected,
    normalizedMatchDelta: corrected.normalizedMatchCount - original.normalizedMatchCount,
    completeAndCleanNormalizedMatchDelta:
      corrected.completeAndCleanNormalizedMatchCount -
      original.completeAndCleanNormalizedMatchCount,
  };
}

export function evaluateOcrBenchmark(
  manifest: OcrBenchmarkFixtureManifest,
  results: OcrBenchmarkCandidateResultSet,
): OcrBenchmarkReport {
  const conditions = [...new Set(manifest.cases.flatMap((fixture) => fixture.conditions))].sort();
  const imageVariants: readonly BenchmarkImageVariant[] = [
    "ORIGINAL",
    "CORRECTED",
    "NOT_APPLICABLE",
  ];
  const pairs = findOriginalCorrectedPairs(manifest.cases);
  return {
    schemaVersion: 1,
    dataset: {
      id: manifest.dataset.id,
      classification: manifest.dataset.classification,
      containsRealDocuments: manifest.dataset.containsRealDocuments,
    },
    candidate: results.candidate,
    pairedOriginalCorrectedGroupCount: pairs.length,
    pairedOriginalCorrected: evaluateOriginalCorrectedPairs(manifest, results, pairs),
    metrics: evaluateCases(manifest, results, manifest.cases),
    byCondition: conditions.map((condition) => ({
      condition,
      metrics: evaluateCases(
        manifest,
        results,
        manifest.cases.filter((fixture) => fixture.conditions.includes(condition)),
      ),
    })),
    byImageVariant: imageVariants
      .filter((imageVariant) =>
        manifest.cases.some((fixture) => fixture.imageVariant === imageVariant),
      )
      .map((imageVariant) => ({
        imageVariant,
        metrics: evaluateCases(
          manifest,
          results,
          manifest.cases.filter((fixture) => fixture.imageVariant === imageVariant),
        ),
      })),
  };
}
