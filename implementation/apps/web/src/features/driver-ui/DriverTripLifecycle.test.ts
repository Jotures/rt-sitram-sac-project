/// <reference types="node" />

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isTransitionConfirmedByServer, projectTripStatus } from "./DriverTripLifecycle";

const componentSource = readFileSync(
  fileURLToPath(new URL("./DriverTripLifecycle.tsx", import.meta.url)),
  "utf8",
);

describe("offline driver trip projection", () => {
  it("unlocks the full ordered journey while requests remain pending", () => {
    expect(projectTripStatus("scheduled", [])).toBe("scheduled");
    expect(projectTripStatus("scheduled", ["start"])).toBe("in_transit");
    expect(projectTripStatus("scheduled", ["start", "arrive"])).toBe("unloading");
    expect(projectTripStatus("scheduled", ["start", "arrive", "complete"])).toBe("completed");
  });

  it("ignores out-of-order transitions instead of presenting them as confirmed", () => {
    expect(projectTripStatus("scheduled", ["arrive", "complete"])).toBe("scheduled");
  });

  it("stops counting an audited request after its result arrives from the server", () => {
    expect(isTransitionConfirmedByServer("scheduled", "start")).toBe(false);
    expect(isTransitionConfirmedByServer("in_transit", "start")).toBe(true);
    expect(isTransitionConfirmedByServer("in_transit", "arrive")).toBe(false);
    expect(isTransitionConfirmedByServer("unloading", "arrive")).toBe(true);
    expect(isTransitionConfirmedByServer("completed", "complete")).toBe(true);
    expect(projectTripStatus("in_transit", ["arrive"])).toBe("unloading");
  });

  it("uses the authoritative server status to decide whether a local request is still pending", () => {
    expect(componentSource).toContain("trip.server_operational_status");
    expect(componentSource).toContain("isTransitionConfirmedByServer");
    expect(componentSource).toContain("Confirmado por el servidor");
  });

  it("always writes transitions through the local queue, even while online", () => {
    expect(componentSource).toContain("enqueueTripTransition(");
    expect(componentSource).toContain("enqueueTripStartWithLoadState(");
    expect(componentSource).toContain("Cambiar condición de carga");
    expect(componentSource).toContain("recordTripLoadStateOffline(");
    expect(componentSource).not.toContain("getDriverTripLifecycleGateway");
    expect(componentSource).not.toContain("navigator.onLine");
    expect(componentSource).not.toContain('network === "ONLINE"');
  });
});
