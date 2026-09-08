import { useState } from "react";
import { Button } from "../../components/primitives/Button";
import type { AdminDataGateway } from "../admin-ui/admin-data";
import { loadRenditionSnapshot } from "../operation-mode/CycleRendition";
import { buildCycleReport, type CycleReport } from "./cycle-report";
import { auditEntityExport, type ExportTarget } from "./entity-export-audit";
import "./cycle-report.css";

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function CycleReportPanel({
  gateway,
  cycleId,
  settlementOnly = false,
}: {
  readonly gateway: AdminDataGateway;
  readonly cycleId: string;
  readonly settlementOnly?: boolean;
}): React.JSX.Element {
  async function loadReport(): Promise<CycleReport> {
    const [detail, snapshot] = await Promise.all([
      gateway.loadOperationalCycleDetail(cycleId),
      loadRenditionSnapshot(cycleId),
    ]);
    const trips = [];
    if (!settlementOnly)
      for (const trip of detail.trips) trips.push(await gateway.loadTripDetail(trip.id));
    const result = buildCycleReport(detail, snapshot, trips);
    return settlementOnly
      ? {
          ...result,
          code: `rendicion-${result.code}`,
          sections: result.sections.filter(
            (section) => !["Servicios", "Facturas", "Cobros de clientes"].includes(section.title),
          ),
        }
      : result;
  }
  return (
    <EntityReportPanel
      key={cycleId}
      loadReport={loadReport}
      target={{ type: settlementOnly ? "cycle_settlement" : "cycle", id: cycleId }}
    />
  );
}
export function EntityReportPanel({
  loadReport,
  target,
}: {
  readonly loadReport: () => Promise<CycleReport>;
  readonly target: ExportTarget;
}): React.JSX.Element {
  const [report, setReport] = useState<CycleReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function load(format?: "pdf" | "xlsx"): Promise<void> {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      if (!navigator.onLine)
        throw new Error("Conéctate para consultar los datos actuales antes de descargar.");
      const current = await loadReport();
      setReport(current);
      if (format) await exportFile(format, current);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo consultar el resumen. Revisa la conexión.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function exportFile(format: "pdf" | "xlsx", current: CycleReport): Promise<void> {
    await auditEntityExport(target, format, current);
    const blob =
      format === "pdf"
        ? await (await import("./cycle-report-files")).createCyclePdf(current)
        : await (await import("./cycle-report-excel")).createCycleExcel(current);
    download(blob, `${current.code.replace(/[^a-zA-Z0-9_-]/g, "-")}.${format}`);
  }
  return (
    <section className="cycle-report-panel" aria-label="Resumen y descargas del registro">
      <div className="operation-quick-actions">
        <Button variant="secondary" icon="file" disabled={busy} onClick={() => void load()}>
          {busy ? "Preparando…" : report ? "Actualizar resumen" : "Ver resumen"}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void load("pdf")}>
          Descargar PDF
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void load("xlsx")}>
          Descargar Excel
        </Button>
        {report && (
          <>
            <Button variant="quiet" disabled={busy} onClick={() => setReport(null)}>
              Cerrar resumen
            </Button>
          </>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div className="cycle-report-preview">
          <h3>
            {report.code} · {report.title}
          </h3>
          <p>
            Datos confirmados en servidor al consultar. Actualiza el resumen después de registrar
            cambios. Puedes imprimir el PDF descargado.
          </p>
          {report.sections.map((section) => (
            <details
              key={section.title}
              open={section.title === "Resumen" || section.title === "Cuenta del conductor"}
            >
              <summary>{section.title}</summary>
              <div
                className="cycle-report-table"
                tabIndex={0}
                role="region"
                aria-label={section.title}
              >
                <table>
                  <thead>
                    <tr>
                      {section.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, column) => (
                          <td key={column}>
                            {cell === null
                              ? "Pendiente"
                              : typeof cell === "number"
                                ? cell.toLocaleString("es-PE", { minimumFractionDigits: 2 })
                                : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {section.rows.length === 0 && <p>Sin registros.</p>}
              </div>
            </details>
          ))}
          {report.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
    </section>
  );
}
