import { describe, expect, it } from "vitest";
import { getDesktopNavigation, getMobileNavigation } from "./navigation-model";

function navigationIds(groups: ReturnType<typeof getDesktopNavigation>): readonly string[] {
  return groups.flatMap((group) => group.items.map((item) => item.id));
}

describe("role navigation", () => {
  it("gives administration the operational workspace", () => {
    const navigation = getDesktopNavigation("administration");
    const ids = navigationIds(navigation);

    expect(ids).toContain("trips");
    expect(ids).toContain("fleet");
    expect(ids).toContain("settlements");
    expect(ids).toContain("fuelEntries");
    expect(ids).toContain("tripEvaluator");
    expect(ids).toContain("operationalCycles");
    expect(ids).not.toContain("myTrip");
    expect(
      navigation.flatMap((group) => group.items).find((item) => item.id === "tripEvaluator"),
    ).toMatchObject({
      label: "Evaluar viaje",
      description: "Calcula costos y margen antes de aceptar una carga.",
    });
    expect(
      navigation.flatMap((group) => group.items).find((item) => item.id === "operationalCycles"),
    ).toMatchObject({
      label: "Ciclos operativos",
      description: "Agrupa tramos relacionados sin mezclar los cierres de cada viaje.",
    });
  });

  it("provides a concise explanation for every navigation destination", () => {
    const destinations = [
      ...getDesktopNavigation("management").flatMap((group) => group.items),
      ...getMobileNavigation("driver"),
    ];

    expect(destinations.every((item) => item.description.trim().length > 0)).toBe(true);
  });

  it("keeps accounting navigation focused on financial and read contexts", () => {
    const ids = navigationIds(getDesktopNavigation("accounting"));

    expect(ids).toContain("expenses");
    expect(ids).toContain("fuelEntries");
    expect(ids).toContain("collections");
    expect(ids).toContain("reports");
    expect(ids).not.toContain("tripEvaluator");
    expect(ids).not.toContain("operationalCycles");
    expect(ids).not.toContain("fleet");
    expect(ids).not.toContain("profileSettings");
  });

  it("uses the reduced driver navigation on desktop and mobile", () => {
    const desktopIds = navigationIds(getDesktopNavigation("driver"));
    const mobileIds = getMobileNavigation("driver").map((item) => item.id);

    expect(desktopIds).toEqual([
      "myTrip",
      "register",
      "myTripHistory",
      "synchronization",
      "profile",
    ]);
    expect(mobileIds).toEqual(desktopIds);
  });

  it("filters unavailable mobile destinations for accounting", () => {
    expect(getMobileNavigation("accounting").map((item) => item.id)).toEqual([
      "home",
      "trips",
      "settlements",
    ]);
  });

  it("shows GPS odometer governance only to management on desktop", () => {
    expect(navigationIds(getDesktopNavigation("management"))).toContain("gpsOdometerSettings");
    expect(navigationIds(getDesktopNavigation("administration"))).not.toContain(
      "gpsOdometerSettings",
    );
    expect(getMobileNavigation("management").map((item) => item.id)).not.toContain(
      "gpsOdometerSettings",
    );
  });
});
