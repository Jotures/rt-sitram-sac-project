import { loadGoldcarStaticResourceManifestInspectionConfig } from "./config";
import {
  PlaywrightGoldcarStaticResourceManifestInspector,
  toGoldcarStaticResourceManifestFailureOutput,
  toGoldcarStaticResourceManifestOutput,
} from "./static-resource-manifest";

try {
  const config = loadGoldcarStaticResourceManifestInspectionConfig(process.env);
  const summary = await new PlaywrightGoldcarStaticResourceManifestInspector(config).inspect();
  process.stdout.write(`${JSON.stringify(toGoldcarStaticResourceManifestOutput(summary))}\n`);
} catch (error) {
  // The CLI has an aggregate-only surface: no resource URL/query, identifier,
  // source code, payload, cookie, header, response, or upstream error text.
  process.stderr.write(`${JSON.stringify(toGoldcarStaticResourceManifestFailureOutput(error))}\n`);
  process.exitCode = 1;
}
