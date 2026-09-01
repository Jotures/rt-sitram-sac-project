import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "../../lib/supabase";
import type { GpsOdometerCandidate } from "./gps-odometer-management";
import { createSupabaseGpsOdometerManagementGateway } from "./gps-odometer-management-data";

const goldcarProviderKind = "GOLDCAR_PORTAL_RPA";

interface QueryResult {
  readonly data: unknown;
  readonly error: unknown;
}

interface QueryChain extends Promise<QueryResult> {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly maybeSingle: ReturnType<typeof vi.fn>;
}

interface TableFixture {
  readonly query: QueryChain;
  readonly select: ReturnType<typeof vi.fn>;
}

interface ManagementClientFixture {
  readonly client: SupabaseClient<Database>;
  readonly from: ReturnType<typeof vi.fn>;
  readonly rpcCalls: { readonly name: string; readonly args: Readonly<Record<string, unknown>> }[];
  table(name: string): TableFixture;
}

function queryChain(response: QueryResult): QueryChain {
  const chain = Promise.resolve(response) as QueryChain;
  Object.assign(chain, {
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn(() => chain),
  });
  return chain;
}

function clientWithResponses(
  responses: Readonly<Record<string, QueryResult>>,
  rpcErrors: Readonly<Record<string, unknown>> = {},
): ManagementClientFixture {
  const tables = new Map<string, TableFixture>();
  for (const [name, response] of Object.entries(responses)) {
    const query = queryChain(response);
    tables.set(name, {
      query,
      select: vi.fn(() => query),
    });
  }

  const from = vi.fn((name: string) => {
    const table = tables.get(name);
    if (table === undefined) throw new Error(`Unexpected table ${name}`);
    return { select: table.select };
  });
  const rpcCalls: { name: string; args: Readonly<Record<string, unknown>> }[] = [];
  const rpc = vi.fn((name: string, args: Readonly<Record<string, unknown>>) => {
    rpcCalls.push({ name, args });
    return Promise.resolve({ data: null, error: rpcErrors[name] ?? null });
  });

  return {
    client: { from, rpc } as unknown as SupabaseClient<Database>,
    from,
    rpcCalls,
    table(name: string): TableFixture {
      const table = tables.get(name);
      if (table === undefined) throw new Error(`No fixture for table ${name}`);
      return table;
    },
  };
}

function bootstrapResponses(overrides: Partial<Record<string, QueryResult>> = {}) {
  return {
    vehicle_gps_odometer_candidate: {
      data: [
        {
          position_id: "position-a",
          vehicle_id: "vehicle-a",
          provider_kind: goldcarProviderKind,
          recorded_at: "2026-08-22T09:40:23.000Z",
          received_at: "2026-08-22T09:41:00.000Z",
          odometer_km: 12_874,
          current_odometer_km: 141_601,
          authority_status: null,
        },
      ],
      error: null,
    },
    vehicles: {
      data: [{ id: "vehicle-a", plate: "VDR-768", current_odometer_km: 141_601 }],
      error: null,
    },
    gps_provider_vehicle_links: {
      data: [
        {
          id: "link-a",
          vehicle_id: "vehicle-a",
          provider_kind: goldcarProviderKind,
          active: true,
        },
      ],
      error: null,
    },
    gps_odometer_authorities: {
      data: [
        {
          id: "authority-current",
          vehicle_id: "vehicle-a",
          status: "active",
          bootstrap_mode: "standard",
          activated_at: "2026-08-22T10:00:00.000Z",
          suspended_at: null,
          suspension_reason: null,
        },
        {
          id: "authority-old",
          vehicle_id: "vehicle-a",
          status: "suspended",
          bootstrap_mode: "test_placeholder",
          activated_at: "2026-08-21T10:00:00.000Z",
          suspended_at: "2026-08-21T11:00:00.000Z",
          suspension_reason: "Lectura anterior.",
        },
      ],
      error: null,
    },
    gps_odometer_plausibility_policies: {
      data: {
        max_auto_advance_km: 500,
        max_average_speed_kmh: 90,
        configured_at: "2026-08-22T10:10:00.000Z",
        reason: "Política inicial aprobada.",
        version: 2,
      },
      error: null,
    },
    gps_odometer_promotions: {
      data: [
        {
          id: "promotion-reviewed",
          vehicle_id: "vehicle-a",
          outcome: "requires_review",
          promotion_kind: "sync",
          reported_odometer_km: 13_200,
          previous_odometer_km: 12_874,
          source_recorded_at: "2026-08-22T10:15:00.000Z",
        },
        {
          id: "promotion-pending",
          vehicle_id: "vehicle-a",
          outcome: "requires_review",
          promotion_kind: "sync",
          reported_odometer_km: 13_350,
          previous_odometer_km: 12_874,
          source_recorded_at: "2026-08-22T10:20:00.000Z",
        },
      ],
      error: null,
    },
    gps_odometer_promotion_reviews: {
      data: [{ promotion_id: "promotion-reviewed" }],
      error: null,
    },
    ...overrides,
  } satisfies Record<string, QueryResult>;
}

