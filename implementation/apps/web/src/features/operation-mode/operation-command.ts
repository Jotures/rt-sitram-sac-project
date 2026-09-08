import type { CommonPowerSyncDatabase } from "@powersync/web";

export interface ServiceInput {
  readonly client_id: string;
  readonly origin: string;
  readonly destination: string;
  readonly cargo_description: string;
  readonly cargo_tons: number | null;
  readonly freight_amount: number | null;
  readonly leg_kind: "outbound" | "return" | "continuation";
}
export interface FuelInput {
  readonly id: string;
  readonly quantity: number;
  readonly unit_price: number;
  readonly total_amount: number;
  readonly volume_unit: "gallon" | "liter";
  readonly payment_source: "company" | "driver_fund";
  readonly odometer_km: number | null;
}
export type OperationCommandBody =
  | {
      readonly kind: "rendition";
      readonly payload: {
        readonly cycle_id: string;
        readonly settlement_id: string;
        readonly occurred_at: string;
        readonly lines: readonly RenditionLineInput[];
        readonly baseline: string;
        readonly expected_version: number;
        readonly reason: string | null;
      };
    }
  | {
      readonly kind: "departure";
      readonly payload: {
        readonly vehicle_id: string;
        readonly driver_id: string;
        readonly status: "planned" | "active";
        readonly capture_channel?: "office" | "driver_app";
        readonly occurred_at: string;
        readonly notes: string | null;
        readonly advance: {
          readonly id: string;
          readonly amount: number;
          readonly method: string;
        } | null;
        readonly fuel: FuelInput | null;
        readonly service: ServiceInput | null;
      };
    }
  | {
      readonly kind: "service";
      readonly payload: ServiceInput & { readonly cycle_id: string; readonly occurred_at: string };
    }
  | {
      readonly kind: "advance";
      readonly payload: {
        readonly cycle_id: string;
        readonly amount: number;
        readonly method: string;
        readonly occurred_at: string;
        readonly description: string | null;
      };
    }
  | {
      readonly kind: "expense";
      readonly payload: {
        readonly cycle_id: string;
        readonly category_id: string;
        readonly amount: number;
        readonly occurred_at: string;
        readonly description: string | null;
      };
    }
  | {
      readonly kind: "fuel";
      readonly payload: FuelInput & { readonly cycle_id: string; readonly occurred_at: string };
    }
  | {
      readonly kind: "return" | "start";
      readonly payload: { readonly cycle_id: string; readonly occurred_at: string };
    }
  | {
      readonly kind: "service_complete";
      readonly payload: {
        readonly cycle_id: string;
        readonly trip_id: string;
        readonly occurred_at: string;
        readonly cargo_delivered: true;
      };
    };

export type OperationCommand = OperationCommandBody & {
  readonly id: string;
  readonly contractVersion: 1;
  readonly dependencyId: string | null;
};

export interface RenditionLineInput {
  readonly category_id: string;
  readonly declared: number;
  readonly recognized: number;
  readonly description: string;
}

export function makeOperationCommand(
  body: OperationCommandBody,
  id: string = crypto.randomUUID(),
): OperationCommand {
  return {
    ...body,
    id,
    contractVersion: 1,
    dependencyId: "cycle_id" in body.payload ? body.payload.cycle_id : null,
  };
}

export function operationMovementId(id: string, offset: 1 | 2): string {
  return `${id.slice(0, -2)}${(Number.parseInt(id.slice(-2), 16) ^ offset).toString(16).padStart(2, "0")}`;
}

export async function enqueueOperationCommand(
  database: CommonPowerSyncDatabase,
  command: OperationCommand,
  identity: {
    readonly companyId: string;
    readonly profileId: string;
    readonly sourceDeviceId: string;
  },
): Promise<void> {
  const payload = JSON.stringify(command.payload);
  // Keep exactly the same envelope on a local retry. The server compares the full payload too.
  await database.writeTransaction(async (transaction) => {
    const existing = await transaction.getOptional<{ kind: string; payload: string }>(
      "SELECT kind, payload FROM operation_commands WHERE id = ? UNION ALL SELECT kind, payload FROM operation_command_journal WHERE id = ? LIMIT 1",
      [command.id, command.id],
    );
    if (existing !== null) {
      if (existing.kind !== command.kind || existing.payload !== payload)
        throw new Error("Este registro ya se guardó con otros datos. Inicia una nueva corrección.");
      return;
    }
    const values = [
      command.id,
      identity.companyId,
      identity.profileId,
      command.kind,
      payload,
      command.contractVersion,
      command.dependencyId,
      identity.sourceDeviceId,
      new Date().toISOString(),
    ];
    await transaction.execute(
      `INSERT INTO operation_command_journal
      (id, company_id, actor_id, kind, payload, contract_version, dependency_id, source_device_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      values,
    );
    await transaction.execute(
      `INSERT INTO operation_commands
      (id, company_id, actor_id, kind, payload, contract_version, dependency_id, source_device_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      values,
    );
  });
}

export function operationCommandLabel(kind: string): string {
  const labels: Record<string, string> = {
    departure: "Salida",
    service: "Servicio",
    advance: "Dinero entregado",
    expense: "Gasto",
    fuel: "Combustible",
    return: "Regreso a Cusco",
    start: "Inicio de salida",
    service_complete: "Entrega de servicio",
  };
  return labels[kind] ?? "Operación";
}

export function operationCommandSummary(payload: string): string {
  try {
    const data: unknown = JSON.parse(payload);
    if (data === null || typeof data !== "object") return "";
    const details: string[] = [];
    if ("origin" in data && "destination" in data)
      details.push(`${String(data.origin)} → ${String(data.destination)}`);
    if ("notes" in data && typeof data.notes === "string") details.push(data.notes);
    const amount =
      "amount" in data ? data.amount : "total_amount" in data ? data.total_amount : null;
    if (typeof amount === "number")
      details.push(
        new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount),
      );
    if ("description" in data && typeof data.description === "string")
      details.push(data.description);
    if (
      "advance" in data &&
      data.advance !== null &&
      typeof data.advance === "object" &&
      "amount" in data.advance &&
      typeof data.advance.amount === "number"
    ) {
      details.push(`Fondo inicial: S/ ${data.advance.amount.toFixed(2)}`);
    }
    return details.join(" · ");
  } catch {
    return "";
  }
}
