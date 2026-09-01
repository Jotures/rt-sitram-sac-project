import { loadGoldcarTargetAvailabilityInspectionConfig } from "./config";
import {
  PlaywrightGoldcarTargetAvailabilityInspector,
  toGoldcarTargetAvailabilityInspectionFailureOutput,
  toGoldcarTargetAvailabilityInspectionOutput,
} from "./target-availability-inspection";

try {
  const config = loadGoldcarTargetAvailabilityInspectionConfig(process.env);
  const summary = await new PlaywrightGoldcarTargetAvailabilityInspector(config).inspect();
  process.stdout.write(`${JSON.stringify(toGoldcarTargetAvailabilityInspectionOutput(summary))}\n`);
} catch (error) {
  // Do not print the approved target, DOM/text, URL, request count, cookies,
  // headers, responses, sensor values, or upstream error text.
  process.stderr.write(
    `${JSON.stringify(toGoldcarTargetAvailabilityInspectionFailureOutput(error))}\n`,
  );
  process.exitCode = 1;
}
