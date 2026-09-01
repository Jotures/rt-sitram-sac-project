import { describe, expect, it } from "vitest";
import { GpsProviderError } from "@rt-sitram/integrations";
import {
  classifyGoldcarTargetAvailabilityInspectionFailure,
  GoldcarTargetAvailabilityInspectionError,
  runGoldcarTargetAvailabilityInspectionOperation,
  toGoldcarTargetAvailabilityInspectionFailureOutput,
  toGoldcarTargetAvailabilityInspectionOutput,
  toGoldcarTargetAvailabilityInspectionTargetState,
} from "./target-availability-inspection";

describe("Goldcar target availability inspection", () => {
  it("maps only bounded local availability states", () => {
    expect(toGoldcarTargetAvailabilityInspectionTargetState("UNIQUE_VISIBLE")).toBe(
      "UNIQUE_VISIBLE",
    );
    expect(toGoldcarTargetAvailabilityInspectionTargetState("ABSENT")).toBe("ABSENT_AT_WINDOW_END");
    expect(toGoldcarTargetAvailabilityInspectionTargetState("PRESENT_NOT_VISIBLE")).toBe(
      "PRESENT_NOT_VISIBLE_AT_WINDOW_END",
    );
    expect(toGoldcarTargetAvailabilityInspectionTargetState("MULTIPLE_VISIBLE")).toBe(
      "MULTIPLE_VISIBLE_AT_WINDOW_END",
    );
  });

  it("serializes only fixed availability and aggregate policy categories", () => {
    const output = toGoldcarTargetAvailabilityInspectionOutput({
      target: "MULTIPLE_VISIBLE_AT_WINDOW_END",
      bootstrap: {
        preArmObjectsDynamicBlocked: true,
        eligibleDynamicBlockedAfterCap: true,
        routingConditionBlocked: false,
      },
    });
    const serialized = JSON.stringify(output);

    expect(output).toEqual({
      status: "completed",
      target: "MULTIPLE_VISIBLE_AT_WINDOW_END",
      bootstrap: {
        preArmObjectsDynamicBlocked: true,
        eligibleDynamicBlockedAfterCap: true,
        routingConditionBlocked: false,
      },
    });
    for (const sensitiveValue of [
      "PORTAL-NAME:X3N-719",
      "X3N-719",
      "https://satelital.gpsgoldcar.com/objects/48291?private=query",
      "private=query",
      "12874",
      "cookie",
      "response",
      "5",
    ]) {
      expect(serialized).not.toContain(sensitiveValue);
    }
  });

  it("turns upstream errors into canonical, value-free failure output", () => {
    const error = classifyGoldcarTargetAvailabilityInspectionFailure(
      "DISCOVER_OBJECTS",
      new GpsProviderError(
        "RATE_LIMITED",
        "https://satelital.gpsgoldcar.com/objects private cookie X3N-719 12874",
      ),
    );

    expect(toGoldcarTargetAvailabilityInspectionFailureOutput(error)).toEqual({
      status: "failed",
      code: "RATE_LIMITED",
      phase: "DISCOVER_OBJECTS",
    });
    const serialized = JSON.stringify(toGoldcarTargetAvailabilityInspectionFailureOutput(error));
    expect(serialized).not.toContain("satelital");
    expect(serialized).not.toContain("X3N-719");
    expect(serialized).not.toContain("12874");

    const unknownFailure = new GoldcarTargetAvailabilityInspectionError("LOGIN", "UNAUTHORIZED");
    expect(toGoldcarTargetAvailabilityInspectionFailureOutput(unknownFailure)).toEqual({
      status: "failed",
      code: "UNAUTHORIZED",
      phase: "LOGIN",
    });
  });

  it("bounds an unfinished local diagnostic operation without leaking its message", async () => {
    const error = await runGoldcarTargetAvailabilityInspectionOperation(
      () => new Promise<never>(() => undefined),
      1,
    ).catch((reason: unknown) =>
      classifyGoldcarTargetAvailabilityInspectionFailure("DISCOVER_OBJECTS", reason),
    );

    expect(toGoldcarTargetAvailabilityInspectionFailureOutput(error)).toEqual({
      status: "failed",
      code: "UNAVAILABLE",
      phase: "DISCOVER_OBJECTS",
    });
    expect(JSON.stringify(toGoldcarTargetAvailabilityInspectionFailureOutput(error))).not.toContain(
      "presupuesto local",
    );
  });
});
