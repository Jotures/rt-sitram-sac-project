import { loadGoldcarCsvSchemaInspectionConfig } from "./config";
import {
  PlaywrightGoldcarCsvSchemaInspector,
  toGoldcarCsvSchemaInspectionFailureOutput,
  toGoldcarCsvSchemaInspectionOutput,
} from "./csv-schema-inspection";

try {
  const config = loadGoldcarCsvSchemaInspectionConfig(process.env);
  const summary = await new PlaywrightGoldcarCsvSchemaInspector(config).inspect();
  process.stdout.write(`${JSON.stringify(toGoldcarCsvSchemaInspectionOutput(summary))}\n`);
} catch (error) {
  // The CLI is deliberately schema-only: no CSV body, row values, asset
  // identifiers, coordinates, URLs, credentials, or upstream error text.
  process.stderr.write(`${JSON.stringify(toGoldcarCsvSchemaInspectionFailureOutput(error))}\n`);
  process.exitCode = 1;
}
