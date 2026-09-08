import type { CommonPowerSyncDatabase } from "@powersync/web";

export const operationActivitySql = `
  SELECT o.id, o.company_id, o.kind, o.payload, o.status, o.dependency_id, o.created_at
  FROM operation_commands o
  UNION ALL
  SELECT j.id, j.company_id, j.kind, j.payload, j.status, j.dependency_id, j.created_at
  FROM operation_command_journal j
  WHERE NOT EXISTS (SELECT 1 FROM operation_commands o WHERE o.id=j.id)`;

/** Restore envelopes queued by clients predating the readable local journal.
 * Uses the public queue API and never completes or replaces queued operations.
 */
export async function restoreOperationJournal(database: CommonPowerSyncDatabase): Promise<void> {
  const batch = await database.getCrudBatch(10_000);
  if (batch === null) return;
  await database.writeTransaction(async (tx) => {
    for (const entry of batch.crud) {
      if (entry.table !== "operation_commands" || !entry.opData) continue;
      const d = entry.opData;
      await tx.execute(
        `INSERT OR IGNORE INTO operation_command_journal
        (id,company_id,actor_id,kind,payload,contract_version,dependency_id,source_device_id,status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          entry.id,
          d.company_id,
          d.actor_id,
          d.kind,
          d.payload,
          d.contract_version,
          d.dependency_id,
          d.source_device_id,
          d.status ?? "pending",
          d.created_at,
        ],
      );
    }
  });
}
