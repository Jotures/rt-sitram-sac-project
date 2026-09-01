import { describe, expect, it, vi } from "vitest";
import {
  GoldcarPortalProvider,
  parseGoldcarPortalTimestamp,
  parseGoldcarVehicleCsv,
  type GoldcarPortalSnapshotSource,
} from "./goldcar-portal";

const csvOptions = {
  timeZoneOffset: "-05:00",
  maxRows: 10,
  receivedAt: "2026-08-20T21:12:00.000Z",
} as const;

describe("Goldcar portal CSV bridge", () => {
  it("parses the visible vehicle export without retaining its raw rows", () => {
    const csv = [
      "Nombre,Estado,Ultima conexión,Posición",
      'ABC-123,Conectado,20-08-2026 16:11:46,"-13.500000, -71.900000"',
    ].join("\n");

    expect(parseGoldcarVehicleCsv(csv, csvOptions)).toEqual([
      {
        providerAssetId: "portal-name:ABC-123",
        displayName: "ABC-123",
        connectionStatus: "Conectado",
        recordedAt: "2026-08-20T21:11:46.000Z",
        receivedAt: "2026-08-20T21:12:00.000Z",
        latitude: -13.5,
        longitude: -71.9,
      },
    ]);
  });

  it("supports the semicolon export variant and explicit missing positions", () => {
    const csv = [
      "Nombre;Estado;Ultima conexi&oacute;n;Posici&oacute;n",
      "ABC 123;Desconectado;-;-",
    ].join("\r\n");

    expect(parseGoldcarVehicleCsv(csv, csvOptions)).toEqual([
      {
        providerAssetId: "portal-name:ABC%20123",
        displayName: "ABC 123",
        connectionStatus: "Desconectado",
        recordedAt: null,
        receivedAt: "2026-08-20T21:12:00.000Z",
        latitude: null,
        longitude: null,
      },
    ]);
  });

  it("extracts coordinates from the HTML map links emitted by the portal export", () => {
    const csv = [
      "Nombre,Estado,Ultima conexión,Posición",
      'ABC-123,Conectado,20-08-2026 16:11:46,"<a href=""https://maps.example/?q=-13.500000%2C-71.900000&amp;z=15"">Ver mapa</a>"',
    ].join("\n");

    expect(parseGoldcarVehicleCsv(csv, csvOptions)[0]).toMatchObject({
      latitude: -13.5,
      longitude: -71.9,
    });
  });

  it("extracts labeled latitude and longitude values", () => {
    const csv = [
      "Nombre,Estado,Ultima conexión,Posición",
      'ABC-123,Conectado,20-08-2026 16:11:46,"Latitud: -13.500000, Longitud: -71.900000"',
    ].join("\n");

    expect(parseGoldcarVehicleCsv(csv, csvOptions)[0]).toMatchObject({
      latitude: -13.5,
      longitude: -71.9,
    });
  });

  it("uses exactly two signed geographic decimals as a conservative fallback", () => {
    const csv = [
      "Nombre,Estado,Ultima conexión,Posición",
      'ABC-123,Conectado,20-08-2026 16:11:46,"LAT -13.500000, LNG -71.900000"',
    ].join("\n");

    expect(parseGoldcarVehicleCsv(csv, csvOptions)[0]).toMatchObject({
      latitude: -13.5,
      longitude: -71.9,
    });
  });

  it("rejects ambiguous or out-of-range coordinate content", () => {
    const row = (position: string) =>
      [
        "Nombre,Estado,Ultima conexión,Posición",
        `ABC-123,Conectado,20-08-2026 16:11:46,"${position}"`,
      ].join("\n");

    expect(() => parseGoldcarVehicleCsv(row("-13.5,-71.9 / -13.6,-72.0"), csvOptions)).toThrow(
      "inequívoca",
    );
    expect(() => parseGoldcarVehicleCsv(row("-113.5,-271.9"), csvOptions)).toThrow("inequívoca");
  });

  it("fails closed on unexpected columns, duplicates and invalid calendar values", () => {
    expect(() => parseGoldcarVehicleCsv("Nombre,Estado\nABC-123,Activo", csvOptions)).toThrow(
      "ultimaconexion",
    );
    expect(() =>
      parseGoldcarVehicleCsv(
        [
          "Nombre,Estado,Ultima conexión,Posición",
          'ABC-123,Activo,20-08-2026 10:00:00,"-13.5, -71.9"',
          'ABC-123,Activo,20-08-2026 10:01:00,"-13.5, -71.9"',
        ].join("\n"),
        csvOptions,
      ),
    ).toThrow("duplicadas");
    expect(() => parseGoldcarPortalTimestamp("31-02-2026 10:00:00", "-05:00")).toThrow(
      "fuera de rango",
    );
    expect(() =>
      parseGoldcarVehicleCsv("Nombre,Estado,Ultima conexión,Posición\nABC-123,Activo,-,-", {
        ...csvOptions,
        receivedAt: "not-a-timestamp",
      }),
    ).toThrow("recepción");
  });

  it("normalizes one cached export through the provider contract", async () => {
    const source: GoldcarPortalSnapshotSource = {
      loadVehicleSnapshots: vi.fn(async () => [
        {
          providerAssetId: "portal-name:ABC-123",
          displayName: "ABC-123",
          connectionStatus: "Conectado",
          recordedAt: "2026-08-20T21:11:46.000Z",
          receivedAt: "2026-08-20T21:12:00.000Z",
          latitude: -13.5,
          longitude: -71.9,
        },
        {
          providerAssetId: "portal-name:DEF-456",
          displayName: "DEF-456",
          connectionStatus: "Sin señal",
          recordedAt: null,
          receivedAt: "2026-08-20T21:12:00.000Z",
          latitude: null,
          longitude: null,
        },
      ]),
    };
    const provider = new GoldcarPortalProvider(source);

    await expect(provider.listAssets()).resolves.toHaveLength(2);
    await expect(provider.getLatestPosition("portal-name:ABC-123")).resolves.toMatchObject({
      provider: "GOLDCAR_PORTAL_RPA",
      providerAssetId: "portal-name:ABC-123",
      recordedAt: "2026-08-20T21:11:46.000Z",
      receivedAt: "2026-08-20T21:12:00.000Z",
    });
    await expect(provider.getLatestPosition("portal-name:DEF-456")).resolves.toBeNull();
    expect(source.loadVehicleSnapshots).toHaveBeenCalledTimes(1);
    await expect(
      provider.getPositionHistory({
        externalAssetId: "portal-name:ABC-123",
        from: new Date("2026-08-20T20:00:00.000Z"),
        to: new Date("2026-08-20T22:00:00.000Z"),
        limit: 10,
      }),
    ).rejects.toMatchObject({ code: "CONFIGURATION" });
  });

  it("does not retain a failed portal snapshot as if it were reusable evidence", async () => {
    const source: GoldcarPortalSnapshotSource = {
      loadVehicleSnapshots: vi
        .fn<GoldcarPortalSnapshotSource["loadVehicleSnapshots"]>()
        .mockRejectedValueOnce(new Error("temporary portal failure"))
        .mockResolvedValueOnce([
          {
            providerAssetId: "portal-name:RECOVERED",
            displayName: "RECOVERED",
            connectionStatus: "Conectado",
            recordedAt: "2026-08-20T21:11:46.000Z",
            receivedAt: "2026-08-20T21:12:00.000Z",
            latitude: -13.5,
            longitude: -71.9,
          },
        ]),
    };
    const provider = new GoldcarPortalProvider(source);

    await expect(provider.listAssets()).rejects.toThrow("temporary portal failure");
    await expect(provider.listAssets()).resolves.toHaveLength(1);
    expect(source.loadVehicleSnapshots).toHaveBeenCalledTimes(2);
  });
});
