import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  filterSearchableGroupedSelectGroups,
  normalizeSearchableGroupedSelectText,
  SearchableGroupedSelect,
  type SearchableGroupedSelectGroup,
} from "./SearchableGroupedSelect";

const groups: readonly SearchableGroupedSelectGroup[] = [
  {
    id: "company",
    label: "Empresa",
    options: [{ value: "company", label: "R&T SITRAM SAC", description: "Empresa actual" }],
  },
  {
    id: "vehicles",
    label: "Unidades",
    options: [
      {
        value: "vehicle:1",
        label: "X3N-719",
        description: "Volvo · Disponible",
        searchTerms: ["placa", "volvo"],
      },
    ],
  },
  {
    id: "trips",
    label: "Viajes",
    options: [
      {
        value: "trip:1",
        label: "Cusco → Lima",
        description: "X3N-719 · Jotures",
        searchTerms: ["RT-2026-0003", "Jotures"],
      },
    ],
  },
];

describe("SearchableGroupedSelect", () => {
  it("finds human references and technical references without accents", () => {
    expect(normalizeSearchableGroupedSelectText("CúSCO")).toBe("cusco");
    expect(filterSearchableGroupedSelectGroups(groups, "jotures")).toEqual([
      expect.objectContaining({ id: "trips" }),
    ]);
    expect(filterSearchableGroupedSelectGroups(groups, "rt-2026")[0]?.options[0]?.label).toBe(
      "Cusco → Lima",
    );
    expect(filterSearchableGroupedSelectGroups(groups, "unidades")[0]?.options[0]?.label).toBe(
      "X3N-719",
    );
  });

  it("keeps a native form value while exposing an accessible combobox", () => {
    const markup = renderToStaticMarkup(
      <SearchableGroupedSelect
        error="Selecciona el registro asociado."
        groups={groups}
        help="Busca por placa, ruta, conductor o cliente."
        label="Registro asociado"
        name="association"
        onChange={() => undefined}
        required
        value="vehicle:1"
      />,
    );

    expect(markup).toContain('name="association"');
    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain("Registro asociado");
    expect(markup).toContain("Seleccionado:");
    expect(markup).toContain("X3N-719");
    expect(markup).toContain('role="alert"');
  });
});
