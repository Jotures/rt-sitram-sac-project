import { describe, expect, it } from "vitest";
import { routePaths, type ProductRouteId } from "./route-model";
import {
  getProductRouteIdForPath,
  getRouteExperience,
  getRouteParentPath,
  productRouteExperience,
} from "./route-experience";

describe("route experience map", () => {
  it("covers every product route with a concrete presentation", () => {
    expect(Object.keys(productRouteExperience).sort()).toEqual(Object.keys(routePaths).sort());
    for (const routeId of Object.keys(routePaths) as ProductRouteId[]) {
      expect(getRouteExperience(routeId).label).not.toHaveLength(0);
    }
  });

  it("resolves static and parameterized routes without changing authorization paths", () => {
    expect(getProductRouteIdForPath("/viajes")).toBe("trips");
    expect(getProductRouteIdForPath("/viajes/abc-123/operacion")).toBe("tripOperation");
    expect(getProductRouteIdForPath("/flota/unit-1")).toBe("vehicleDetail");
    expect(getProductRouteIdForPath("/ruta-inexistente")).toBeNull();
  });

  it("gives every nested flow a safe parent route", () => {
    expect(getRouteParentPath("vehicleDetail")).toBe(routePaths.fleet);
    expect(getRouteParentPath("registerFuel")).toBe(routePaths.register);
    expect(getRouteParentPath("home")).toBeNull();
  });
});
