import { loadGoldcarRequestManifestInspectionConfig } from "./config";
import {
  PlaywrightGoldcarRequestManifestInspector,
  toGoldcarRequestManifestFailureOutput,
  toGoldcarRequestManifestOutput,
} from "./request-manifest";

try {
  const config = loadGoldcarRequestManifestInspectionConfig(process.env);
  const summary = await new PlaywrightGoldcarRequestManifestInspector(config).inspect();
  process.stdout.write(`${JSON.stringify(toGoldcarRequestManifestOutput(summary))}\n`);
} catch (error) {
  // Keep the process boundary aggregate-only. Do not print routes, IDs,
  // query values, payloads, cookies, headers, responses, or error text.
  process.stderr.write(`${JSON.stringify(toGoldcarRequestManifestFailureOutput(error))}\n`);
  process.exitCode = 1;
}
