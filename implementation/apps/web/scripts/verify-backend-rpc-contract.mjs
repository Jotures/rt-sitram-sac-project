import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const migrationsDirectory = path.resolve(webRoot, "..", "..", "supabase", "migrations");

const contracts = [
  { name: "approve_trip", args: ["trip_id"], source: "src/features/trips/trips.ts" },
  {
    name: "schedule_trip",
    args: ["trip_id", "vehicle_id", "driver_id"],
    source: "src/features/trips/trips.ts",
  },
  {
    name: "start_trip",
    args: ["trip_id", "initial_mileage"],
    source: "src/features/trips/trips.ts",
  },
  {
    name: "complete_trip",
    args: ["trip_id", "final_mileage", "cargo_delivered"],
    source: "src/features/trips/trips.ts",
  },
  {
    name: "issue_trip_advance",
    args: ["trip_id", "driver_id", "amount", "concept"],
    source: "src/features/trip-money/trip-money.ts",
  },
  {
    name: "close_settlement",
    args: ["settlement_id", "resolution_method", "resolution_reference", "resolution_note"],
    source: "src/features/admin-ui/admin-data.ts",
  },
  {
    name: "reopen_settlement",
    args: ["settlement_id", "reason"],
    source: "src/features/trip-money/trip-money.ts",
  },
  {
    name: "complete_work_order",
    args: ["work_order_id", "final_mileage", "labour_cost", "parts_cost"],
    source: "src/features/fleet/fleet.ts",
  },
  {
    name: "create_trip_invoice",
    args: ["trip_id", "client_id", "series", "number", "issued_at", "due_at", "total"],
    source: "src/features/collections/collections.ts",
  },
  {
    name: "register_invoice_payment",
    args: ["invoice_id", "paid_at", "amount", "method", "reference"],
    source: "src/features/collections/collections.ts",
  },
  { name: "resolve_alert", args: ["alert_id", "note"], source: "src/features/alerts/alerts.ts" },
  {
    name: "review_expense",
    args: ["expense_id", "validation_status", "approved_amount", "note"],
    source: "src/features/admin-ui/admin-data.ts",
  },
  {
    name: "link_driver_profile",
    args: ["driver_id", "profile_id"],
    source: "src/features/admin-ui/admin-data.ts",
  },
  {
    name: "create_trip_with_load",
    args: [
      "client_id",
      "origin",
      "destination",
      "scheduled_at",
      "freight_amount",
      "cargo_description",
      "cargo_tons",
    ],
    source: "src/features/admin-ui/admin-data.ts",
  },
  {
    name: "record_odometer_entry",
    args: [
      "p_id",
      "p_trip_id",
      "p_reading_km",
      "p_reading_at",
      "p_reading_type",
      "p_source_device_id",
      "p_idempotency_key",
    ],
    source: "src/lib/powersync/upload.ts",
  },
  {
    name: "record_fuel_entry",
    args: [
      "p_id",
      "p_trip_id",
      "p_supplier_id",
      "p_fueled_at",
      "p_location",
      "p_odometer_km",
      "p_quantity",
      "p_volume_unit",
      "p_unit_price",
      "p_total_amount",
      "p_currency",
      "p_payment_method",
      "p_receipt_type",
      "p_receipt_number",
      "p_receipt_file_id",
      "p_source_device_id",
      "p_idempotency_key",
    ],
    source: "src/lib/powersync/upload.ts",
  },
  {
    name: "record_expense",
    args: [
      "p_id",
      "p_trip_id",
      "p_category_id",
      "p_supplier_id",
      "p_incurred_at",
      "p_amount",
      "p_currency",
      "p_receipt_type",
      "p_receipt_number",
      "p_receipt_file_id",
      "p_description",
      "p_source_device_id",
      "p_idempotency_key",
    ],
    source: "src/lib/powersync/upload.ts",
  },
  {
    name: "report_incident",
    args: [
      "p_id",
      "p_trip_id",
      "p_occurred_at",
      "p_location",
      "p_incident_type",
      "p_severity",
      "p_description",
      "p_action_taken",
      "p_estimated_cost",
      "p_file_id",
      "p_source_device_id",
      "p_idempotency_key",
    ],
    source: "src/lib/powersync/upload.ts",
  },
  {
    name: "apply_driver_trip_transition",
    args: [
      "p_request_id",
      "p_trip_id",
      "p_action",
      "p_odometer_km",
      "p_cargo_delivered",
      "p_occurred_at",
      "p_source_device_id",
    ],
    source: "src/lib/powersync/upload.ts",
  },
  {
    name: "create_trip_evaluation_policy",
    args: [
      "policy_key",
      "name",
      "currency",
      "margin_basis",
      "tax_basis",
      "tax_rate",
      "minimum_margin_rate",
      "target_margin_rate",
      "cost_coverage",
    ],
    optionalArgs: ["effective_from", "effective_to"],
    source: "src/features/trip-evaluator/evaluation-data.ts",
  },
  {
    name: "save_trip_evaluation",
    args: [
      "policy_id",
      "input",
      "evaluation_id",
      "client_id",
      "vehicle_id",
      "reference",
      "expected_version",
      "idempotency_key",
    ],
    source: "src/features/trip-evaluator/evaluation-data.ts",
  },
  {
    name: "fix_trip_evaluation",
    args: ["evaluation_id"],
    source: "src/features/trip-evaluator/evaluation-data.ts",
  },
  {
    name: "approve_trip_evaluation_exception",
    args: ["exception_id", "reason"],
    source: "src/features/trip-evaluator/evaluation-data.ts",
  },
];

