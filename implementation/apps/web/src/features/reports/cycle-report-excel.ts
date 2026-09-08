import ExcelJS from "exceljs";
import type { CycleReport } from "./cycle-report";

export async function createCycleExcel(report: CycleReport): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "R&T SITRAM";
  workbook.created = new Date(report.generatedAt);
  workbook.title = `${report.code} - ${report.title}`;
  const sections = [
    ...report.sections,
    { title: "Alcance", columns: ["Notas"], rows: report.notes.map((note) => [note]) },
  ];
  for (const section of sections) {
    const sheet = workbook.addWorksheet(section.title.slice(0, 31), {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    sheet.addRow([report.code]);
    sheet.addRow([report.title]);
    sheet.addRow([`Generado: ${report.generatedAt}`]);
    sheet.addRow([...section.columns]);
    section.rows.forEach((row) => sheet.addRow([...row]));
    sheet.columns.forEach((column, index) => {
      column.width = section.columns.length === 1 ? 95 : index === 0 ? 32 : 26;
    });
    sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FF17313D" } };
    sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF315E50" } };
    sheet.eachRow((row, index) => {
      row.alignment = { vertical: "top", wrapText: true };
      if (index > 4)
        row.eachCell((cell) => {
          if (typeof cell.value === "number") cell.numFmt = "#,##0.00;[Red]-#,##0.00";
        });
    });
    if (section.rows.length > 0)
      sheet.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: sheet.rowCount, column: section.columns.length },
      };
    sheet.pageSetup = {
      paperSize: 9,
      orientation: section.columns.length > 4 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
