import type { AdminOperationalCycleRow } from "../admin-ui/admin-data";
import type { OperationCommandBody } from "./operation-command";
import { operationCommandLabel, operationCommandSummary } from "./operation-command";

export type QuickAction =
  | "departure"
  | "service"
  | "advance"
  | "expense"
  | "fuel"
  | "return"
  | "start";

const actionParams: Record<QuickAction, string> = {
  departure: "salida",
  service: "servicio",
  advance: "dinero",
  expense: "gasto",
  fuel: "combustible",
  return: "regreso",
  start: "partida",
};

export function actionFromSearch(search: URLSearchParams): QuickAction | null {
  return (
    (Object.keys(actionParams) as QuickAction[]).find(
      (key) => actionParams[key] === search.get("accion"),
    ) ?? null
  );
}

export function outingPath(cycleId?: string, action?: QuickAction): string {
  const params = new URLSearchParams();
  if (cycleId) params.set("salida", cycleId);
  if (action) params.set("accion", actionParams[action]);
  return `/operacion/ciclos${params.size ? `?${params}` : ""}`;
}

export function cycleStateLabel(
  cycle: Pick<AdminOperationalCycleRow, "status" | "returnedAt">,
): string {
  if (cycle.status === "cancelled") return "Cancelada";
  if (cycle.status === "completed") return "Recorrido terminado";
  if (cycle.returnedAt) return "Regreso registrado";
  return cycle.status === "planned" ? "Programada" : "En recorrido";
}

export function cycleNextStep(cycle: Pick<AdminOperationalCycleRow, "status" | "returnedAt">): {
  label: string;
  action: QuickAction | null;
} {
  if (cycle.status === "cancelled") return { label: "Consultar salida", action: null };
  if (cycle.status === "completed" || cycle.returnedAt)
    return { label: "Revisar cuenta y servicios", action: null };
  if (cycle.status === "planned") return { label: "Registrar partida", action: "start" };
  return { label: "Ver recorrido", action: null };
}

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesSearch(value: string, query: string): boolean {
  const normalized = normalizeSearch(value);
  return normalizeSearch(query)
    .split(/\s+/)
    .every((term) => normalized.includes(term) || normalized.replace(/\s/g, "").includes(term));
}

export function cycleIdentity(
  cycle: Pick<AdminOperationalCycleRow, "description" | "title">,
): string {
  return cycle.description.split(" · ").slice(0, 2).join(" · ") || cycle.title;
}

export interface OperationActivity {
  readonly id: string;
  readonly kind: string;
  readonly payload: string;
  readonly status: string;
  readonly dependency_id: string | null;
  readonly created_at: string;
  readonly error_message: string | null;
}

export class PossibleDuplicateError extends Error {}

/** Advisory only: checks recent visible commands, never merges or rejects business records. */
export function possibleDuplicate(
  body: OperationCommandBody,
  id: string,
  commands: readonly OperationActivity[],
): string | null {
  if (body.kind !== "advance" && body.kind !== "expense" && body.kind !== "fuel") return null;
  const incoming = body.payload;
  const amount = body.kind === "fuel" ? body.payload.total_amount : body.payload.amount;
  for (const command of commands) {
    if (command.id === id || command.kind !== body.kind || command.status === "failed") continue;
    try {
      const saved: unknown = JSON.parse(command.payload);
      if (
        saved === null ||
        typeof saved !== "object" ||
        !("cycle_id" in saved) ||
        saved.cycle_id !== incoming.cycle_id ||
        !("occurred_at" in saved) ||
        typeof saved.occurred_at !== "string"
      )
        continue;
      const elapsed = Math.abs(Date.parse(saved.occurred_at) - Date.parse(incoming.occurred_at));
      if (!Number.isFinite(elapsed) || elapsed > 10 * 60_000) continue;
      const previousAmount =
        "total_amount" in saved ? saved.total_amount : "amount" in saved ? saved.amount : null;
      if (previousAmount !== amount) continue;
      if (
        body.kind === "expense" &&
        (!("category_id" in saved) || saved.category_id !== body.payload.category_id)
      )
        continue;
      if (
        body.kind === "fuel" &&
        (!("quantity" in saved) ||
          saved.quantity !== body.payload.quantity ||
          !("volume_unit" in saved) ||
          saved.volume_unit !== body.payload.volume_unit ||
          !("payment_source" in saved) ||
          saved.payment_source !== body.payload.payment_source)
      )
        continue;
      return `${operationCommandLabel(command.kind)} · ${operationCommandSummary(command.payload)} · ${new Date(saved.occurred_at).toLocaleString("es-PE")}. Ya hay un registro reciente de esta salida con el mismo importe y una hora cercana. Revisa si es el mismo hecho.`;
    } catch {
      /* A malformed historical row must not stop capture. */
    }
  }
  return null;
}
