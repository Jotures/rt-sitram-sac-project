/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isDriverTripCaptureWritable, isTripWritable } from "./driver-data";

const source = readFileSync(fileURLToPath(new URL("./driver-data.ts", import.meta.url)), "utf8");

describe("driver local data projection", () => {
  it("keeps only active operational states writable", () => {
    expect(isTripWritable("loading")).toBe(true);
    expect(isTripWritable("in_transit")).toBe(true);
    expect(isTripWritable("unloading")).toBe(true);
    expect(isTripWritable("completed")).toBe(false);
  });

  it("never presents a dead-lettered mutation as accepted activity", () => {
    for (const table of ["expenses", "fuel_entries", "incidents", "odometer_entries"]) {
      expect(source).toContain(`dead.source_table = '${table}'`);
    }
    expect(source).toContain("dead.source_record_id");
  });

  it("keeps the server status alongside the local projection", () => {
    expect(source).toContain("t.operational_status AS server_operational_status");
    expect(source).toContain("t.capture_mode, t.capture_mode_changed_at");
  });

  it("blocks driver capture when office has taken the trip", () => {
    expect(
      isDriverTripCaptureWritable({
        operational_status: "in_transit",
        capture_mode: "staff_assisted",
      }),
    ).toBe(false);
    expect(
      isDriverTripCaptureWritable({ operational_status: "in_transit", capture_mode: "driver_app" }),
    ).toBe(true);
  });
});
