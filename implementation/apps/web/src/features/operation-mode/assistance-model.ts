import type { AdminListRow, AdminOperationalCycleRow } from "../admin-ui/admin-data";
import { cycleIdentity, outingPath } from "./workspace-model";

export interface NextStep {
  readonly id: string;
  readonly title: string;
  readonly reason: string;
  readonly action: string;
  readonly href: string;
  readonly priority: number;
  readonly date: string | null;
}

export function isOpenAccount(row: AdminListRow): boolean {
  return !/^(closed|cancelled|cerrad[ao]|cancelad[ao])$/i.test(row.rawStatus ?? row.status);
}

/** One reason and one destination per outing. Unknown account data never means no account. */
export function operationNextSteps(
  cycles: readonly AdminOperationalCycleRow[] | null,
  accounts: readonly AdminListRow[] | null,
): readonly NextStep[] {
  const steps: NextStep[] = [];
  const covered = new Set<string>();
  for (const cycle of cycles ?? []) {
    if (cycle.status === "cancelled") continue;
    const account = accounts?.find((row) => row.cycleId === cycle.id);
    if (account) covered.add(account.id);
    const returned = Boolean(cycle.returnedAt) || cycle.status === "completed";
    if (account && isOpenAccount(account)) {
      const observed = /observ/i.test(account.rawStatus ?? account.status);
      steps.push({
        id: cycle.id,
        title: cycleIdentity(cycle),
        reason: observed
          ? "La rendición tiene observaciones por revisar."
          : returned
            ? "El regreso ya está registrado y la rendición sigue abierta."
            : "La rendición está abierta; puedes revisar los registros recibidos.",
        action: observed ? "Revisar observaciones" : "Revisar rendición",
        href: `/finanzas/rendiciones/${account.id}`,
        priority: observed ? 0 : returned ? 1 : 4,
        date: cycle.date,
      });
    } else if (returned && accounts !== null && accounts.length < 200 && !account) {
      steps.push({
        id: cycle.id,
        title: cycleIdentity(cycle),
        reason: "El regreso ya está registrado y todavía no hay una rendición.",
        action: "Preparar rendición",
        href: outingPath(cycle.id),
        priority: 2,
        date: cycle.date,
      });
    } else if (cycle.status === "planned") {
      steps.push({
        id: cycle.id,
        title: cycleIdentity(cycle),
        reason: `Salida programada${cycle.date ? ` para ${new Date(cycle.date).toLocaleDateString("es-PE")}` : ""}. Registra la partida cuando ocurra.`,
        action: "Ver salida programada",
        href: outingPath(cycle.id),
        priority: 3,
        date: cycle.date,
      });
    } else if (!returned && cycle.status === "active" && !account) {
      steps.push({
        id: cycle.id,
        title: cycleIdentity(cycle),
        reason: "La unidad está en recorrido. Puedes continuar con sus movimientos.",
        action: "Ver recorrido",
        href: outingPath(cycle.id),
        priority: 5,
        date: cycle.date,
      });
    }
  }
  for (const account of accounts ?? []) {
    if (covered.has(account.id) || !isOpenAccount(account)) continue;
    steps.push({
      id: `account:${account.id}`,
      title: account.title,
      reason: /observ/i.test(account.rawStatus ?? account.status)
        ? "La rendición tiene observaciones por revisar."
        : "La rendición sigue abierta.",
      action: "Revisar rendición",
      href: `/finanzas/rendiciones/${account.id}`,
      priority: /observ/i.test(account.rawStatus ?? account.status) ? 0 : 4,
      date: account.date,
    });
  }
  return steps.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.id.localeCompare(b.id),
  );
}

export interface CaptureValues {
  readonly vehicleId: string;
  readonly occurredAt: string;
  readonly amount: string;
  readonly quantity: string;
  readonly volumeUnit: string;
  readonly categoryId: string;
  readonly odometerKm: string;
}

/** Confirmed, comparable history only; chronology matters for retrospective capture. */
export function comparableHistory(
  rows: readonly AdminListRow[],
  values: CaptureValues,
): readonly AdminListRow[] {
  const time = Date.parse(values.occurredAt);
  if (!values.vehicleId || !Number.isFinite(time)) return [];
  return rows
    .filter(
      (row) =>
        row.captureContext?.vehicleId === values.vehicleId &&
        row.rawStatus === "validated" &&
        row.captureContext.currency === "PEN" &&
        row.date !== null &&
        Date.parse(row.date) <= time &&
        time - Date.parse(row.date) <= 90 * 86400000,
    )
    .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!));
}

export function captureWarnings(
  kind: "fuel" | "expense",
  history: readonly AdminListRow[],
  values: CaptureValues,
): readonly string[] {
  const warnings: string[] = [];
  const rows = comparableHistory(history, values);
  const reading = rows.find((row) => row.captureContext?.odometerKm !== null);
  if (
    kind === "fuel" &&
    values.odometerKm.trim() &&
    reading?.captureContext?.odometerKm != null &&
    Number(values.odometerKm) < reading.captureContext.odometerKm
  ) {
    warnings.push(
      `El kilometraje es menor que ${reading.captureContext.odometerKm.toLocaleString("es-PE")} km, registrado en el abastecimiento del ${new Date(reading.date!).toLocaleDateString("es-PE")}${reading.captureContext.local ? " (copia local)" : ""}. Revisa la fecha y la lectura.`,
    );
  }
  const comparable = rows.filter((row) =>
    kind === "fuel"
      ? row.captureContext?.volumeUnit === values.volumeUnit &&
        (row.captureContext.quantity ?? 0) > 0
      : Boolean(values.categoryId) && row.captureContext?.categoryId === values.categoryId,
  );
  const prices = comparable
    .map((row) =>
      kind === "fuel" ? (row.amount ?? 0) / row.captureContext!.quantity! : (row.amount ?? 0),
    )
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(0, 20)
    .sort((a, b) => a - b);
  const incoming =
    kind === "fuel" ? Number(values.amount) / Number(values.quantity) : Number(values.amount);
  if (prices.length >= 5 && Number.isFinite(incoming) && incoming > 0) {
    const midpoint = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 ? prices[midpoint]! : (prices[midpoint - 1]! + prices[midpoint]!) / 2;
    const threshold = kind === "fuel" ? 2 : 3;
    if (incoming > median * threshold || incoming < median / threshold) {
      warnings.push(
        `${kind === "fuel" ? "El precio por " + (values.volumeUnit === "liter" ? "litro" : "galón") : "El importe de esta categoría"} se aleja de la referencia S/ ${median.toFixed(2)} (mediana de ${prices.length} registros validados de esta unidad, últimos 90 días). Aviso orientativo: diferencia mayor a ${threshold} veces. Confirma cantidad, unidad e importe.`,
      );
    }
  }
  return warnings;
}
