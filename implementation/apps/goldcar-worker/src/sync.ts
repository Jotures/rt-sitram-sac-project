import { GoldcarPortalProvider } from "@rt-sitram/integrations";
import { loadGoldcarManualSyncConfig, sanitizeGoldcarManualSyncError } from "./config";
import { runGoldcarManualSync } from "./manual-sync-service";
import { PlaywrightGoldcarPortalSource } from "./playwright-source";
import { SupabaseGpsSyncRepository } from "./supabase-gps-sync-repository";

let config: ReturnType<typeof loadGoldcarManualSyncConfig> | null = null;

try {
  config = loadGoldcarManualSyncConfig(process.env);
  const provider = new GoldcarPortalProvider(new PlaywrightGoldcarPortalSource(config));
  const summary = await runGoldcarManualSync({
    provider,
    repository: new SupabaseGpsSyncRepository({
      supabaseUrl: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    }),
    options: {
      companyId: config.companyId,
      operatorProfileId: config.operatorProfileId,
      leaseSeconds: config.leaseSeconds,
      maxDurationSeconds: config.maxDurationSeconds,
      persistenceMaxAttempts: config.persistenceMaxAttempts,
      persistenceRetryBaseMs: config.persistenceRetryBaseMs,
    },
  });
  process.stdout.write(`${JSON.stringify({ provider: provider.kind, ...summary })}\n`);
  if (summary.status !== "succeeded") process.exitCode = 1;
} catch (error) {
  const safeMessage = config
    ? sanitizeGoldcarManualSyncError(error, config)
    : "La configuración segura de sincronización Goldcar no está disponible.";
  process.stderr.write(`Goldcar sync failed: ${safeMessage}\n`);
  process.exitCode = 1;
}
