import { powerSyncConfiguration } from "./config";
import { SupabasePowerSyncConnector } from "./connector";
import { powerSyncDatabase } from "./database";
import { powerSyncIdentityStore } from "./identity-store";
import { getSupabaseClient } from "../supabase";
import { PowerSyncLifecycle } from "./lifecycle-controller";

const supabaseClient = getSupabaseClient();
const connector =
  supabaseClient !== null && powerSyncConfiguration.status === "CONFIGURED"
    ? new SupabasePowerSyncConnector(supabaseClient, powerSyncConfiguration.endpoint)
    : null;

export const powerSyncLifecycle = new PowerSyncLifecycle(
  powerSyncDatabase,
  connector,
  powerSyncIdentityStore,
  () => ensureLogoutWillNotDiscardLocalWork(powerSyncDatabase),
);

export function preparePowerSyncForLogout(): Promise<void> {
  return powerSyncLifecycle.transitionToSession(null);
}

interface LogoutSafetyDatabase {
  init(): Promise<void>;
  getUploadQueueStats(): Promise<{ readonly count: number }>;
  getAll<T>(sql: string): Promise<T[]>;
}

export async function ensureLogoutWillNotDiscardLocalWork(
  database: LogoutSafetyDatabase = powerSyncDatabase,
): Promise<void> {
  await database.init();
  const [uploads, localState] = await Promise.all([
    database.getUploadQueueStats(),
    database.getAll<{
      readonly attachment_count: number;
      readonly dead_letter_count: number;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM attachment_queue
          WHERE status IN ('pending', 'uploading', 'failed', 'discarding')) AS attachment_count,
        (SELECT COUNT(*) FROM upload_dead_letters WHERE status = 'pending_review') AS dead_letter_count`,
    ),
  ]);
  const attachmentCount = localState[0]?.attachment_count ?? 0;
  const deadLetterCount = localState[0]?.dead_letter_count ?? 0;
  if (uploads.count > 0 || attachmentCount > 0 || deadLetterCount > 0) {
    throw new Error(
      `Hay pendientes: ${uploads.count} registro(s), ${attachmentCount} evidencia(s) y ${deadLetterCount} error(es) por revisar. Sincroniza o resuelve cada elemento antes de cerrar sesión.`,
    );
  }
}
