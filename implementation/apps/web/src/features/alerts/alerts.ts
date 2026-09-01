import {
  type ActorContext,
  requirePermission,
  requireSameCompany,
  requireText,
} from "../shared/application";
import type { ProductCommandTransport } from "../shared/supabase-rpc";

export interface AlertModel {
  readonly id: string;
  readonly companyId: string;
  readonly type: string;
  readonly priority: "INFO" | "WARNING" | "CRITICAL";
  readonly title: string;
  readonly state: "NEW" | "SEEN" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";
  readonly dueAt: string | null;
}

export interface AlertReadStore {
  listActiveAlerts(companyId: string): Promise<readonly AlertModel[]>;
}

export interface AlertCommandGateway {
  resolveAlert(alertId: string, note: string): Promise<void>;
}

export async function listPrioritizedAlerts(
  store: AlertReadStore,
  actor: ActorContext,
): Promise<readonly AlertModel[]> {
  const priorityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 } as const;
  return [...(await store.listActiveAlerts(actor.companyId))]
    .filter((alert) => alert.companyId === actor.companyId)
    .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority]);
}

export async function resolveAlert(
  gateway: AlertCommandGateway,
  actor: ActorContext,
  alert: AlertModel,
  note: string,
): Promise<void> {
  requirePermission(actor, "MANAGE_TRIPS");
  requireSameCompany(actor, alert.companyId);
  if (alert.state === "RESOLVED" || alert.state === "DISMISSED") {
    throw new Error("La alerta ya está finalizada.");
  }
  await gateway.resolveAlert(alert.id, requireText(note, "La nota de resolución"));
}

export function createRpcAlertCommandGateway(
  transport: ProductCommandTransport,
): AlertCommandGateway {
  return {
    resolveAlert: async (alertId, note) =>
      void (await transport.invoke("resolve_alert", { alert_id: alertId, note })),
  };
}
