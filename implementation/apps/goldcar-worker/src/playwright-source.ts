import {
  GpsProviderError,
  parseGoldcarVehicleCsv,
  type GoldcarPortalSnapshotSource,
  type GoldcarPortalVehicleSnapshot,
} from "@rt-sitram/integrations";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright-core";
import type { GoldcarWorkerConfig } from "./config";
import { assertGoldcarCsvExportUrl, installGoldcarReadOnlyRouting } from "./read-policy";

export class PlaywrightGoldcarPortalSource implements GoldcarPortalSnapshotSource {
  readonly #config: GoldcarWorkerConfig;

  constructor(config: GoldcarWorkerConfig) {
    this.#config = config;
  }

  async loadVehicleSnapshots(): Promise<readonly GoldcarPortalVehicleSnapshot[]> {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch(createLaunchOptions(this.#config));
      const context = await browser.newContext({
        acceptDownloads: false,
        serviceWorkers: "block",
      });
      await installGoldcarReadOnlyRouting(context, this.#config.baseUrl);
      const page = await context.newPage();
      page.setDefaultTimeout(this.#config.timeoutMs);
      page.setDefaultNavigationTimeout(this.#config.timeoutMs);

      await loginGoldcarPortal(page, this.#config);
      const exportUrl = new URL("/objects/list/data?action=csv", this.#config.baseUrl);
      assertGoldcarCsvExportUrl(exportUrl, this.#config.baseUrl);
      const response = await context.request.get(exportUrl.toString(), {
        failOnStatusCode: false,
        headers: { Accept: "text/csv,application/csv,text/plain;q=0.9,*/*;q=0.1" },
        timeout: this.#config.timeoutMs,
      });
      assertReadResponse(response.status());
      assertGoldcarCsvExportUrl(new URL(response.url()), this.#config.baseUrl);
      const contentType = response.headers()["content-type"]?.toLowerCase() ?? "";
      if (contentType.includes("text/html")) {
        throw new GpsProviderError(
          "UNAUTHORIZED",
          "Goldcar devolvió una página HTML en lugar de la exportación autorizada.",
        );
      }
      const body = await response.body();
      if (body.byteLength > this.#config.maxResponseBytes) {
        throw new GpsProviderError(
          "MALFORMED_RESPONSE",
          "La exportación Goldcar supera el tamaño máximo autorizado.",
        );
      }

      return parseGoldcarVehicleCsv(new TextDecoder().decode(body), {
        timeZoneOffset: this.#config.timeZoneOffset,
        maxRows: this.#config.maxAssets,
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof GpsProviderError) throw error;
      throw new GpsProviderError(
        "UNAVAILABLE",
        "No fue posible completar la lectura segura del portal Goldcar.",
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
}

function createLaunchOptions(config: GoldcarWorkerConfig): LaunchOptions {
  return {
    headless: config.headless,
    ...(config.browserChannel ? { channel: config.browserChannel } : {}),
    ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}),
  };
}

export async function loginGoldcarPortal(
  page: Page,
  config: GoldcarWorkerConfig,
  timeoutMs?: number,
): Promise<void> {
  const loginUrl = new URL("/authentication/create", config.baseUrl);
  await page.goto(loginUrl.toString(), {
    waitUntil: "domcontentloaded",
    ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
  });
  if (new URL(page.url()).pathname.startsWith("/objects")) return;

  const emailInput = page
    .locator('input[type="email"], input[name="email"], input[name="username"]')
    .first();
  const passwordInput = page.locator('input[type="password"]').first();
  if ((await emailInput.count()) === 0 || (await passwordInput.count()) === 0) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "El formulario de acceso Goldcar cambió y no se reconocen sus campos.",
    );
  }

  await emailInput.fill(config.email);
  await passwordInput.fill(config.password);
  const namedSubmit = page
    .getByRole("button", { name: /ingresar|iniciar sesión|log in/iu })
    .first();
  const submit =
    (await namedSubmit.count()) > 0
      ? namedSubmit
      : page.locator('button[type="submit"], input[type="submit"]').first();
  if ((await submit.count()) === 0) {
    throw new GpsProviderError(
      "MALFORMED_RESPONSE",
      "El formulario de acceso Goldcar no contiene un botón reconocido.",
    );
  }

  await Promise.all([
    page.waitForURL(
      (url) => url.pathname.startsWith("/objects"),
      timeoutMs === undefined ? undefined : { timeout: timeoutMs },
    ),
    submit.click(timeoutMs === undefined ? undefined : { timeout: timeoutMs }),
  ]).catch(() => {
    throw new GpsProviderError(
      "UNAUTHORIZED",
      "Goldcar rechazó el acceso o no completó la redirección esperada.",
    );
  });
}

function assertReadResponse(status: number): void {
  if (status === 401 || status === 403) {
    throw new GpsProviderError("UNAUTHORIZED", "Goldcar rechazó la exportación autorizada.");
  }
  if (status === 429) {
    throw new GpsProviderError("RATE_LIMITED", "Goldcar limitó temporalmente la lectura.");
  }
  if (status < 200 || status >= 300) {
    throw new GpsProviderError(
      "REMOTE_ERROR",
      `Goldcar respondió con estado HTTP ${status} al solicitar la exportación.`,
    );
  }
}
