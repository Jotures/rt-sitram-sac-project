import type { CommonPowerSyncDatabase, PowerSyncBackendConnector } from "@powersync/web";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase";
import { mapProductUpload, type ProductUploadMutation } from "./upload";
import { classifyUploadFailure, recordUploadDeadLetter } from "./upload-recovery";

interface RpcError {
  readonly code?: string;
  readonly message: string;
  readonly status?: number;
}

interface ProductRpcClient {
  rpc(
    functionName: ProductUploadMutation["rpc"],
    args: ProductUploadMutation["args"],
  ): PromiseLike<{ readonly error: RpcError | null }>;
}

async function applyMutation(
  client: SupabaseClient<Database>,
  mutation: ProductUploadMutation,
): Promise<void> {
  // The upload mapper correlates an allowlisted RPC name with its payload at
  // runtime; this narrow boundary preserves that union before calling Supabase.
  const rpcClient = client as unknown as ProductRpcClient;
  const { error } = await rpcClient.rpc(mutation.rpc, mutation.args);

  if (error !== null) {
    throw new RemoteProductUploadError(mutation.table, error);
  }
}

class RemoteProductUploadError extends Error {
  readonly code: string | null;
  readonly status: number | null;

  constructor(table: ProductUploadMutation["table"], error: RpcError) {
    super(`PowerSync upload ${table} failed: ${error.message}`);
    this.name = "RemoteProductUploadError";
    this.code = error.code ?? null;
    this.status = error.status ?? null;
  }
}

export class SupabasePowerSyncConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly endpoint: string,
  ) {}

  async fetchCredentials() {
    const { data, error } = await this.client.auth.getSession();

    if (error !== null) {
      throw new Error(`No se pudieron obtener credenciales de PowerSync: ${error.message}`);
    }

    if (data.session === null) {
      return null;
    }

    return {
      endpoint: this.endpoint,
      token: data.session.access_token,
      ...(data.session.expires_at === undefined
        ? {}
        : { expiresAt: new Date(data.session.expires_at * 1000) }),
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const batch = await database.getCrudBatch(100);

    if (batch === null) {
      return;
    }

    const { data, error } = await this.client.auth.getUser();

    if (error !== null || data.user === null) {
      throw new Error(
        `PowerSync upload requiere una sesión Supabase válida${error === null ? "." : `: ${error.message}`}`,
      );
    }

    for (const entry of batch.crud) {
      try {
        await applyMutation(this.client, mapProductUpload(entry));
      } catch (cause: unknown) {
        const failure = classifyUploadFailure(cause);
        if (failure.kind === "retryable") {
          throw cause;
        }

        // CrudBatch has only whole-batch completion. Persist the exact terminal
        // entry first, then continue with later entries so one bad mutation can
        // never block the global queue forever.
        await recordUploadDeadLetter(database, entry, failure);
      }
    }

    await batch.complete();
  }
}
