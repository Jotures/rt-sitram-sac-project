import { describe, expect, it } from "vitest";
import {
  loadGoldcarCsvSchemaInspectionConfig,
  loadGoldcarManualSyncConfig,
  loadGoldcarRequestManifestInspectionConfig,
  loadGoldcarStaticResourceManifestInspectionConfig,
  loadGoldcarSensorInspectionConfig,
  loadGoldcarTargetAvailabilityInspectionConfig,
  loadGoldcarWorkerConfig,
  sanitizeGoldcarError,
  sanitizeGoldcarManualSyncError,
  sanitizeGoldcarSensorInspectionError,
  sanitizeGoldcarTargetAvailabilityInspectionError,
} from "./config";

const validEnvironment = {
  GOLDCAR_PORTAL_ALLOW_LIVE_READ: "true",
  GOLDCAR_PORTAL_EMAIL: "robot@example.test",
  GOLDCAR_PORTAL_PASSWORD: "a-secret-password",
  GOLDCAR_BROWSER_CHANNEL: "chrome",
} as const;

describe("Goldcar worker configuration", () => {
  it("fails closed unless live reads are explicitly enabled", () => {
    expect(() =>
      loadGoldcarWorkerConfig({ ...validEnvironment, GOLDCAR_PORTAL_ALLOW_LIVE_READ: "false" }),
    ).toThrow("kill switch");
  });

  it("loads bounded defaults without exposing credentials in its errors", () => {
    const config = loadGoldcarWorkerConfig(validEnvironment);

    expect(config).toMatchObject({
      maxAssets: 100,
      timeoutMs: 30_000,
      headless: true,
      browserChannel: "chrome",
      timeZoneOffset: "-05:00",
    });
    expect(
      sanitizeGoldcarError(
        new Error("Login robot@example.test a-secret-password https://host.test/path?token=secret"),
        config,
      ),
    ).toBe("Login [REDACTED] [REDACTED] [URL_REDACTED]");
  });

  it("requires a second persistence gate and server-only Supabase credentials for manual sync", () => {
    const syncEnvironment = {
      ...validEnvironment,
      GOLDCAR_SYNC_ALLOW_PERSIST: "true",
      SUPABASE_URL: "https://project.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
      GOLDCAR_SYNC_COMPANY_ID: "11111111-1111-4111-8111-111111111111",
      GOLDCAR_SYNC_OPERATOR_PROFILE_ID: "22222222-2222-4222-8222-222222222222",
    } as const;

    expect(() =>
      loadGoldcarManualSyncConfig({ ...syncEnvironment, GOLDCAR_SYNC_ALLOW_PERSIST: "false" }),
    ).toThrow("persistencia manual");
    const config = loadGoldcarManualSyncConfig(syncEnvironment);
    expect(config).toMatchObject({
      companyId: "11111111-1111-4111-8111-111111111111",
      operatorProfileId: "22222222-2222-4222-8222-222222222222",
      leaseSeconds: 120,
      maxDurationSeconds: 240,
      persistenceMaxAttempts: 3,
    });
    expect(
      sanitizeGoldcarManualSyncError(
        new Error("service-role-secret https://project.supabase.co/rest/v1/rpc/test"),
        config,
      ),
    ).toBe("[REDACTED] [URL_REDACTED]");
  });

  it("requires a separate sensor-inspection gate and one canonical approved target", () => {
    const sensorEnvironment = {
      ...validEnvironment,
      GOLDCAR_SENSOR_INSPECTION_ALLOW_READ: "true",
      GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ: "true",
      GOLDCAR_SENSOR_TARGET_CANONICAL_ID: "portal-name:x3n-719",
    } as const;

    expect(() =>
      loadGoldcarSensorInspectionConfig({
        ...sensorEnvironment,
        GOLDCAR_SENSOR_INSPECTION_ALLOW_READ: "false",
      }),
    ).toThrow("kill switch");
    expect(() =>
      loadGoldcarSensorInspectionConfig({
        ...sensorEnvironment,
        GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ: "false",
      }),
    ).toThrow("bootstrap dinámico");
    expect(() =>
      loadGoldcarSensorInspectionConfig({
        ...sensorEnvironment,
        GOLDCAR_SENSOR_TARGET_CANONICAL_ID: "x3n-719",
      }),
    ).toThrow("PORTAL-NAME");

    const config = loadGoldcarSensorInspectionConfig(sensorEnvironment);
    expect(config.sensorTargetCanonicalId).toBe("PORTAL-NAME:X3N-719");
    expect(config.objectsBootstrapAllowDynamicRead).toBe(true);
    expect(
      sanitizeGoldcarSensorInspectionError(
        new Error(
          "PORTAL-NAME:X3N-719 robot@example.test a-secret-password https://host.test/detail",
        ),
        config,
      ),
    ).toBe("[REDACTED] [REDACTED] [REDACTED] [URL_REDACTED]");
  });

  it("requires a separate target-availability gate without enabling sensor detail", () => {
    const availabilityEnvironment = {
      ...validEnvironment,
      GOLDCAR_TARGET_AVAILABILITY_INSPECTION_ALLOW_READ: "true",
      GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ: "true",
      GOLDCAR_SENSOR_TARGET_CANONICAL_ID: "portal-name:x3n-719",
    } as const;

    expect(() =>
      loadGoldcarTargetAvailabilityInspectionConfig({
        ...availabilityEnvironment,
        GOLDCAR_TARGET_AVAILABILITY_INSPECTION_ALLOW_READ: "false",
      }),
    ).toThrow("disponibilidad Goldcar");
    expect(() =>
      loadGoldcarTargetAvailabilityInspectionConfig({
        ...availabilityEnvironment,
        GOLDCAR_PORTAL_ALLOW_LIVE_READ: "false",
      }),
    ).toThrow("lectura live");
    expect(() =>
      loadGoldcarTargetAvailabilityInspectionConfig({
        ...availabilityEnvironment,
        GOLDCAR_OBJECTS_BOOTSTRAP_ALLOW_DYNAMIC_READ: "false",
      }),
    ).toThrow("bootstrap dinámico");
    expect(() =>
      loadGoldcarTargetAvailabilityInspectionConfig({
        ...availabilityEnvironment,
        GOLDCAR_SENSOR_TARGET_CANONICAL_ID: "x3n-719",
      }),
    ).toThrow("PORTAL-NAME");

    const config = loadGoldcarTargetAvailabilityInspectionConfig(availabilityEnvironment);
    expect(config).toMatchObject({
      sensorTargetCanonicalId: "PORTAL-NAME:X3N-719",
      objectsBootstrapAllowDynamicRead: true,
    });
    expect(
      sanitizeGoldcarTargetAvailabilityInspectionError(
        new Error(
          "PORTAL-NAME:X3N-719 robot@example.test a-secret-password https://host.test/objects",
        ),
        config,
      ),
    ).toBe("[REDACTED] [REDACTED] [REDACTED] [URL_REDACTED]");
  });

  it("requires a separate CSV-schema inspection gate in addition to the live-read gate", () => {
    expect(() =>
      loadGoldcarCsvSchemaInspectionConfig({
        ...validEnvironment,
        GOLDCAR_CSV_SCHEMA_INSPECTION_ALLOW_READ: "false",
      }),
    ).toThrow("esquema CSV Goldcar");
    expect(() =>
      loadGoldcarCsvSchemaInspectionConfig({
        ...validEnvironment,
        GOLDCAR_PORTAL_ALLOW_LIVE_READ: "false",
        GOLDCAR_CSV_SCHEMA_INSPECTION_ALLOW_READ: "true",
      }),
    ).toThrow("lectura live");

    expect(
      loadGoldcarCsvSchemaInspectionConfig({
        ...validEnvironment,
        GOLDCAR_CSV_SCHEMA_INSPECTION_ALLOW_READ: "true",
      }),
    ).toMatchObject({
      maxAssets: 100,
      timeoutMs: 30_000,
      baseUrl: new URL("https://satelital.gpsgoldcar.com/"),
    });
  });

  it("requires a separate passive-request-manifest gate in addition to the live-read gate", () => {
    expect(() =>
      loadGoldcarRequestManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_REQUEST_MANIFEST_INSPECTION_ALLOW_READ: "false",
      }),
    ).toThrow("solicitudes Goldcar");
    expect(() =>
      loadGoldcarRequestManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_PORTAL_ALLOW_LIVE_READ: "false",
        GOLDCAR_REQUEST_MANIFEST_INSPECTION_ALLOW_READ: "true",
      }),
    ).toThrow("lectura live");

    expect(
      loadGoldcarRequestManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_REQUEST_MANIFEST_INSPECTION_ALLOW_READ: "true",
      }),
    ).toMatchObject({ maxAssets: 100, timeoutMs: 30_000 });
  });

  it("requires a separate passive-static-resource-manifest gate", () => {
    expect(() =>
      loadGoldcarStaticResourceManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_STATIC_RESOURCE_MANIFEST_INSPECTION_ALLOW_READ: "false",
      }),
    ).toThrow("recursos estáticos Goldcar");
    expect(() =>
      loadGoldcarStaticResourceManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_PORTAL_ALLOW_LIVE_READ: "false",
        GOLDCAR_STATIC_RESOURCE_MANIFEST_INSPECTION_ALLOW_READ: "true",
      }),
    ).toThrow("lectura live");
    expect(
      loadGoldcarStaticResourceManifestInspectionConfig({
        ...validEnvironment,
        GOLDCAR_STATIC_RESOURCE_MANIFEST_INSPECTION_ALLOW_READ: "true",
      }),
    ).toMatchObject({ maxAssets: 100, timeoutMs: 30_000 });
  });

  it("rejects unsafe URLs, conflicting browser selectors and excessive limits", () => {
    expect(() =>
      loadGoldcarWorkerConfig({
        ...validEnvironment,
        GOLDCAR_PORTAL_BASE_URL: "http://example.test",
      }),
    ).toThrow("host HTTPS aprobado");
    expect(() =>
      loadGoldcarWorkerConfig({
        ...validEnvironment,
        GOLDCAR_PORTAL_BASE_URL: "https://example.test",
      }),
    ).toThrow("host HTTPS aprobado");
    expect(() =>
      loadGoldcarWorkerConfig({
        ...validEnvironment,
        GOLDCAR_BROWSER_EXECUTABLE_PATH: "C:/browser/chrome.exe",
      }),
    ).toThrow("no ambos");
    expect(() =>
      loadGoldcarWorkerConfig({ ...validEnvironment, GOLDCAR_PORTAL_MAX_ASSETS: "1001" }),
    ).toThrow("entre 1 y 1000");
  });
});
