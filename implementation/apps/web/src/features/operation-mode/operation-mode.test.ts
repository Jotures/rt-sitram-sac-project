import { describe, expect, it } from "vitest";
import { defaultOperationMode, resolveModePreference } from "./operation-mode";
import { getDesktopNavigation, getMobileNavigation } from "../../app/navigation/navigation-model";

describe("global operation preference", () => {
  it("defaults office users to quick mode and keeps role permissions separate", () => {
    expect(defaultOperationMode("management")).toBe("quick");
    expect(defaultOperationMode("administration")).toBe("quick");
    expect(defaultOperationMode("accounting")).toBe("full");
    expect(
      getDesktopNavigation("accounting", "quick")
        .flatMap((g) => g.items)
        .map((i) => i.id),
    ).not.toContain("profileSettings");
  });
  it("keeps an offline preference across restart until it reaches the account", () => {
    expect(
      resolveModePreference("management", "quick", JSON.stringify({ mode: "full", pending: true })),
    ).toEqual({ mode: "full", pending: true });
    expect(
      resolveModePreference(
        "management",
        "quick",
        JSON.stringify({ mode: "full", pending: false }),
      ),
    ).toEqual({ mode: "quick", pending: false });
  });
  it("ignores malformed metadata and damaged local storage", () => {
    expect(resolveModePreference("management", "admin", "broken")).toEqual({
      mode: "quick",
      pending: false,
    });
  });
  it("prioritizes outings across desktop and mobile while retaining other tools", () => {
    const navigation = getDesktopNavigation("management", "quick");
    expect(navigation[0]?.items.map((i) => i.id)).toContain("operationalCycles");
    expect(
      navigation.find((g) => g.label === "Más herramientas")?.items.map((i) => i.id),
    ).toContain("maintenance");
    expect(getMobileNavigation("management", "quick").map((i) => i.id)).toContain(
      "operationalCycles",
    );
    expect(
      getDesktopNavigation("management", "full")
        .flatMap((g) => g.items)
        .map((i) => i.id),
    ).toContain("scheduling");
  });
});
