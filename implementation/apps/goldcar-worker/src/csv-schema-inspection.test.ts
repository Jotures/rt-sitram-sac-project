import { GpsProviderError } from "@rt-sitram/integrations";
import { describe, expect, it } from "vitest";
import type { Browser, Page } from "playwright-core";
import type { GoldcarCsvSchemaInspectionConfig } from "./config";
import {
  assertGoldcarCsvSchemaResponse,
  classifyGoldcarCsvSchemaInspectionFailure,
  inspectGoldcarCsvSchema,
  PlaywrightGoldcarCsvSchemaInspector,
  toGoldcarCsvSchemaInspectionFailureOutput,
  toGoldcarCsvSchemaInspectionOutput,
} from "./csv-schema-inspection";

const baseUrl = new URL("https://satelital.gpsgoldcar.com");
const csvUrl = new URL("https://satelital.gpsgoldcar.com/objects/list/data?action=csv");

describe("Goldcar CSV schema inspection", () => {
  it("returns only normalized headers and a nonblank data row count", () => {
    const summary = inspectGoldcarCsvSchema(
      [
        "Nombre de vehículo;Estado;Última conexión;Posición GPS",
        '"X3N-719";"En movimiento";"2028-08-22 09:40:23";"-13.2,-72.3"',
        '"Q9A-001";"Detenido";"2028-08-22 09:41:01";"-13.1,-72.4"',
        "",
      ].join("\r\n"),
      10,
    );
    const output = toGoldcarCsvSchemaInspectionOutput(summary);
    const serialized = JSON.stringify(output);

    expect(output).toEqual({
      status: "completed",
      headers: ["nombredevehiculo", "estado", "ultimaconexion", "posiciongps"],
      rowCount: 2,
    });
    expect(serialized).not.toContain("X3N-719");
    expect(serialized).not.toContain("Q9A-001");
    expect(serialized).not.toContain("-13.2");
    expect(serialized).not.toContain("2028-08-22");
  });

  it("supports exactly one comma or semicolon delimiter and handles quoted delimiters", () => {
    expect(
      inspectGoldcarCsvSchema(
        ['Asset name,Engine status,"Technical &amp; ID"', '"A-1","on, moving","opaque"'].join("\n"),
        2,
      ),
    ).toEqual({
      headers: ["assetname", "enginestatus", "technicalid"],
      rowCount: 1,
    });
  });

  it("fails closed for ambiguous delimiters, unsafe headers, malformed rows, or oversized input", () => {
    expect(() => inspectGoldcarCsvSchema("first,second;third\nvalue,value,value", 2)).toThrow(
      "delimitador",
    );
    expect(() => inspectGoldcarCsvSchema("singleheader\nvalue", 2)).toThrow("delimitador");
    expect(() => inspectGoldcarCsvSchema("Número,Número\na,b", 2)).toThrow("duplicadas");
    expect(() => inspectGoldcarCsvSchema("alpha,beta\nonly-one", 2)).toThrow("no coincide");
    expect(() => inspectGoldcarCsvSchema('alpha,beta\n"open,value', 2)).toThrow("sin cierre");
    expect(() => inspectGoldcarCsvSchema('alpha,beta\n"first\nsecond",value', 2)).toThrow(
      "varias líneas",
    );
    expect(() => inspectGoldcarCsvSchema("alpha,beta\na,b\nc,d", 1)).toThrow("máximo de filas");
    expect(() => inspectGoldcarCsvSchema(`a${"x".repeat(513)},beta\nvalue,value`, 2)).toThrow(
      "tamaño de columna",
    );
  });

  it("requires an exact non-redirecting CSV response with a bounded declared size", () => {
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "text/csv; charset=utf-8",
          contentLength: "512",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).not.toThrow();
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 302,
          responseUrl: csvUrl.toString(),
          contentType: "text/csv",
          contentLength: "0",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("no admite redirecciones");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: "https://satelital.gpsgoldcar.com/objects/list/data?action=csv&next=1",
          contentType: "text/csv",
          contentLength: "0",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("read-only");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "text/html",
          contentLength: "0",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("contenido CSV");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "application/not-text/csv",
          contentLength: "0",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("contenido CSV");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "text/csv",
          contentLength: "1025",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("tamaño máximo");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "text/csv",
          contentLength: "unknown",
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("tamaño de exportación");
    expect(() =>
      assertGoldcarCsvSchemaResponse(
        {
          status: 200,
          responseUrl: csvUrl.toString(),
          contentType: "text/csv",
          contentLength: undefined,
        },
        csvUrl,
        baseUrl,
        1_024,
      ),
    ).toThrow("no declaró un tamaño");
  });

  it("orchestrates one exact CSV GET with redirects disabled and no dynamic request URL", async () => {
    const requestCalls: Array<{
      readonly url: string;
      readonly options: { readonly maxRedirects?: number };
    }> = [];
    const page = {
      setDefaultTimeout: () => undefined,
      setDefaultNavigationTimeout: () => undefined,
    } as unknown as Page;
    const context = {
      route: async () => undefined,
      newPage: async () => page,
      request: {
        get: async (url: string, options: { readonly maxRedirects?: number }) => {
          requestCalls.push({ url, options });
          return {
            status: () => 200,
            url: () => csvUrl.toString(),
            headers: () => ({ "content-type": "text/csv", "content-length": "100" }),
            body: async () => new TextEncoder().encode("Asset,State\nvalue,value"),
          };
        },
      },
    };
    const browser = {
      newContext: async () => context,
      close: async () => undefined,
    } as unknown as Browser;
    const config: GoldcarCsvSchemaInspectionConfig = {
      baseUrl,
      email: "test@example.test",
      password: "test-password",
      timeZoneOffset: "-05:00",
      maxAssets: 2,
      timeoutMs: 5_000,
      maxResponseBytes: 1_024,
      headless: true,
    };

    const summary = await new PlaywrightGoldcarCsvSchemaInspector(config, {
      launchBrowser: async () => browser,
      login: async () => undefined,
    }).inspect();

    expect(summary).toEqual({ headers: ["asset", "state"], rowCount: 1 });
    expect(requestCalls).toHaveLength(1);
    expect(requestCalls).toEqual([
      {
        url: csvUrl.toString(),
        options: expect.objectContaining({ maxRedirects: 0 }),
      },
    ]);
  });

  it("serializes failures as a canonical code and phase without upstream details", () => {
    const failure = classifyGoldcarCsvSchemaInspectionFailure(
      "FETCH_CSV",
      new GpsProviderError(
        "RATE_LIMITED",
        "X3N-719 -13.2,-72.3 https://satelital.gpsgoldcar.com/objects/list/data?action=csv",
      ),
    );
    const output = toGoldcarCsvSchemaInspectionFailureOutput(failure);
    const serialized = JSON.stringify(output);

    expect(output).toEqual({ status: "failed", code: "RATE_LIMITED", phase: "FETCH_CSV" });
    expect(serialized).not.toContain("X3N-719");
    expect(serialized).not.toContain("-13.2");
    expect(serialized).not.toContain("satelital");
  });
});
