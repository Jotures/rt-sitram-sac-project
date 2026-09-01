import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateOcrBenchmark } from "./metrics";
import {
  parseOcrBenchmarkCandidateResultSet,
  parseOcrBenchmarkFixtureManifest,
  type OcrBenchmarkFixtureManifest,
} from "./schema";

export interface CliOptions {
  readonly manifestPath: string;
  readonly resultsPath: string;
  readonly outputPath: string | null;
  readonly assetRootPath: string | null;
  readonly overwriteOutput: boolean;
}

const usage = `Uso:
  pnpm ocr:benchmark -- --manifest <manifest.json> --results <results.json> [--asset-root <directory>] [--output <report.json>] [--overwrite]

El comando no ejecuta OCR ni imprime los valores reconocidos. Solo evalúa un
manifest y resultados normalizados ya producidos por un adaptador de benchmark.`;

function resolveFromInvocation(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function readOptionValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error(`${option} requiere una ruta.`);
  return value;
}

export function parseCliOptions(args: readonly string[]): CliOptions | "HELP" {
  let manifestPath: string | null = null;
  let resultsPath: string | null = null;
  let outputPath: string | null = null;
  let assetRootPath: string | null = null;
  let overwriteOutput = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help" || argument === "-h") return "HELP";
    if (argument === "--overwrite") {
      if (overwriteOutput) throw new Error("--overwrite solo puede declararse una vez.");
      overwriteOutput = true;
      continue;
    }
    if (argument === "--manifest") {
      if (manifestPath !== null) throw new Error("--manifest solo puede declararse una vez.");
      manifestPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--results") {
      if (resultsPath !== null) throw new Error("--results solo puede declararse una vez.");
      resultsPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--output") {
      if (outputPath !== null) throw new Error("--output solo puede declararse una vez.");
      outputPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--asset-root") {
      if (assetRootPath !== null) throw new Error("--asset-root solo puede declararse una vez.");
      assetRootPath = readOptionValue(args, index, argument);
      index += 1;
      continue;
    }
    throw new Error("Se recibió una opción de benchmark no reconocida.");
  }

  if (manifestPath === null || resultsPath === null) {
    throw new Error("Se requieren --manifest y --results.");
  }
  if (overwriteOutput && outputPath === null) {
    throw new Error("--overwrite requiere --output.");
  }
  return { manifestPath, resultsPath, outputPath, assetRootPath, overwriteOutput };
}

async function readJson(path: string, label: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new Error(`No se pudo leer el ${label} de benchmark.`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`El ${label} de benchmark no contiene JSON válido.`);
  }
}

function areSamePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

async function verifyControlledRealInputHashes(
  manifest: OcrBenchmarkFixtureManifest,
  assetRootPath: string | null,
): Promise<void> {
  const realCases = manifest.cases.filter((fixture) => fixture.source === "REAL_AUTHORIZED");
  if (realCases.length === 0) return;
  if (assetRootPath === null) {
    throw new Error(
      "Un corpus real requiere --asset-root para verificar las huellas antes de medir.",
    );
  }
  const resolvedAssetRoot = resolveFromInvocation(assetRootPath);
  for (const fixture of realCases) {
    if (fixture.input === null) {
      throw new Error("Un caso real validado no tiene activo local verificable.");
    }
    try {
      const file = await readFile(resolve(resolvedAssetRoot, fixture.input.localReference));
      const sha256 = createHash("sha256").update(file).digest("hex");
      if (sha256 !== fixture.input.sha256) {
        throw new Error("La huella local no coincide.");
      }
    } catch {
      throw new Error("No se pudo verificar la huella local de un caso del benchmark.");
    }
  }
}

export async function runOcrBenchmark(options: CliOptions): Promise<string> {
  const manifestPath = resolveFromInvocation(options.manifestPath);
  const resultsPath = resolveFromInvocation(options.resultsPath);
  const rawManifest = await readJson(manifestPath, "manifest");
  const manifest = parseOcrBenchmarkFixtureManifest(rawManifest);
  await verifyControlledRealInputHashes(manifest, options.assetRootPath);
  const rawResults = await readJson(resultsPath, "resultado");
  const results = parseOcrBenchmarkCandidateResultSet(rawResults, manifest);
  const report = JSON.stringify(evaluateOcrBenchmark(manifest, results), null, 2);

  if (options.outputPath !== null) {
    const outputPath = resolveFromInvocation(options.outputPath);
    if (areSamePath(outputPath, manifestPath) || areSamePath(outputPath, resultsPath)) {
      throw new Error("El reporte no puede reemplazar el manifest ni el resultado de entrada.");
    }
    try {
      await writeFile(outputPath, `${report}\n`, {
        encoding: "utf8",
        flag: options.overwriteOutput ? "w" : "wx",
      });
    } catch (error: unknown) {
      if (hasErrorCode(error, "EEXIST")) {
        throw new Error(
          "El reporte ya existe; use --overwrite sólo si está autorizado reemplazarlo.",
        );
      }
      throw new Error("No se pudo escribir el reporte agregado de benchmark.");
    }
  }
  return report;
}

async function main(): Promise<void> {
  try {
    const options = parseCliOptions(process.argv.slice(2));
    if (options === "HELP") {
      process.stdout.write(`${usage}\n`);
      return;
    }
    const report = await runOcrBenchmark(options);
    process.stdout.write(`${report}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Falló el benchmark OCR.";
    process.stderr.write(`Benchmark OCR detenido: ${message}\n`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && resolve(fileURLToPath(import.meta.url)) === resolve(entrypoint)) {
  void main();
}
