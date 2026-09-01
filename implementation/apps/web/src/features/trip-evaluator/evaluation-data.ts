import type { SupabaseClient } from "@supabase/supabase-js";
import type { MarginBasis, TaxBasis } from "@rt-sitram/domain";
import type { Database } from "../../lib/supabase";
import type { PolicyCommandInput } from "./evaluation-model";

export interface EvaluatorOption {
  readonly id: string;
  readonly label: string;
}

export interface PersistedEvaluationPolicy {
  readonly id: string;
  readonly policyKey: string;
  readonly name: string;
  readonly version: number;
  readonly currency: string;
  readonly taxBasis: TaxBasis;
  readonly taxRate: number;
  readonly marginBasis: MarginBasis;
  readonly minimumMarginRate: number;
  readonly targetMarginRate: number;
  readonly costCoverage: {
    readonly directCostCategories: readonly string[];
    readonly excludedCostLabels: readonly string[];
  };
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly active: boolean;
}

export interface PersistedTripEvaluation {
  readonly id: string;
  readonly reference: string | null;
  readonly clientId: string | null;
  readonly vehicleId: string | null;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly status: "DRAFT" | "EXCEPTION_REQUIRED" | "FIXED";
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: Readonly<Record<string, unknown>>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PersistedTripEvaluationException {
  readonly id: string;
  readonly evaluationId: string;
  readonly status: "PENDING" | "APPROVED";
  readonly approvalReason: string | null;
  readonly requestedAt: string;
  readonly approvedAt: string | null;
}

export interface TripEvaluatorBootstrap {
  readonly policies: readonly PersistedEvaluationPolicy[];
  readonly activePolicy: PersistedEvaluationPolicy | null;
  readonly clients: readonly EvaluatorOption[];
  readonly vehicles: readonly EvaluatorOption[];
  readonly evaluations: readonly PersistedTripEvaluation[];
  readonly exceptions: readonly PersistedTripEvaluationException[];
}

export interface SaveEvaluationInput {
  readonly policyId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly clientId: string | null;
  readonly vehicleId: string | null;
  readonly reference: string | null;
  readonly evaluationId?: string;
  readonly expectedVersion?: number;
  readonly idempotencyKey: string;
}

export interface EvaluationDataGateway {
  loadBootstrap(): Promise<TripEvaluatorBootstrap>;
  createPolicy(input: PolicyCommandInput): Promise<PersistedEvaluationPolicy>;
  saveEvaluation(input: SaveEvaluationInput): Promise<PersistedTripEvaluation>;
  fixEvaluation(evaluationId: string): Promise<PersistedTripEvaluation>;
  approveException(exceptionId: string, reason: string): Promise<PersistedTripEvaluationException>;
}

interface QueryResult {
  readonly data: unknown;
  readonly error: { readonly message: string } | null;
}

interface EvaluationQuery {
  select(columns: string): EvaluationQuery;
  eq(field: string, value: string | boolean): EvaluationQuery;
  order(field: string, options?: { readonly ascending?: boolean }): EvaluationQuery;
  limit(count: number): EvaluationQuery;
  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

interface EvaluationSupabaseClient {
  from(table: string): EvaluationQuery;
  rpc(name: string, args: Readonly<Record<string, unknown>>): Promise<QueryResult>;
}

/**
 * The evaluator is deliberately online-first. It reads only server-authorized
 * commercial data and does not fall back to a stale local financial snapshot.
 */
export function createSupabaseEvaluationDataGateway(
  client: SupabaseClient<Database>,
): EvaluationDataGateway {
  const dataClient = client as unknown as EvaluationSupabaseClient;

  async function listRows(table: string, columns: string, order: string): Promise<readonly Row[]> {
    const result = await dataClient
      .from(table)
      .select(columns)
      .order(order, { ascending: false })
      .limit(200);
    if (result.error !== null) throw new Error(result.error.message);
    if (!Array.isArray(result.data))
      throw new Error(`La consulta de ${table} no devolvió una lista válida.`);
    return result.data.filter(isRow);
  }

  async function callRpc(name: string, args: Readonly<Record<string, unknown>>): Promise<Row> {
    const result = await dataClient.rpc(name, args);
    if (result.error !== null) throw new Error(result.error.message);
    if (!isRow(result.data)) throw new Error(`El comando ${name} no devolvió un registro válido.`);
    return result.data;
  }

  return {
    async loadBootstrap(): Promise<TripEvaluatorBootstrap> {
      const [policies, clients, vehicles, evaluations, exceptions] = await Promise.all([
        listRows(
          "trip_evaluation_policies",
          "id, policy_key, name, version, currency, tax_basis, tax_rate, margin_basis, minimum_margin_rate, target_margin_rate, cost_coverage, effective_from, effective_to, active",
          "effective_from",
        ),
        listRows("clients", "id, legal_name, active", "legal_name"),
        listRows("vehicles", "id, plate, active", "plate"),
        listRows(
          "trip_evaluations",
          "id, reference, client_id, vehicle_id, policy_id, policy_version, status, input_snapshot, result_snapshot, version, created_at, updated_at",
          "updated_at",
        ),
        listRows(
          "trip_evaluation_exceptions",
          "id, evaluation_id, status, approval_reason, requested_at, approved_at",
          "requested_at",
        ),
      ]);
      const parsedPolicies = policies.map(parsePolicy);
      return {
        policies: parsedPolicies,
        activePolicy: parsedPolicies.find((policy) => policy.active) ?? null,
        clients: clients
          .filter((client) => readBoolean(client, "active") !== false)
          .map((client) => ({
            id: requiredText(client, "id"),
            label: requiredText(client, "legal_name"),
          })),
        vehicles: vehicles
          .filter((vehicle) => readBoolean(vehicle, "active") !== false)
          .map((vehicle) => ({
            id: requiredText(vehicle, "id"),
            label: requiredText(vehicle, "plate"),
          })),
        evaluations: evaluations.map(parseEvaluation),
        exceptions: exceptions.map(parseException),
      };
    },

    async createPolicy(input: PolicyCommandInput): Promise<PersistedEvaluationPolicy> {
      const row = await callRpc("create_trip_evaluation_policy", {
        policy_key: input.policyKey,
        name: input.name,
        currency: input.currency,
        margin_basis: input.marginBasis,
        tax_basis: input.taxBasis,
        tax_rate: input.taxRate,
        minimum_margin_rate: input.minimumMarginRate,
        target_margin_rate: input.targetMarginRate,
        cost_coverage: {
          included_categories: input.costCoverage.directCostCategories,
          excluded_categories: input.costCoverage.excludedCostLabels,
        },
      });
      return parsePolicy(row);
    },

    async saveEvaluation(input: SaveEvaluationInput): Promise<PersistedTripEvaluation> {
      const row = await callRpc("save_trip_evaluation", {
        policy_id: input.policyId,
        input: input.input,
        evaluation_id: input.evaluationId ?? null,
        client_id: input.clientId,
        vehicle_id: input.vehicleId,
        reference: input.reference,
        expected_version: input.expectedVersion ?? null,
        idempotency_key: input.idempotencyKey,
      });
      return parseEvaluation(row);
    },

    async fixEvaluation(evaluationId: string): Promise<PersistedTripEvaluation> {
      return parseEvaluation(await callRpc("fix_trip_evaluation", { evaluation_id: evaluationId }));
    },

    async approveException(
      exceptionId: string,
      reason: string,
    ): Promise<PersistedTripEvaluationException> {
      const row = await callRpc("approve_trip_evaluation_exception", {
        exception_id: exceptionId,
        reason: requiredNonBlank(reason, "El motivo de excepción"),
      });
      return parseException(row);
    },
  };
}

function parsePolicy(row: Row): PersistedEvaluationPolicy {
  const coverage = readObject(row, "cost_coverage");
  return {
    id: requiredText(row, "id"),
    policyKey: requiredText(row, "policy_key"),
    name: requiredText(row, "name"),
    version: requiredNumber(row, "version"),
    currency: requiredText(row, "currency").toUpperCase(),
    taxBasis: parseTaxBasis(requiredText(row, "tax_basis")),
    taxRate: requiredNumber(row, "tax_rate"),
    marginBasis: parseMarginBasis(requiredText(row, "margin_basis")),
    minimumMarginRate: requiredNumber(row, "minimum_margin_rate"),
    targetMarginRate: requiredNumber(row, "target_margin_rate"),
    costCoverage: {
      directCostCategories: readStringArray(coverage, "included_categories"),
      excludedCostLabels: readStringArray(coverage, "excluded_categories"),
    },
    effectiveFrom: requiredText(row, "effective_from"),
    effectiveTo: readText(row, "effective_to"),
    active: readBoolean(row, "active") ?? readText(row, "status") === "active",
  };
}

function parseEvaluation(row: Row): PersistedTripEvaluation {
  return {
    id: requiredText(row, "id"),
    reference: readText(row, "reference"),
    clientId: readText(row, "client_id"),
    vehicleId: readText(row, "vehicle_id"),
    policyId: requiredText(row, "policy_id"),
    policyVersion: requiredNumber(row, "policy_version"),
    status: parseEvaluationStatus(requiredText(row, "status")),
    input: readObject(row, "input_snapshot"),
    result: readObject(row, "result_snapshot"),
    version: requiredNumber(row, "version"),
    createdAt: requiredText(row, "created_at"),
    updatedAt: requiredText(row, "updated_at"),
  };
}

function parseException(row: Row): PersistedTripEvaluationException {
  return {
    id: requiredText(row, "id"),
    evaluationId: requiredText(row, "evaluation_id"),
    status: parseExceptionStatus(requiredText(row, "status")),
    approvalReason: readText(row, "approval_reason"),
    requestedAt: requiredText(row, "requested_at"),
    approvedAt: readText(row, "approved_at"),
  };
}

function parseTaxBasis(value: string): TaxBasis {
  if (value.toUpperCase() === "INCLUDED" || value.toLowerCase() === "included") return "INCLUDED";
  if (value.toUpperCase() === "EXCLUDED" || value.toLowerCase() === "excluded") return "EXCLUDED";
  throw new Error("La política contiene una base tributaria desconocida.");
}

function parseMarginBasis(value: string): MarginBasis {
  if (value.toUpperCase() === "REVENUE" || value.toLowerCase() === "revenue") return "REVENUE";
  if (value.toUpperCase() === "COST" || value.toLowerCase() === "cost") return "COST";
  throw new Error("La política contiene una base de margen desconocida.");
}

function parseEvaluationStatus(value: string): PersistedTripEvaluation["status"] {
  const normalized = value.toUpperCase();
  if (normalized === "DRAFT" || normalized === "EXCEPTION_REQUIRED" || normalized === "FIXED") {
    return normalized;
  }
  throw new Error("La evaluación contiene un estado desconocido.");
}

function parseExceptionStatus(value: string): PersistedTripEvaluationException["status"] {
  const normalized = value.toUpperCase();
  if (normalized === "PENDING" || normalized === "APPROVED") return normalized;
  throw new Error("La excepción contiene un estado desconocido.");
}

type Row = Readonly<Record<string, unknown>>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

function requiredText(row: Row, key: string): string {
  return requiredNonBlank(readText(row, key) ?? "", `La columna ${key}`);
}

function requiredNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`${label} es obligatorio.`);
  return trimmed;
}

function readBoolean(row: Row, key: string): boolean | null {
  return typeof row[key] === "boolean" ? row[key] : null;
}

function requiredNumber(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`La columna ${key} debe ser un número válido.`);
  }
  return value;
}

function readObject(row: Row, key: string): Row {
  return isRow(row[key]) ? row[key] : {};
}

function readStringArray(row: Row, key: string): readonly string[] {
  const value = row[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
