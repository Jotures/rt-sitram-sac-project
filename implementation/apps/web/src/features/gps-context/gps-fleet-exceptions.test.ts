import { describe, expect, it } from "vitest";
import { deriveGpsFleetExceptions } from "./gps-fleet-exceptions";

describe("GPS fleet exceptions", () => {
  it("shows only the dashboard units that need a link or an initial signal", () => {
    const exceptions = deriveGpsFleetExceptions(
      [
        { id: "vehicle-a", label: "VDR-768" },
        { id: "vehicle-b", label: "X2Y-756" },
        { id: "vehicle-c", label: "X3N-719" },
      ],
      {
        kind: "READY",
        linkedVehicles: [
          { vehicleId: "vehicle-a", hasSignal: true },
          { vehicleId: "vehicle-b", hasSignal: false },
          { vehicleId: "retired-or-other", hasSignal: false },
        ],
      },
    );

    expect(exceptions).toEqual([
      { kind: "NO_SIGNAL", vehicleId: "vehicle-b", vehicleLabel: "X2Y-756" },
      { kind: "NO_LINK", vehicleId: "vehicle-c", vehicleLabel: "X3N-719" },
    ]);
  });

  it("does not invent a GPS exception while the online evidence is unavailable", () => {
    expect(
      deriveGpsFleetExceptions([{ id: "vehicle-a", label: "VDR-768" }], {
        kind: "UNAVAILABLE",
        reason: "REMOTE",
      }),
    ).toEqual([]);
  });

  it("stays hidden when the fleet has no active GPS source", () => {
    expect(
      deriveGpsFleetExceptions(
        [
          { id: "vehicle-a", label: "VDR-768" },
          { id: "vehicle-b", label: "X2Y-756" },
        ],
        { kind: "READY", linkedVehicles: [] },
      ),
    ).toEqual([]);
  });

  it("stays hidden when every dashboard unit has a linked signal", () => {
    expect(
      deriveGpsFleetExceptions(
        [
          { id: "vehicle-a", label: "VDR-768" },
          { id: "vehicle-b", label: "X2Y-756" },
        ],
        {
          kind: "READY",
          linkedVehicles: [
            { vehicleId: "vehicle-a", hasSignal: true },
            { vehicleId: "vehicle-b", hasSignal: true },
          ],
        },
      ),
    ).toEqual([]);
  });
});