function commandCandidate(): GpsOdometerCandidate {
  return {
    positionId: "position-a",
    providerLinkId: "link-a",
    vehicleId: "vehicle-a",
    vehicleLabel: "VDR-768",
    recordedAt: "2026-08-22T09:40:23.000Z",
    receivedAt: "2026-08-22T09:41:00.000Z",
    odometerKm: 12_874,
    currentOdometerKm: 141_601,
    authorityStatus: null,
  };
}

describe("GPS odometer management gateway reads", () => {
  it("reads only a narrow non-location projection and maps validated bootstrap data", async () => {
    const fixture = clientWithResponses(bootstrapResponses());

    await expect(
      createSupabaseGpsOdometerManagementGateway(fixture.client).loadBootstrap(),
    ).resolves.toEqual({
      candidates: [
        {
          positionId: "position-a",
          providerLinkId: "link-a",
          vehicleId: "vehicle-a",
          vehicleLabel: "VDR-768",
          recordedAt: "2026-08-22T09:40:23.000Z",
          receivedAt: "2026-08-22T09:41:00.000Z",
          odometerKm: 12_874,
          currentOdometerKm: 141_601,
          authorityStatus: null,
        },
      ],
      authorities: [
        {
          id: "authority-current",
          vehicleId: "vehicle-a",
          vehicleLabel: "VDR-768",
          status: "active",
          bootstrapMode: "standard",
          activatedAt: "2026-08-22T10:00:00.000Z",
          suspendedAt: null,
          suspensionReason: null,
        },
      ],
      plausibilityPolicy: {
        maxAutoAdvanceKm: 500,
        maxAverageSpeedKmh: 90,
        configuredAt: "2026-08-22T10:10:00.000Z",
        reason: "Política inicial aprobada.",
        version: 2,
      },
      pendingReviews: [
        {
          promotionId: "promotion-pending",
          vehicleId: "vehicle-a",
          vehicleLabel: "VDR-768",
          reportedOdometerKm: 13_350,
          previousOdometerKm: 12_874,
          recordedAt: "2026-08-22T10:20:00.000Z",
        },
      ],
    });

    expect(fixture.table("vehicle_gps_odometer_candidate").select).toHaveBeenCalledWith(
      "position_id, vehicle_id, provider_kind, recorded_at, received_at, odometer_km, current_odometer_km, authority_status",
    );
    expect(fixture.table("vehicle_gps_odometer_candidate").query.eq).toHaveBeenCalledWith(
      "provider_kind",
      goldcarProviderKind,
    );
    expect(fixture.table("vehicle_gps_odometer_candidate").query.order).toHaveBeenCalledWith(
      "recorded_at",
      { ascending: false },
    );
    expect(fixture.table("gps_provider_vehicle_links").select).toHaveBeenCalledWith(
      "id, vehicle_id, provider_kind, active",
    );
    expect(fixture.table("gps_odometer_promotions").select).toHaveBeenCalledWith(
      "id, vehicle_id, outcome, promotion_kind, reported_odometer_km, previous_odometer_km, source_recorded_at",
    );

    const selectedFields = [
      ...fixture.table("vehicle_gps_odometer_candidate").select.mock.calls,
      ...fixture.table("gps_provider_vehicle_links").select.mock.calls,
      ...fixture.table("gps_odometer_promotions").select.mock.calls,
    ]
      .flat()
      .join(",");
    expect(selectedFields).not.toMatch(/latitude|longitude|coordinate|external_asset/i);
  });

  it("fails closed for remote errors and malformed readings without surfacing their content", async () => {
    const fixture = clientWithResponses(
      bootstrapResponses({
        vehicle_gps_odometer_candidate: {
          data: null,
          error: { message: "raw Goldcar response must not leave this boundary" },
        },
      }),
    );
    const gateway = createSupabaseGpsOdometerManagementGateway(fixture.client);

    const error = await gateway.loadBootstrap().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("No fue posible consultar de forma segura");
    expect((error as Error).message).not.toContain("raw Goldcar response");
  });

  it("rejects a candidate that is not backed by an active approved Goldcar link", async () => {
    const fixture = clientWithResponses(
      bootstrapResponses({
        gps_provider_vehicle_links: { data: [], error: null },
      }),
    );

    await expect(
      createSupabaseGpsOdometerManagementGateway(fixture.client).loadBootstrap(),
    ).rejects.toThrow("vínculo GPS");
  });
});

