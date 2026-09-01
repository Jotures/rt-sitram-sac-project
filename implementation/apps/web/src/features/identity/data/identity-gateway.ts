import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient, type Database } from "../../../lib/supabase";
import {
  isAppRole,
  type CurrentCompany,
  type CurrentIdentity,
  type CurrentProfile,
} from "../identity-model";

interface QueryFailure {
  readonly message: string;
}

interface QueryResult {
  readonly data: unknown;
  readonly error: QueryFailure | null;
}

export interface IdentityRowReader {
  readCompany(companyId: string): Promise<QueryResult>;
  readProfile(userId: string): Promise<QueryResult>;
}

export type IdentityLoadFailureReason =
  | "NOT_CONFIGURED"
  | "NOT_FOUND"
  | "QUERY_FAILED"
  | "INVALID_DATA";

export type IdentityLoadResult =
  | { readonly ok: true; readonly identity: CurrentIdentity }
  | {
      readonly ok: false;
      readonly reason: IdentityLoadFailureReason;
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];

  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseProfile(row: unknown, expectedUserId: string): CurrentProfile | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readRequiredString(row, "id");
  const companyId = readRequiredString(row, "company_id");
  const displayName = readRequiredString(row, "display_name");
  const role = row.role;
  const active = row.active;

  if (
    id !== expectedUserId ||
    companyId === null ||
    displayName === null ||
    !isAppRole(role) ||
    typeof active !== "boolean"
  ) {
    return null;
  }

  return { id, companyId, displayName, role, active };
}

function parseCompany(row: unknown, expectedCompanyId: string): CurrentCompany | null {
  if (!isRecord(row)) {
    return null;
  }

  const id = readRequiredString(row, "id");
  const legalName = readRequiredString(row, "legal_name");
  const tradeNameValue = row.trade_name;
  const active = row.active;
  const tradeName = typeof tradeNameValue === "string" ? tradeNameValue : null;

  if (
    id !== expectedCompanyId ||
    legalName === null ||
    (tradeNameValue !== null && typeof tradeNameValue !== "string") ||
    typeof active !== "boolean"
  ) {
    return null;
  }

  return { id, legalName, tradeName, active };
}

export function createSupabaseIdentityRowReader(
  client: SupabaseClient<Database>,
): IdentityRowReader {
  return {
    async readProfile(userId: string): Promise<QueryResult> {
      return client
        .from("profiles")
        .select("id, company_id, display_name, role, active")
        .eq("id", userId)
        .maybeSingle();
    },
    async readCompany(companyId: string): Promise<QueryResult> {
      return client
        .from("companies")
        .select("id, legal_name, trade_name, active")
        .eq("id", companyId)
        .maybeSingle();
    },
  };
}

export async function loadIdentityFromRows(
  reader: IdentityRowReader,
  userId: string,
): Promise<IdentityLoadResult> {
  const profileResult = await reader.readProfile(userId);

  if (profileResult.error !== null) {
    return {
      ok: false,
      reason: "QUERY_FAILED",
      message: "No fue posible consultar el perfil actual.",
    };
  }

  if (profileResult.data === null) {
    return {
      ok: false,
      reason: "NOT_FOUND",
      message: "La cuenta autenticada todavía no tiene un perfil de producto.",
    };
  }

  const profile = parseProfile(profileResult.data, userId);

  if (profile === null) {
    return {
      ok: false,
      reason: "INVALID_DATA",
      message: "El perfil actual no tiene una configuración válida.",
    };
  }

  const companyResult = await reader.readCompany(profile.companyId);

  if (companyResult.error !== null) {
    return {
      ok: false,
      reason: "QUERY_FAILED",
      message: "No fue posible consultar la empresa actual.",
    };
  }

  if (companyResult.data === null) {
    return {
      ok: false,
      reason: "NOT_FOUND",
      message: "El perfil actual no está asociado a una empresa disponible.",
    };
  }

  const company = parseCompany(companyResult.data, profile.companyId);

  if (company === null) {
    return {
      ok: false,
      reason: "INVALID_DATA",
      message: "La empresa actual no tiene una configuración válida.",
    };
  }

  return { ok: true, identity: { company, profile } };
}

export async function loadCurrentIdentity(userId: string): Promise<IdentityLoadResult> {
  const client = getSupabaseClient();

  if (client === null) {
    return {
      ok: false,
      reason: "NOT_CONFIGURED",
      message: "Supabase no está configurado para este entorno.",
    };
  }

  return loadIdentityFromRows(createSupabaseIdentityRowReader(client), userId);
}
