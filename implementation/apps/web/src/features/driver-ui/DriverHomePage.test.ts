import { describe, expect, it } from "vitest";
import { getDriverHomeRegisterGuidance } from "./DriverHomePage";

describe("driver home guidance", () => {
  it("explains what can be registered during an active trip", () => {
    expect(getDriverHomeRegisterGuidance(true, false)).toEqual({
      title: "¿Qué necesitas registrar?",
      copy: "Elige lo que ocurrió durante el viaje. Cada registro se guarda primero en este dispositivo.",
    });
  });

  it("does not present trip records as available before a scheduled trip starts", () => {
    expect(getDriverHomeRegisterGuidance(false, true)).toEqual({
      title: "Los registros se habilitan al iniciar el viaje",
      copy: "Cuando la unidad esté lista para salir, registra el kilometraje inicial. Después podrás guardar combustible, gastos, kilometraje e incidencias.",
    });
  });

  it("explains the next condition when there is no assigned trip", () => {
    expect(getDriverHomeRegisterGuidance(false, false)).toEqual({
      title: "Los registros se activan durante un viaje",
      copy: "Cuando Administración te asigne una salida, aquí podrás guardar combustible, gastos, kilometraje e incidencias.",
    });
  });
});
