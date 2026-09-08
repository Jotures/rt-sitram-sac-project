import { getSupabaseClient } from "../../lib/supabase";
import type { CycleReport } from "./cycle-report";
export interface ExportTarget {
  readonly type: "trip" | "cycle" | "cycle_settlement" | "settlement";
  readonly id: string;
}
export async function auditEntityExport(
  target: ExportTarget,
  format: "pdf" | "xlsx",
  report: CycleReport,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Conéctate para registrar la descarga.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(report)),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const rpc = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ error: { message: string } | null }>;
  };
  const result = await rpc.rpc("record_entity_export", {
    p_entity_type: target.type,
    p_entity_id: target.id,
    p_format: format,
    p_generated_at: report.generatedAt,
    p_digest: hash,
  });
  if (result.error) throw new Error(`No se pudo registrar la descarga: ${result.error.message}`);
}
