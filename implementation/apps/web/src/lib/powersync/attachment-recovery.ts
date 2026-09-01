import type { AttachmentBlobSource } from "./attachment-worker";

export type AttachmentRecoveryAction =
  | "retry"
  | "discard_requested"
  | "discard_completed"
  | "discard_failed";

export interface FailedAttachmentRow {
  readonly id: string;
  readonly entity_type: "fuel_entry" | "expense" | "incident";
  readonly entity_id: string;
  readonly local_uri: string;
  readonly original_name: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly attempts: number;
  readonly last_error: string | null;
  readonly status: "failed" | "discarding";
  readonly updated_at: string;
}

interface AttachmentRecoveryTransaction {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
}

interface AttachmentRecoveryDatabase {
  execute(sql: string, parameters?: unknown[]): Promise<unknown>;
  getAll<T>(sql: string, parameters?: unknown[]): Promise<T[]>;
  writeTransaction<T>(
    callback: (transaction: AttachmentRecoveryTransaction) => Promise<T>,
  ): Promise<T>;
}

function requireSingleRow(result: unknown): void {
  if (
    typeof result !== "object" ||
    result === null ||
    !("rowsAffected" in result) ||
    result.rowsAffected !== 1
  ) {
    throw new Error("El estado de la evidencia cambió; actualiza la pantalla antes de continuar.");
  }
}

function requireConfirmation(confirmed: boolean, action: "retry" | "discard"): void {
  if (!confirmed) {
    throw new Error(
      action === "retry"
        ? "Confirma el reintento de la evidencia antes de continuar."
        : "Confirma el descarte definitivo de la evidencia local antes de continuar.",
    );
  }
}

async function loadFailedAttachment(
  database: Pick<AttachmentRecoveryDatabase, "getAll">,
  id: string,
  allowDiscarding: boolean,
): Promise<FailedAttachmentRow> {
  const rows = await database.getAll<FailedAttachmentRow>(
    `SELECT id, entity_type, entity_id, local_uri, original_name, mime_type,
      size_bytes, attempts, last_error, status, updated_at
     FROM attachment_queue
     WHERE id = ? AND (
       (status = 'failed' AND attempts >= 5)
       OR (? = 1 AND status = 'discarding')
     )
     LIMIT 1`,
    [id, allowDiscarding ? 1 : 0],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("La evidencia ya no requiere recuperación manual.");
  }
  return row;
}

async function appendRecoveryEvent(
  transaction: AttachmentRecoveryTransaction,
  input: {
    readonly row: FailedAttachmentRow;
    readonly action: AttachmentRecoveryAction;
    readonly reason: string;
    readonly createdAt: string;
  },
): Promise<void> {
  await transaction.execute(
    `INSERT INTO attachment_recovery_events (
      id, attachment_queue_id, action, previous_attempts, previous_error, reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.row.id,
      input.action,
      input.row.attempts,
      input.row.last_error,
      input.reason,
      input.createdAt,
    ],
  );
}

export async function retryFailedAttachment(
  database: AttachmentRecoveryDatabase,
  id: string,
  confirmed: boolean,
  now = new Date(),
): Promise<void> {
  requireConfirmation(confirmed, "retry");
  const row = await loadFailedAttachment(database, id, false);
  const createdAt = now.toISOString();

  await database.writeTransaction(async (transaction) => {
    await appendRecoveryEvent(transaction, {
      row,
      action: "retry",
      reason: "Reintento manual confirmado por el usuario.",
      createdAt,
    });
    const result = await transaction.execute(
      `UPDATE attachment_queue
       SET status = 'pending', attempts = 0, last_error = NULL, updated_at = ?
       WHERE id = ? AND status = 'failed' AND attempts >= 5`,
      [createdAt, id],
    );
    requireSingleRow(result);
  });
}

function discardReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 3) {
    throw new Error("Indica brevemente por qué descartas la evidencia local.");
  }
  if (reason.length > 500) {
    throw new Error("El motivo de descarte es demasiado largo.");
  }
  return reason;
}

export async function discardFailedAttachment(
  database: AttachmentRecoveryDatabase,
  blobs: Required<Pick<AttachmentBlobSource, "remove">>,
  id: string,
  confirmed: boolean,
  reasonInput: string,
  now = new Date(),
): Promise<void> {
  requireConfirmation(confirmed, "discard");
  const reason = discardReason(reasonInput);
  const row = await loadFailedAttachment(database, id, true);
  const createdAt = now.toISOString();

  if (row.status === "failed") {
    await database.writeTransaction(async (transaction) => {
      await appendRecoveryEvent(transaction, {
        row,
        action: "discard_requested",
        reason,
        createdAt,
      });
      const result = await transaction.execute(
        `UPDATE attachment_queue SET status = 'discarding', updated_at = ?
         WHERE id = ? AND status = 'failed' AND attempts >= 5`,
        [createdAt, id],
      );
      requireSingleRow(result);
    });
  }

  try {
    await blobs.remove(row.local_uri);
  } catch (cause: unknown) {
    const message =
      cause instanceof Error ? cause.message : "No se pudo eliminar la evidencia local.";
    try {
      await database.writeTransaction(async (transaction) => {
        await appendRecoveryEvent(transaction, {
          row,
          action: "discard_failed",
          reason: message.slice(0, 500),
          createdAt,
        });
        const result = await transaction.execute(
          `UPDATE attachment_queue SET status = 'failed', last_error = ?, updated_at = ?
           WHERE id = ? AND status = 'discarding'`,
          [`No se pudo descartar: ${message}`.slice(0, 500), createdAt, id],
        );
        requireSingleRow(result);
      });
    } catch {
      // The queue row remains in the non-uploadable `discarding` state, so
      // logout stays blocked and the user can safely finish the operation later.
    }
    throw new Error(`No se pudo descartar la evidencia local: ${message}`);
  }

  await database.writeTransaction(async (transaction) => {
    await appendRecoveryEvent(transaction, {
      row,
      action: "discard_completed",
      reason,
      createdAt,
    });
    const result = await transaction.execute(
      `UPDATE attachment_queue
       SET status = 'discarded', last_error = NULL, updated_at = ?
       WHERE id = ? AND status = 'discarding'`,
      [createdAt, id],
    );
    requireSingleRow(result);
  });
}
