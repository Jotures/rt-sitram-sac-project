import type { Snapshot } from "./CycleRendition";

const cents = (value: number): number => Math.round(value * 100);
export function explainRendition(data: Snapshot): {
  recognizedExpenses: number;
  additionalSheet: number;
  returned: number;
  reimbursed: number;
  pendingReview: number;
  rejected: number;
  consistent: boolean;
  steps: readonly { text: string; href: string }[];
} {
  const recognizedExpenses =
    data.expenses
      .filter((row) => row.validation_status === "validated")
      .reduce((total, row) => total + cents(Number(row.approved_amount ?? row.amount ?? 0)), 0) /
    100;
  const activePayments = data.payments.filter((row) => !row.cancelled_at);
  const returned =
    activePayments
      .filter((row) => row.direction === "DRIVER_RETURNS")
      .reduce((sum, row) => sum + cents(Number(row.amount)), 0) / 100;
  const reimbursed =
    activePayments
      .filter((row) => row.direction === "COMPANY_REIMBURSES")
      .reduce((sum, row) => sum + cents(Number(row.amount)), 0) / 100;
  const rows = [...data.expenses, ...data.fuel];
  const pendingReview = rows.filter(
    (row) => row.validation_status === "pending_review" || row.validation_status === "observed",
  ).length;
  const rejected = rows.filter((row) => row.validation_status === "rejected").length;
  const additionalSheet = (cents(data.expense_total) - cents(recognizedExpenses)) / 100;
  const consistent =
    additionalSheet >= 0 &&
    cents(data.balance) ===
      cents(data.total_advances) - cents(data.expense_total) - cents(data.driver_fuel) &&
    cents(data.remaining) === cents(data.balance) - cents(returned) + cents(reimbursed);
  const steps: { text: string; href: string }[] = [];
  if (data.settlement?.status !== "closed") {
    if (pendingReview)
      steps.push({
        text: `Revisar ${pendingReview} gasto(s) o abastecimiento(s) pendientes u observados. Todavía no forman parte del gasto reconocido.`,
        href: "#rendition-records",
      });
    if (data.summary && data.summary.baseline !== data.baseline)
      steps.push({
        text: "Los movimientos cambiaron después de preparar la hoja. Compárala otra vez antes de aprobarla.",
        href: "#rendition-sheet",
      });
    else if (data.summary && data.summary.status !== "approved")
      steps.push({
        text: "La hoja todavía requiere revisión y aprobación.",
        href: "#rendition-sheet",
      });
    if (data.cycle.status !== "completed")
      steps.push({
        text: data.cycle.returned_at
          ? "El regreso está registrado; revisa los servicios que aún impiden terminar el recorrido."
          : "Falta registrar el regreso y completar el recorrido cuando ocurra.",
        href: `/operacion/ciclos?salida=${encodeURIComponent(data.cycle.id)}`,
      });
    if (data.remaining !== 0)
      steps.push({
        text:
          data.remaining > 0
            ? "Queda una devolución del conductor por registrar cuando se realice."
            : "Queda un reembolso de la empresa por registrar cuando se realice.",
        href: "#rendition-payments",
      });
  }
  return {
    recognizedExpenses,
    additionalSheet,
    returned,
    reimbursed,
    pendingReview,
    rejected,
    consistent,
    steps,
  };
}
