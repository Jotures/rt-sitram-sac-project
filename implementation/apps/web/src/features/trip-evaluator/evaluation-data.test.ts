import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase";
import { createSupabaseEvaluationDataGateway } from "./evaluation-data";

function clientWithRpc(dataByName: Readonly<Record<string, unknown>>) {
  const calls: { readonly name: string; readonly args: Readonly<Record<string, unknown>> }[] = [];
  const client = {
    rpc: vi.fn((name: string, args: Readonly<Record<string, unknown>>) => {
      calls.push({ name, args });
      return Promise.resolve({ data: dataByName[name] ?? null, error: null });
    }),
    from: vi.fn(),
  };
  return { client: client as unknown as SupabaseClient<Database>, calls };
}

describe("Supabase evaluation gateway", () => {
  it("publishes a configurable policy through its authoritative command", async () => {
    const { client, calls } = clientWithRpc({
      create_trip_evaluation_policy: {
        id: "policy-a",
        policy_key: "NEG-2026",
        name: "Negociación",
        version: 1,
        currency: "PEN",
        tax_basis: "included",
        tax_rate: 0.18,
        margin_basis: "revenue",
        minimum_margin_rate: 0.1,
        target_margin_rate: 0.2,
        cost_coverage: {
          included_categories: ["Combustible"],
          excluded_categories: ["Administración"],
        },
        effective_from: "2026-08-20T00:00:00Z",
        effective_to: null,
        active: true,
      },
    });

    const policy = await createSupabaseEvaluationDataGateway(client).createPolicy({
      policyKey: "NEG-2026",
      name: "Negociación",
      currency: "PEN",
      taxBasis: "INCLUDED",
      taxRate: 0.18,
      marginBasis: "REVENUE",
      minimumMarginRate: 0.1,
      targetMarginRate: 0.2,
      costCoverage: {
        directCostCategories: ["Combustible"],
        excludedCostLabels: ["Administración"],
      },
    });

    expect(policy).toMatchObject({ id: "policy-a", marginBasis: "REVENUE", active: true });
    expect(calls).toEqual([
      {
        name: "create_trip_evaluation_policy",
        args: {
          policy_key: "NEG-2026",
          name: "Negociación",
          currency: "PEN",
          margin_basis: "REVENUE",
          tax_basis: "INCLUDED",
          tax_rate: 0.18,
          minimum_margin_rate: 0.1,
          target_margin_rate: 0.2,
          cost_coverage: {
            included_categories: ["Combustible"],
            excluded_categories: ["Administración"],
          },
        },
      },
    ]);
  });

  it("saves only the authenticated evaluation payload and never a company id", async () => {
    const { client, calls } = clientWithRpc({
      save_trip_evaluation: {
        id: "evaluation-a",
        reference: "CARGA-01",
        client_id: null,
        vehicle_id: null,
        policy_id: "policy-a",
        policy_version: 1,
        status: "draft",
        input_snapshot: {},
        result_snapshot: {},
        version: 1,
        created_at: "2026-08-20T00:00:00Z",
        updated_at: "2026-08-20T00:00:00Z",
      },
    });
    await createSupabaseEvaluationDataGateway(client).saveEvaluation({
      policyId: "policy-a",
      input: { offer_amount: 1200 },
      clientId: null,
      vehicleId: null,
      reference: "CARGA-01",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    expect(calls[0]).toEqual({
      name: "save_trip_evaluation",
      args: {
        policy_id: "policy-a",
        input: { offer_amount: 1200 },
        evaluation_id: null,
        client_id: null,
        vehicle_id: null,
        reference: "CARGA-01",
        expected_version: null,
        idempotency_key: "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(calls[0]?.args).not.toHaveProperty("company_id");
  });

  it("approves an exception only through the authoritative command with a reason", async () => {
    const { client, calls } = clientWithRpc({
      approve_trip_evaluation_exception: {
        id: "exception-a",
        evaluation_id: "evaluation-a",
        status: "APPROVED",
        approval_reason: "Mantener relación comercial documentada.",
        requested_at: "2026-08-20T00:00:00Z",
        approved_at: "2026-08-20T01:00:00Z",
      },
    });

    const result = await createSupabaseEvaluationDataGateway(client).approveException(
      "exception-a",
      "Mantener relación comercial documentada.",
    );

    expect(result).toMatchObject({ id: "exception-a", status: "APPROVED" });
    expect(calls).toEqual([
      {
        name: "approve_trip_evaluation_exception",
        args: {
          exception_id: "exception-a",
          reason: "Mantener relación comercial documentada.",
        },
      },
    ]);
  });
});
