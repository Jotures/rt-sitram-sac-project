import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../lib/supabase";

interface RpcFailure {
  readonly message: string;
}

interface RpcResult {
  readonly data: unknown;
  readonly error: RpcFailure | null;
}

interface NarrowRpcClient {
  rpc(functionName: string, args: Readonly<Record<string, unknown>>): PromiseLike<RpcResult>;
}

export interface ProductCommandTransport {
  invoke(functionName: string, args: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export function createSupabaseCommandTransport(
  client: SupabaseClient<Database>,
): ProductCommandTransport {
  // Commands cross a dynamic feature boundary here. Generated Database types stay
  // authoritative at the client edge; every feature validates its concrete result.
  const rpcClient = client as unknown as NarrowRpcClient;

  return {
    async invoke(functionName, args): Promise<unknown> {
      const result = await rpcClient.rpc(functionName, args);
      if (result.error !== null) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  };
}

export function readRequiredRpcId(value: unknown, operation: string): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    value.id.trim() === ""
  ) {
    throw new Error(`La respuesta de ${operation} no contiene un identificador válido.`);
  }
  return value.id;
}
