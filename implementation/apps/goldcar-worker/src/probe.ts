import { GoldcarPortalProvider } from "@rt-sitram/integrations";
import { loadGoldcarWorkerConfig, sanitizeGoldcarError } from "./config";
import { PlaywrightGoldcarPortalSource } from "./playwright-source";

let config: ReturnType<typeof loadGoldcarWorkerConfig> | null = null;

try {
  config = loadGoldcarWorkerConfig(process.env);
  const provider = new GoldcarPortalProvider(new PlaywrightGoldcarPortalSource(config));
  const assets = await provider.listAssets();
  const positions = (
    await Promise.all(assets.map((asset) => provider.getLatestPosition(asset.externalAssetId)))
  ).filter((position) => position !== null);
  const recordedTimes = positions.map((position) => position.recordedAt).sort();

  process.stdout.write(
    `${JSON.stringify({
      provider: provider.kind,
      assetCount: assets.length,
      positionCount: positions.length,
      oldestRecordedAt: recordedTimes.at(0) ?? null,
      newestRecordedAt: recordedTimes.at(-1) ?? null,
    })}\n`,
  );
} catch (error) {
  const safeMessage = config
    ? sanitizeGoldcarError(error, config)
    : error instanceof Error
      ? error.message
      : "Falla desconocida del worker Goldcar.";
  process.stderr.write(`Goldcar probe failed: ${safeMessage}\n`);
  process.exitCode = 1;
}
