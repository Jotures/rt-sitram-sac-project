/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const streamsPath = fileURLToPath(
  new URL("../../../../../powersync/streams/product-mvp.yaml", import.meta.url),
);
const streams = readFileSync(streamsPath, "utf8");

const GPS_RELATIONS_EXCLUDED_FROM_POWER_SYNC = [
  "gps_provider_vehicle_links",
  "gps_positions",
  "vehicle_latest_positions",
  "gps_telemetry_retention_policies",
  "gps_sync_runs",
  "vehicle_gps_context",
] as const;

function streamQueries(
  section: "current_identity" | "staff_company_data" | "driver_assigned_data",
) {
  const start = streams.indexOf(`  ${section}:`);
  const nextSection = ["current_identity", "staff_company_data", "driver_assigned_data"]
    .map((name) => streams.indexOf(`  ${name}:`, start + 1))
    .filter((index) => index > start)
    .sort((left, right) => left - right)[0];
  const body = streams.slice(start, nextSection === -1 ? undefined : nextSection);

  return body
    .split(/\n\s+- SELECT /u)
    .slice(1)
    .map((query) => `SELECT ${query}`);
}

describe("PowerSync stream scope contract", () => {
  it("uses edition 3 and derives every scope from authenticated identity", () => {
    expect(streams).toContain("edition: 3");
    expect(streams).toContain("auth.user_id()");
    expect(streams).not.toContain("request.parameters");
    expect(streams).not.toContain("company_id = :");

    const queries = [
      ...streamQueries("current_identity"),
      ...streamQueries("staff_company_data"),
      ...streamQueries("driver_assigned_data"),
    ];
    expect(queries.length).toBeGreaterThan(10);
    for (const query of queries) {
      expect(query).toContain("auth.user_id()");
      expect(query).toContain("active = true");
      expect(query).toContain("companies");
    }
  });

  it("separates staff company data from driver assigned data", () => {
    expect(streams).toContain("staff_company_data:");
    expect(streams).toContain("(role = 'management' OR role = 'administration')");
    expect(streams).not.toContain("role = 'accounting'");
    expect(streams).toContain("driver_assigned_data:");
    expect(streams).toContain("profile_id = auth.user_id()");
    expect(streams).toMatch(/SELECT id FROM trips\s+WHERE driver_id IN/u);
    expect(streams).toContain("FROM trip_transition_requests");
    expect(streams).toContain("WHERE actor_id = auth.user_id()");
  });

  it("anchors bypass-RLS staff and driver buckets to active server-side identities", () => {
    const staffQueries = streamQueries("staff_company_data");
    const driverQueries = streamQueries("driver_assigned_data");

    for (const query of staffQueries) {
      expect(query).toContain("(role = 'management' OR role = 'administration')");
      expect(query).toContain("company_id IN (SELECT id FROM companies WHERE active = true)");
    }

    for (const query of driverQueries) {
      expect(query).toContain("role = 'driver'");
      expect(query).toContain("FROM drivers");
      expect(query).toContain("profile_id = auth.user_id() AND active = true");
      expect(query).toContain("company_id IN (SELECT id FROM companies WHERE active = true)");
    }

    for (const table of [
      "trip_transition_requests",
      "odometer_entries",
      "fuel_entries",
      "expenses",
      "incidents",
    ]) {
      const query = driverQueries.find((candidate) => candidate.includes(`FROM ${table}`));
      expect(query).toContain("AND trip_id IN (");
      expect(query).toContain("SELECT id FROM trips");
    }
  });

  it("contains no technical spike stream", () => {
    expect(streams).not.toContain("spike_records");
  });

  it("contains no GPS telemetry relation in its offline stream queries", () => {
    const queries = [
      ...streamQueries("current_identity"),
      ...streamQueries("staff_company_data"),
      ...streamQueries("driver_assigned_data"),
    ].join("\n");

    for (const relation of GPS_RELATIONS_EXCLUDED_FROM_POWER_SYNC) {
      expect(queries).not.toContain(relation);
    }
  });
});
