import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCyclePdf } from "./cycle-report-files";
import { buildCycleReport, reportDate, type CycleReport } from "./cycle-report";
import { createCycleExcel } from "./cycle-report-excel";
import type { AdminOperationalCycleDetail } from "../admin-ui/admin-data";
import type { Snapshot } from "../operation-mode/CycleRendition";

const detail: AdminOperationalCycleDetail = {
  cycle: {
    amount: null,
    date: null,
    id: "cycle-a",
    title: "SAL-QA",
    description: "Cusco - Lima - Cusco",
    status: "active",
    vehicleId: "vehicle-a",
    primaryDriverId: "driver-a",
    returnStatus: "confirmed",
    notes: null,
    version: 1,
  },
  vehicleLabel: "QA-001",
  primaryDriverLabel: "Conductor de prueba",
  trips: [],
  eligibleTrips: [],
};
const snapshot: Snapshot = {
  cycle: {
    id: "cycle-a",
    code: "SAL-QA",
    primary_driver_id: "driver-a",
    status: "active",
    started_at: "2026-09-08T12:00:00Z",
  },
  settlement: { id: "settlement-a", status: "draft" },
  summary: null,
  baseline: "v1",
  total_advances: 1000,
  expense_total: 150,
  driver_fuel: 100,
  company_fuel: 100,
  balance: 750,
  remaining: 450,
  advances_list: [
    {
      id: "advance-a",
      amount: 1000,
      version: 1,
      status: "delivered",
      delivered_at: "2026-09-08T12:00:00Z",
    },
  ],
  expenses: [
    {
      id: "expense-a",
      version: 1,
      amount: 150,
      approved_amount: 150,
      validation_status: "validated",
      updated_at: "2026-09-08T12:00:00Z",
      description: "Gasto reconocido",
    },
  ],
  fuel: [
    {
      id: "fuel-a",
      version: 1,
      total_amount: 100,
      approved_amount: 100,
      validation_status: "validated",
      updated_at: "2026-09-08T12:00:00Z",
      payment_source: "company",
    },
  ],
  categories: [],
  evidence: [],
  payments: [
    {
      id: "payment-a",
      amount: 300,
      direction: "DRIVER_RETURNS",
      occurred_at: "2026-09-08T12:00:00Z",
      cancelled_at: null,
    },
  ],
};
describe("record report financial scope", () => {
  it("renders a multi-page PDF from the same report", async () => {
    const report = buildCycleReport(detail, snapshot, []);
    const blob = await createCyclePdf(report);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    if (process.env.REPORT_QA === "1") {
      const directory = resolve(process.cwd(), "../../.local/report-validation");
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, "salida-qa.pdf"), bytes);
      writeFileSync(
        resolve(directory, "salida-qa.xlsx"),
        new Uint8Array(await (await createCycleExcel(report)).arrayBuffer()),
      );
    }
  });
  it("preserves server balance and partial payments without deducting company fuel", () => {
    const report = buildCycleReport(detail, snapshot, []);
    const rows = report.sections.find((section) => section.title === "Cuenta del conductor")!.rows;
    expect(rows[3]?.[1]).toBe(750);
    expect(rows[4]?.[1]).toBe(300);
    expect(rows[5]?.[1]).toBe(450);
    expect(rows[6]?.[1]).toBe(100);
    expect(report.title).toContain("Preliquidación");
  });
  it("identifies reimbursement and zero balance, and only labels closed settlements closed", () => {
    const report = buildCycleReport(detail, { ...snapshot, remaining: -50, balance: -100 }, []);
    expect(report.sections[1]?.rows[5]).toEqual(["Pendiente: la empresa reembolsa", 50]);
    expect(
      buildCycleReport(
        detail,
        { ...snapshot, remaining: 0, settlement: { id: "s", status: "closed" } },
        [],
      ).title,
    ).toBe("Rendición cerrada");
  });
  it("rejects another account and excluded test operations", () => {
    expect(() =>
      buildCycleReport(detail, { ...snapshot, cycle: { ...snapshot.cycle, id: "other" } }, []),
    ).toThrow("corresponde");
    expect(() =>
      buildCycleReport(detail, { ...snapshot, cycle: { ...snapshot.cycle, is_test: true } }, []),
    ).toThrow("prueba");
    expect(() => buildCycleReport(detail, { ...snapshot, total_advances: Number.NaN }, [])).toThrow(
      "importe",
    );
  });
  it("keeps unrecognized amounts pending instead of reporting zero", () => {
    const report = buildCycleReport(
      detail,
      {
        ...snapshot,
        expenses: [
          { ...snapshot.expenses[0]!, validation_status: "pending", approved_amount: null },
        ],
      },
      [],
    );
    expect(report.sections.find((section) => section.title === "Gastos")?.rows[0]?.[4]).toBeNull();
  });
  it("uses the Peru date even at a UTC date boundary", () => {
    expect(reportDate("2026-09-09T01:00:00Z")).toContain("08");
    expect(reportDate(null)).toBe("Pendiente");
  });
  it("writes a real workbook with numeric amounts and literal untrusted text", async () => {
    const base = buildCycleReport(detail, snapshot, []);
    const report: CycleReport = {
      ...base,
      sections: [
        ...base.sections,
        {
          title: "Texto",
          columns: ["Valor"],
          rows: [['=HYPERLINK("https://example.com")'], ["<Cliente & carga>"]],
        },
      ],
    };
    const blob = await createCycleExcel(report);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.getWorksheet("Cuenta del conductor")?.getCell("B5").value).toBe(1000);
    expect(workbook.getWorksheet("Texto")?.getCell("A5").type).toBe(ExcelJS.ValueType.String);
    expect(workbook.getWorksheet("Texto")?.getCell("A6").value).toBe("<Cliente & carga>");
    expect(workbook.worksheets.length).toBe(report.sections.length + 1);
  });
});
