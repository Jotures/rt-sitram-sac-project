import { describe, expect, it } from "vitest";
import { canRoleAccessRoute, getRoleHomePath, productRouteAccess, routePaths } from "./route-model";

describe("product route access", () => {
  it("keeps password setup on the explicit authentication callback path", () => {
    expect(routePaths.passwordSetup).toBe("/auth/establecer-clave");
  });

  it("keeps every protected product route in the access matrix", () => {
    expect(new Set(productRouteAccess.map(({ id }) => id)).size).toBe(productRouteAccess.length);
  });

  it("sends each role to an allowed home", () => {
    expect(getRoleHomePath("management")).toBe(routePaths.home);
    expect(getRoleHomePath("administration")).toBe(routePaths.home);
    expect(getRoleHomePath("accounting")).toBe(routePaths.settlements);
    expect(getRoleHomePath("driver")).toBe(routePaths.myTrip);
  });

  it("limits driver routes to the driver experience", () => {
    expect(canRoleAccessRoute("driver", "myTrip")).toBe(true);
    expect(canRoleAccessRoute("driver", "registerFuel")).toBe(true);
    expect(canRoleAccessRoute("driver", "trips")).toBe(false);
    expect(canRoleAccessRoute("driver", "reports")).toBe(false);
    expect(canRoleAccessRoute("driver", "profileSettings")).toBe(false);
  });

  it("keeps accounting out of operational mutations", () => {
    expect(canRoleAccessRoute("accounting", "settlements")).toBe(true);
    expect(canRoleAccessRoute("accounting", "collections")).toBe(true);
    expect(canRoleAccessRoute("accounting", "newTrip")).toBe(false);
    expect(canRoleAccessRoute("accounting", "newMaintenance")).toBe(false);
  });

  it("keeps fuel records visible to financial roles but outside the driver routes", () => {
    expect(routePaths.fuelEntries).toBe("/finanzas/combustible");
    expect(canRoleAccessRoute("management", "fuelEntries")).toBe(true);
    expect(canRoleAccessRoute("administration", "fuelEntries")).toBe(true);
    expect(canRoleAccessRoute("accounting", "fuelEntries")).toBe(true);
    expect(canRoleAccessRoute("driver", "fuelEntries")).toBe(false);
  });

  it("limits the travel evaluator to negotiation roles", () => {
    expect(routePaths.tripEvaluator).toBe("/evaluador-viajes");
    expect(canRoleAccessRoute("management", "tripEvaluator")).toBe(true);
    expect(canRoleAccessRoute("administration", "tripEvaluator")).toBe(true);
    expect(canRoleAccessRoute("accounting", "tripEvaluator")).toBe(false);
    expect(canRoleAccessRoute("driver", "tripEvaluator")).toBe(false);
  });

  it("keeps operational cycles available only to operations roles", () => {
    expect(routePaths.operationalCycles).toBe("/operacion/ciclos");
    expect(canRoleAccessRoute("management", "operationalCycles")).toBe(true);
    expect(canRoleAccessRoute("administration", "operationalCycles")).toBe(true);
    expect(canRoleAccessRoute("accounting", "operationalCycles")).toBe(false);
    expect(canRoleAccessRoute("driver", "operationalCycles")).toBe(false);
  });

  it("reserves GPS odometer authority for management", () => {
    expect(routePaths.gpsOdometerSettings).toBe("/configuracion/odometro-gps");
    expect(canRoleAccessRoute("management", "gpsOdometerSettings")).toBe(true);
    expect(canRoleAccessRoute("administration", "gpsOdometerSettings")).toBe(false);
    expect(canRoleAccessRoute("accounting", "gpsOdometerSettings")).toBe(false);
    expect(canRoleAccessRoute("driver", "gpsOdometerSettings")).toBe(false);
  });
});