function extractArguments(sql, functionName) {
  const marker = `create function public.${functionName}`;
  let offset = 0;
  const signatures = [];
  while ((offset = sql.indexOf(marker, offset)) !== -1) {
    const open = sql.indexOf("(", offset + marker.length);
    let depth = 0;
    let close = -1;
    for (let index = open; index < sql.length; index += 1) {
      if (sql[index] === "(") depth += 1;
      if (sql[index] === ")") depth -= 1;
      if (depth === 0) {
        close = index;
        break;
      }
    }
    const declaration = sql.slice(open + 1, close).replaceAll(/--.*$/gm, " ");
    const parts = [];
    let current = "";
    depth = 0;
    for (const character of declaration) {
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (character === "," && depth === 0) {
        parts.push(current);
        current = "";
      } else {
        current += character;
      }
    }
    if (current.trim()) parts.push(current);
    signatures.push(parts.map((part) => part.trim().split(/\s+/u)[0]));
    offset = close + 1;
  }
  return signatures;
}

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((name) => name.endsWith(".sql"))
  .sort();
const sql = (
  await Promise.all(
    migrationFiles.map((name) => readFile(path.join(migrationsDirectory, name), "utf8")),
  )
)
  .join("\n")
  .toLowerCase();
const failures = [];

for (const contract of contracts) {
  const signatureArgs = [...contract.args, ...(contract.optionalArgs ?? [])];
  const expected = signatureArgs.join(",");
  const signatures = extractArguments(sql, contract.name);
  if (!signatures.some((signature) => signature.join(",") === expected)) {
    failures.push(
      `${contract.name}: SQL signature ${expected} not found; found ${signatures.map((value) => value.join(",")).join(" | ") || "none"}`,
    );
  }
  const source = (await readFile(path.join(webRoot, contract.source), "utf8")).toLowerCase();
  const invocation = source.indexOf(`"${contract.name}"`);
  if (invocation === -1) {
    failures.push(`${contract.name}: frontend invocation not found in ${contract.source}`);
    continue;
  }
  for (const argument of contract.args) {
    if (!new RegExp(`\\b${argument}\\s*(?::|[,}])`, "u").test(source)) {
      failures.push(
        `${contract.name}: frontend argument ${argument} not found in ${contract.source}`,
      );
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Backend RPC contract verification failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `Backend RPC contract verified: ${contracts.length} frontend commands match SQL signatures.`,
);
