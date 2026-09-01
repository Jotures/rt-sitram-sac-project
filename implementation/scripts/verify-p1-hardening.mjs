import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const implementationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationNames = [
  "20260813340000_harden_function_execute_acl.sql",
  "20260813350000_harden_storage_owner_retry.sql",
  "20260813360000_lock_closed_settlement_expenses.sql",
  "20260813370000_harden_advance_idempotency.sql",
  "20260820112000_harden_trip_evaluator_function_acl.sql",
  "20260829113558_enforce_closed_settlement_expense_inserts.sql",
  "20260829130000_p1_finance_controls.sql",
  "20260829131000_create_operational_cycle_commands.sql",
];
const defaultTestNames = [
  "storage_owner_retry.test.sql",
  "backend_invariants.test.sql",
  "gps_odometer_authority.test.sql",
  "p1_finance_controls.test.sql",
  "p1_operational_cycles.test.sql",
  "rpc_contract.test.sql",
  "trip_evaluator.test.sql",
];
const requestedTestNames = process.argv.slice(2);
const testNames = requestedTestNames.length === 0 ? defaultTestNames : requestedTestNames;

const migrations = migrationNames
  .map((name) =>
    readFileSync(path.join(implementationRoot, "supabase", "migrations", name), "utf8"),
  )
  .join("\n");

function withoutTransaction(sql) {
  return sql.replace(/^\s*begin;\s*/iu, "").replace(/\s*rollback;\s*$/iu, "");
}

function withTapDiagnostics(sql) {
  return sql
    .replace(
      /select plan\((\d+)\);/iu,
      "select plan($1);\n" +
        "create temporary table tap_diagnostics " +
        "(result text) on commit drop;\n" +
        "grant insert, select on pg_temp.tap_diagnostics to authenticated;",
    )
    .replace(
      /^select (lives_ok|is|throws_ok)\(/gimu,
      "insert into pg_temp.tap_diagnostics(result) select $1(",
    )
    .replace(
      /select \* from finish\(true\);/iu,
      "insert into pg_temp.tap_diagnostics(result) select * from finish();\n" +
        "select result from pg_temp.tap_diagnostics;",
    );
}

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "rt-sitram-p1-"));

try {
  for (const testName of testNames) {
    const test = withoutTransaction(
      readFileSync(path.join(implementationRoot, "supabase", "tests", testName), "utf8"),
    );
    const queryPath = path.join(temporaryDirectory, testName);
    writeFileSync(queryPath, `begin;\n${migrations}\n${test}\nrollback;\n`, "utf8");

    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "scripts/supabase-rt.ps1",
        "--",
        "db",
        "query",
        "--linked",
        "--file",
        queryPath,
      ],
      {
        cwd: implementationRoot,
        encoding: "utf8",
        env: process.env,
      },
    );

    if (result.status !== 0) {
      process.stderr.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      const diagnosticPath = path.join(temporaryDirectory, `diagnostic-${testName}`);
      writeFileSync(
        diagnosticPath,
        `begin;\n${migrations}\n${withTapDiagnostics(test)}\nrollback;\n`,
        "utf8",
      );
      const diagnostic = spawnSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          "scripts/supabase-rt.ps1",
          "--",
          "db",
          "query",
          "--linked",
          "--file",
          diagnosticPath,
        ],
        { cwd: implementationRoot, encoding: "utf8", env: process.env },
      );
      process.stderr.write(diagnostic.stdout ?? "");
      process.stderr.write(diagnostic.stderr ?? "");
      throw result.error ?? new Error(`${testName} verification exited with ${result.status}.`);
    }
    console.log(`${testName}: verified in a rolled-back remote transaction.`);
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
