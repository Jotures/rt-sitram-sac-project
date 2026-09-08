import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { CycleReport, ReportCell } from "./cycle-report";

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 46, fontFamily: "Helvetica", fontSize: 9, color: "#17313d" },
  brand: { fontSize: 10, color: "#315e50", marginBottom: 8 },
  title: { fontSize: 19, marginBottom: 6 },
  subtitle: { fontSize: 10, marginBottom: 14, color: "#526b76" },
  heading: { fontSize: 13, marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#dbe4df",
    paddingVertical: 6,
  },
  header: { backgroundColor: "#e8f1ed", fontWeight: "bold" },
  cell: { flex: 1, paddingHorizontal: 4 },
  note: { fontSize: 8, marginBottom: 5, color: "#526b76" },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, fontSize: 8, color: "#526b76" },
});
function PdfRow({ row }: { readonly row: readonly ReportCell[] }): React.JSX.Element {
  return (
    <View style={styles.row} wrap={false}>
      {row.map((cell, index) => (
        <Text key={index} style={styles.cell}>
          {cell === null
            ? "Pendiente"
            : typeof cell === "number"
              ? cell.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : cell.replaceAll("→", " > ")}
        </Text>
      ))}
    </View>
  );
}
export function CycleReportDocument({
  report,
}: {
  readonly report: CycleReport;
}): React.JSX.Element {
  return (
    <Document title={`${report.code} - ${report.title}`} author="R&T SITRAM">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>R&amp;T SITRAM · CENTRO DE CONTROL</Text>
        <Text style={styles.title}>{report.code}</Text>
        <Text style={styles.subtitle}>{report.title}</Text>
        {report.sections.map((section) => (
          <View key={section.title}>
            <View wrap={false}>
              <Text style={styles.heading}>{section.title}</Text>
              <View style={[styles.row, styles.header]} wrap={false}>
                {section.columns.map((column) => (
                  <Text key={column} style={styles.cell}>
                    {column}
                  </Text>
                ))}
              </View>
              {section.rows[0] ? (
                <PdfRow row={section.rows[0]} />
              ) : (
                <Text style={styles.note}>Sin registros.</Text>
              )}
            </View>
            {section.rows.slice(1).map((row, index) => (
              <PdfRow key={index} row={row} />
            ))}
          </View>
        ))}
        <Text style={styles.heading}>Alcance del documento</Text>
        {report.notes.map((note) => (
          <Text key={note} style={styles.note}>
            {note}
          </Text>
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${report.code} · ${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
export function createCyclePdf(report: CycleReport): Promise<Blob> {
  return pdf(<CycleReportDocument report={report} />).toBlob();
}