describe("GPS odometer management gateway commands", () => {
  it("maps management actions to their audited RPCs without a client company id", async () => {
    const fixture = clientWithResponses(bootstrapResponses());
    const gateway = createSupabaseGpsOdometerManagementGateway(fixture.client);

    await gateway.activateAuthority({
      candidate: commandCandidate(),
      expectedCurrentOdometerKm: 141_601,
      bootstrapMode: "test_placeholder",
      reason: "El marcador de prueba fue confirmado por Gerencia.",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
    await gateway.configurePlausibilityPolicy({
      maxAutoAdvanceKm: 500,
      maxAverageSpeedKmh: 90,
      reason: "Política de plausibilidad inicial.",
      idempotencyKey: "00000000-0000-4000-8000-000000000002",
    });
    await gateway.suspendAuthority({
      authorityId: "authority-a",
      reason: "Conciliación de la fuente requerida.",
    });
    await gateway.reviewPromotion({
      promotionId: "promotion-a",
      decision: "approved",
      reason: "Lectura aislada contrastada.",
      idempotencyKey: "00000000-0000-4000-8000-000000000003",
    });

    expect(fixture.rpcCalls).toEqual([
      {
        name: "activate_gps_odometer_authority",
        args: {
          p_provider_link_id: "link-a",
          p_position_id: "position-a",
          p_expected_current_odometer_km: 141_601,
          p_bootstrap_mode: "test_placeholder",
          p_reason: "El marcador de prueba fue confirmado por Gerencia.",
          p_idempotency_key: "00000000-0000-4000-8000-000000000001",
        },
      },
      {
        name: "configure_gps_odometer_plausibility_policy",
        args: {
          p_max_auto_advance_km: 500,
          p_max_average_speed_kmh: 90,
          p_reason: "Política de plausibilidad inicial.",
          p_idempotency_key: "00000000-0000-4000-8000-000000000002",
        },
      },
      {
        name: "suspend_gps_odometer_authority",
        args: {
          p_authority_id: "authority-a",
          p_reason: "Conciliación de la fuente requerida.",
        },
      },
      {
        name: "review_gps_odometer_promotion",
        args: {
          p_promotion_id: "promotion-a",
          p_decision: "approved",
          p_reason: "Lectura aislada contrastada.",
          p_idempotency_key: "00000000-0000-4000-8000-000000000003",
        },
      },
    ]);
    for (const call of fixture.rpcCalls) {
      expect(call.args).not.toHaveProperty("company_id");
    }
  });

  it("turns an RPC error into a safe action-specific message", async () => {
    const fixture = clientWithResponses(bootstrapResponses(), {
      review_gps_odometer_promotion: { message: "raw provider response" },
    });

    const error = await createSupabaseGpsOdometerManagementGateway(fixture.client)
      .reviewPromotion({
        promotionId: "promotion-a",
        decision: "rejected",
        reason: "La evidencia no es suficiente.",
        idempotencyKey: "00000000-0000-4000-8000-000000000004",
      })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("registrar la revisión de la lectura GPS");
    expect((error as Error).message).not.toContain("raw provider response");
  });
});
