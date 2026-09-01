import { describe, expect, it } from "vitest";
import {
  deriveFuelUnitPrice,
  parseNonNegativeNumber,
  parsePositiveNumber,
  toIsoFromLocalInput,
} from "./driver-validation";

describe("driver capture validation", () => {
  it("accepts the decimal comma used by Spanish keyboards", () => {
    expect(parsePositiveNumber("10,5", "La cantidad")).toBe(10.5);
    expect(parseNonNegativeNumber("0", "El kilometraje")).toBe(0);
  });

  it("rejects empty, negative and zero-positive values", () => {
    expect(() => parsePositiveNumber("", "El monto")).toThrow("mayor que cero");
    expect(() => parsePositiveNumber("0", "El monto")).toThrow("mayor que cero");
    expect(() => parseNonNegativeNumber("-1", "El kilometraje")).toThrow("no negativo");
  });

  it("derives a fuel unit price consistent with the submitted total", () => {
    expect(deriveFuelUnitPrice(10, 150)).toBe(15);
  });

  it("normalizes a local date-time before persistence", () => {
    expect(toIsoFromLocalInput("2026-08-13T12:30")).toMatch(/^2026-08-13T/);
  });
});
