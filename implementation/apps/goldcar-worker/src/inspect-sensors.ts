import { loadGoldcarSensorInspectionConfig } from "./config";
import {
  PlaywrightGoldcarSensorInspector,
  toGoldcarSensorInspectionFailureOutput,
  toGoldcarSensorInspectionOutput,
} from "./sensor-inspection";

let config: ReturnType<typeof loadGoldcarSensorInspectionConfig> | null = null;

try {
  config = loadGoldcarSensorInspectionConfig(process.env);
  const summary = await new PlaywrightGoldcarSensorInspector(config).inspect();
  process.stdout.write(`${JSON.stringify(toGoldcarSensorInspectionOutput(summary))}\n`);
} catch (error) {
  // Keep the CLI surface to a canonical error code. In particular, it must
  // never print the target, detail href, DOM, cookies, or sensor readings.
  process.stderr.write(`${JSON.stringify(toGoldcarSensorInspectionFailureOutput(error))}\n`);
  process.exitCode = 1;
}
