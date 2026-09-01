import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCliOptions, runOcrBenchmark } from "./cli";
import { evaluateOcrBenchmark } from "./metrics";
import { parseOcrBenchmarkCandidateResultSet, parseOcrBenchmarkFixtureManifest } from "./schema";

const manifestPath = fileURLToPath(
  new URL("../fixtures/synthetic/fuel-receipts-manifest.v1.json", import.meta.url),
);
const resultsPath = fileURLToPath(
  new URL("../fixtures/synthetic/synthetic-baseline-results.v1.json", import.meta.url),
);

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function loadBenchmark() {
  const manifest = parseOcrBenchmarkFixtureManifest(loadJson(manifestPath));
  const results = parseOcrBenchmarkCandidateResultSet(loadJson(resultsPath), manifest);
  return { manifest, results };
}

function collectStringLeaves(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => collectStringLeaves(entry));
  if (typeof value !== "object" || value === null) return [];
  return Object.values(value).flatMap((entry) => collectStringLeaves(entry));
}

describe("OCR benchmark harness", () => {
  it("reports field-level metrics without including the document values", () => {
    const { manifest, results } = loadBenchmark();
    const report = evaluateOcrBenchmark(manifest, results);
    const documentValues = [
      ...manifest.cases.flatMap((fixture) =>
        Object.values(fixture.groundTruth).flatMap((field) => [field.raw, field.normalized]),
      ),
      ...results.runs.flatMap((run) =>
        Object.values(run.fields).flatMap((field) => [field.raw, field.normalized]),
      ),
    ];

    expect(report.metrics).toMatchObject({
      caseCount: 4,
      succeededCaseCount: 3,
      failedCaseCount: 1,
      expectedFieldCount: 44,
      extractedFieldCount: 36,
      rawExactMatchCount: 32,
      normalizedMatchCount: 34,
      missingExpectedCount: 9,
      normalizedMismatchCount: 1,
      falsePositiveCount: 1,
      allExpectedFieldsNormalizedMatchCount: 2,
      completeAndCleanNormalizedMatchCount: 2,
      latency: {
        all: { sampleCount: 4, averageMs: 267.5, p50Ms: 120, p95Ms: 510 },
        succeeded: { sampleCount: 3, p50Ms: 120, p95Ms: 340 },
        failed: { sampleCount: 1, averageMs: 510, p50Ms: 510, p95Ms: 510 },
      },
      confidence: { sampleCount: 36, minimum: 0.3, maximum: 0.99 },
    });
    expect(report.pairedOriginalCorrectedGroupCount).toBe(1);
    expect(report.pairedOriginalCorrected).toMatchObject({
      groupCount: 1,
      original: { normalizedMatchCount: 12, completeAndCleanNormalizedMatchCount: 1 },
      corrected: { normalizedMatchCount: 12, completeAndCleanNormalizedMatchCount: 1 },
      normalizedMatchDelta: 0,
      completeAndCleanNormalizedMatchDelta: 0,
    });
    expect(report.metrics.confidenceBands).toEqual(
      expect.arrayContaining([
        {
          lowerInclusive: 0.2,
          upperExclusive: 0.4,
          extractedCount: 1,
          normalizedMatchCount: 0,
          normalizedMismatchCount: 1,
          falsePositiveCount: 0,
          normalizedMatchRate: 0,
        },
        {
          lowerInclusive: 0.6,
          upperExclusive: 0.8,
          extractedCount: 11,
          normalizedMatchCount: 10,
          normalizedMismatchCount: 0,
          falsePositiveCount: 1,
          normalizedMatchRate: 10 / 11,
        },
        {
          lowerInclusive: 0.8,
          upperExclusive: null,
          extractedCount: 24,
          normalizedMatchCount: 24,
          normalizedMismatchCount: 0,
          falsePositiveCount: 0,
          normalizedMatchRate: 1,
        },
      ]),
    );
    expect(report.byImageVariant.map((entry) => entry.imageVariant)).toEqual([
      "ORIGINAL",
      "CORRECTED",
    ]);
    expect(report.metrics.byField.find((field) => field.fieldId === "tax_id")).toMatchObject({
      expectedCount: 4,
      extractedCount: 3,
      normalizedMatchCount: 2,
      normalizedMismatchCount: 1,
      missingExpectedCount: 1,
    });
    expect(report.metrics.byField.find((field) => field.fieldId === "tax_amount")).toMatchObject({
      expectedCount: 2,
      extractedCount: 3,
      falsePositiveCount: 1,
    });
    expect(report.byCondition.map((entry) => entry.condition)).toEqual([
      "clean",
      "corrected",
      "frontal",
      "glare",
      "low_contrast",
      "shadow",
      "skew",
      "thermal",
    ]);
    const reportValues = collectStringLeaves(report);
    for (const documentValue of documentValues) {
      expect(reportValues).not.toContain(documentValue);
    }
    for (const fixture of manifest.cases) {
      expect(reportValues).not.toContain(fixture.id);
    }
  });

  it("rejects real source markers inside a synthetic-only corpus", () => {
    const rawManifest = loadJson(manifestPath) as {
      dataset: { classification: string; containsRealDocuments: boolean };
      cases: Array<{ source: string; input?: unknown }>;
    };
    const malformed = structuredClone(rawManifest);
    malformed.cases[0]!.source = "REAL_AUTHORIZED";
    malformed.cases[0]!.input = {
      localReference: "corpus/RT-FUEL-2026Q3-001.jpg",
      sha256: "a".repeat(64),
    };

    expect(() => parseOcrBenchmarkFixtureManifest(malformed)).toThrow("fuentes reales");
  });

  it("requires a local fingerprint for an authorized real input", () => {
    const rawManifest = loadJson(manifestPath) as {
      cases: Array<{ source: string }>;
    };
    const malformed = structuredClone(rawManifest);
    malformed.cases[0]!.source = "REAL_AUTHORIZED";

    expect(() => parseOcrBenchmarkFixtureManifest(malformed)).toThrow("activo local y huella");
  });

  it("requires paired original/corrected fixtures to share the same truth", () => {
    const rawManifest = loadJson(manifestPath) as {
      cases: Array<{ groundTruth: Record<string, { normalized: string }> }>;
    };
    const malformed = structuredClone(rawManifest);
    malformed.cases[1]!.groundTruth.total_amount!.normalized = "SYNTHETIC_DIFFERENT";

    expect(() => parseOcrBenchmarkFixtureManifest(malformed)).toThrow("misma verdad de campo");
  });

  it("rejects a candidate result that attempts to add an undeclared field", () => {
    const manifest = parseOcrBenchmarkFixtureManifest(loadJson(manifestPath));
    const rawResults = loadJson(resultsPath) as {
      runs: Array<{ fields: Record<string, unknown> }>;
    };
    const malformed = structuredClone(rawResults);
    malformed.runs[0]!.fields.unapproved_field = {
      raw: "SENSITIVE_VALUE",
      normalized: "SENSITIVE_VALUE",
    };

    expect(() => parseOcrBenchmarkCandidateResultSet(malformed, manifest)).toThrow(
      "campo no declarado",
    );
  });

  it("requires the candidate to use the manifest normalization profile", () => {
    const manifest = parseOcrBenchmarkFixtureManifest(loadJson(manifestPath));
    const rawResults = loadJson(resultsPath) as {
      candidate: { normalizationProfile: { version: string } };
    };
    const malformed = structuredClone(rawResults);
    malformed.candidate.normalizationProfile.version = "9.0.0";

    expect(() => parseOcrBenchmarkCandidateResultSet(malformed, manifest)).toThrow(
      "no coincide con el perfil",
    );
  });

  it("verifies hashes for controlled real inputs before evaluating them", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "rt-ocr-assets-"));
    const corpusDirectory = join(temporaryDirectory, "corpus");
    const controlledAsset = Buffer.from("controlled synthetic fixture");
    const hash = createHash("sha256").update(controlledAsset).digest("hex");
    const rawManifest = loadJson(manifestPath) as {
      dataset: { classification: string; containsRealDocuments: boolean };
      cases: Array<{ source: string; input?: unknown }>;
    };
    const controlledManifest = structuredClone(rawManifest);
    controlledManifest.dataset.classification = "CONTROLLED_REAL";
    controlledManifest.dataset.containsRealDocuments = true;

    try {
      await mkdir(corpusDirectory);
      for (const [index, fixture] of controlledManifest.cases.entries()) {
        fixture.source = "REAL_AUTHORIZED";
        fixture.input = {
          localReference: `corpus/fixture-${index + 1}.bin`,
          sha256: hash,
        };
        await writeFile(join(corpusDirectory, `fixture-${index + 1}.bin`), controlledAsset);
      }
      const controlledManifestPath = join(temporaryDirectory, "manifest.json");
      await writeFile(controlledManifestPath, JSON.stringify(controlledManifest), "utf8");

      const report = await runOcrBenchmark({
        manifestPath: controlledManifestPath,
        resultsPath,
        outputPath: null,
        assetRootPath: temporaryDirectory,
        overwriteOutput: false,
      });
      expect(report).not.toContain("GRIFO DEMO NORTE");
      expect(report).not.toContain("corpus/fixture-1.bin");
      expect(report).not.toContain(hash);
      await writeFile(join(corpusDirectory, "fixture-1.bin"), "tampered", "utf8");
      await expect(
        runOcrBenchmark({
          manifestPath: controlledManifestPath,
          resultsPath,
          outputPath: null,
          assetRootPath: temporaryDirectory,
          overwriteOutput: false,
        }),
      ).rejects.toThrow("No se pudo verificar la huella local");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("parses the explicit CLI contract and emits only the aggregate report", async () => {
    expect(parseCliOptions(["--manifest", "manifest.json", "--results", "results.json"])).toEqual({
      manifestPath: "manifest.json",
      resultsPath: "results.json",
      outputPath: null,
      assetRootPath: null,
      overwriteOutput: false,
    });
    expect(parseCliOptions(["--help"])).toBe("HELP");
    expect(
      parseCliOptions(["--", "--manifest", "manifest.json", "--results", "results.json"]),
    ).toEqual({
      manifestPath: "manifest.json",
      resultsPath: "results.json",
      outputPath: null,
      assetRootPath: null,
      overwriteOutput: false,
    });
    await expect(
      runOcrBenchmark({
        manifestPath,
        resultsPath,
        outputPath: null,
        assetRootPath: null,
        overwriteOutput: false,
      }),
    ).resolves.not.toContain("GRIFO DEMO NORTE");
  });

  it("does not overwrite benchmark inputs or an existing report without explicit consent", async () => {
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "rt-ocr-benchmark-"));
    const outputPath = join(temporaryDirectory, "report.json");
    await writeFile(outputPath, "preserve", "utf8");

    try {
      await expect(
        runOcrBenchmark({
          manifestPath,
          resultsPath,
          outputPath,
          assetRootPath: null,
          overwriteOutput: false,
        }),
      ).rejects.toThrow("reporte ya existe");
      await expect(readFile(outputPath, "utf8")).resolves.toBe("preserve");
      await expect(
        runOcrBenchmark({
          manifestPath,
          resultsPath,
          outputPath,
          assetRootPath: null,
          overwriteOutput: true,
        }),
      ).resolves.not.toContain("GRIFO DEMO NORTE");
      await expect(
        runOcrBenchmark({
          manifestPath,
          resultsPath,
          outputPath: manifestPath,
          assetRootPath: null,
          overwriteOutput: true,
        }),
      ).rejects.toThrow("no puede reemplazar");
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
