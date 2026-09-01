import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldGuidance } from "./FieldGuidance";
import { GuidanceNote } from "./GuidanceNote";
import { SectionIntro } from "./SectionIntro";

describe("guidance primitives", () => {
  it("gives a section an explicit purpose and supporting content", () => {
    const markup = renderToStaticMarkup(
      <SectionIntro
        aside={<span>Datos estimados</span>}
        description="Indica la información disponible antes de calcular."
        eyebrow="Paso 1"
        title="Datos del servicio"
      />,
    );

    expect(markup).toContain("<header");
    expect(markup).toContain("Paso 1");
    expect(markup).toContain("<h2");
    expect(markup).toContain("Datos estimados");
  });

  it("keeps help, a visible example, and an announced error together", () => {
    const markup = renderToStaticMarkup(
      <FieldGuidance
        error="Ingresa un monto mayor a cero."
        example="12 500"
        help="Usa el monto total acordado con el cliente."
        id="oferta-ayuda"
      />,
    );

    expect(markup).toContain('id="oferta-ayuda"');
    expect(markup).toContain("Ejemplo:");
    expect(markup).toContain('role="alert"');
  });

  it("labels guidance without relying only on its tone", () => {
    const markup = renderToStaticMarkup(
      <GuidanceNote tone="warning">Esta estimación no incluye mantenimiento.</GuidanceNote>,
    );

    expect(markup).toContain('role="note"');
    expect(markup).toContain("Atención");
  });
});
