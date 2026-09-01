import { describe, expect, it } from "vitest";
import type { Page } from "playwright-core";
import type { GoldcarWorkerConfig } from "./config";
import { loginGoldcarPortal } from "./playwright-source";

const config = {
  baseUrl: new URL("https://satelital.gpsgoldcar.com/"),
} as GoldcarWorkerConfig;

describe("Goldcar portal login", () => {
  it("uses the inspector-provided bounded timeout for the initial navigation", async () => {
    const calls: Array<{ readonly url: string; readonly timeout: number | undefined }> = [];
    const page = {
      goto: async (
        url: string,
        options: { readonly waitUntil: string; readonly timeout?: number },
      ) => {
        calls.push({ url, timeout: options.timeout });
        return null;
      },
      url: () => "https://satelital.gpsgoldcar.com/objects",
    } as unknown as Page;

    await expect(loginGoldcarPortal(page, config, 8_000)).resolves.toBeUndefined();
    expect(calls).toEqual([
      {
        url: "https://satelital.gpsgoldcar.com/authentication/create",
        timeout: 8_000,
      },
    ]);
  });
});
