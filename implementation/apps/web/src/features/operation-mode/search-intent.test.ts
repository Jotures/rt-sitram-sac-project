import { describe, expect, it } from "vitest";
import { parseSearchIntent, matchesSearchIntent, type SearchableRecord } from "./search-intent";
const now = new Date("2026-09-11T14:00:00Z");
const row: SearchableRecord = {
  id: "a",
  title: "50 galones",
  description: "VDR-768 · Juan",
  category: "Combustible",
  status: "Validado",
  amount: 1000,
  date: "2026-09-10T13:00:00Z",
};
describe("operational phrase search", () => {
  it("interprets type, plate and month, exposing what it understood", () => {
    const intent = parseSearchIntent("combustible de VDR768 este mes", now);
    expect(intent).toMatchObject({
      category: "Combustible",
      text: "vdr768",
      from: "2026-09-01",
      until: "2026-09-11",
    });
    expect(intent.labels).toContain("Texto: vdr768");
    expect(matchesSearchIntent(row, intent)).toBe(true);
    expect(matchesSearchIntent({ ...row, date: "2026-08-20" }, intent)).toBe(false);
    expect(matchesSearchIntent({ ...row, category: "Gasto" }, intent)).toBe(false);
  });
  it("uses Peru calendar dates at the UTC month boundary", () => {
    const intent = parseSearchIntent("combustible hoy", new Date("2026-10-01T02:00:00Z"));
    expect(intent.from).toBe("2026-09-30");
    expect(matchesSearchIntent({ ...row, date: "2026-10-01T02:30:00Z" }, intent)).toBe(true);
    expect(matchesSearchIntent({ ...row, date: "2026-10-01T06:00:00Z" }, intent)).toBe(false);
  });
  it("matches only known pending accounts, never unknown or cancelled", () => {
    const intent = parseSearchIntent("salidas pendientes de rendir", now);
    expect(intent.pendingAccount).toBe(true);
    expect(matchesSearchIntent({ ...row, category: "Salida", pendingAccount: true }, intent)).toBe(
      true,
    );
    expect(matchesSearchIntent({ ...row, category: "Salida" }, intent)).toBe(false);
  });
  it("keeps literal multiword searches and unrecognized or negative qualifiers", () => {
    expect(
      matchesSearchIntent(
        { ...row, title: "José", description: "QA-001" },
        parseSearchIntent("jose qa001", now),
      ),
    ).toBe(true);
    expect(parseSearchIntent("gastos sin validar", now).labels).toEqual([]);
    expect(parseSearchIntent("gastos mayores a 100", now).text).toContain("mayores");
    expect(matchesSearchIntent(row, parseSearchIntent("combustible mayores a 100", now))).toBe(
      false,
    );
  });
  it("handles last month at the year boundary, weeks and observed accounts", () => {
    expect(parseSearchIntent("gastos mes pasado", new Date("2026-01-10T12:00Z"))).toMatchObject({
      from: "2025-12-01",
      until: "2025-12-31",
    });
    expect(parseSearchIntent("gastos esta semana", now).from).toBe("2026-09-07");
    expect(parseSearchIntent("rendición observada", now)).toMatchObject({
      category: "Rendición",
      status: "observed",
      text: "",
    });
  });
});
