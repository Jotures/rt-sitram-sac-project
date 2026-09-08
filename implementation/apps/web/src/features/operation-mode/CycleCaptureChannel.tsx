import { useState } from "react";
import { usePowerSync } from "@powersync/react";
import { Button } from "../../components/primitives/Button";
import { getSupabaseClient } from "../../lib/supabase";
import { usePowerSyncRuntime } from "../../lib/powersync/PowerSyncProvider";
import { useUploadQueue } from "../../lib/powersync/use-upload-queue";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { getOrCreateDeviceId } from "../driver-ui/device-and-evidence";
import { MoreDetails } from "./OperationModeProvider";
export function CycleCaptureChannel({
  cycleId,
  canChange = true,
}: {
  readonly cycleId: string;
  readonly canChange?: boolean;
}): React.JSX.Element {
  const database = usePowerSync();
  const runtime = usePowerSyncRuntime();
  const queue = useUploadQueue(runtime.sqliteReady);
  const online = useNetworkStatus() === "ONLINE";
  const [message, setMessage] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function send(name: string, args: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!online || (await database.getUploadQueueStats()).count > 0)
        throw new Error("Espera a que se confirmen los registros de este dispositivo.");
      const pending = await database.getAll<{ count: number }>(
        "SELECT (SELECT COUNT(*) FROM attachment_queue WHERE status<>'uploaded') + (SELECT COUNT(*) FROM upload_dead_letters WHERE status='pending_review') AS count",
      );
      if ((pending[0]?.count ?? 0) > 0)
        throw new Error(
          "Hay archivos o registros que requieren atención. Resuélvelos en Sincronización.",
        );
      const client = getSupabaseClient() as unknown as {
        rpc(
          name: string,
          args: Record<string, unknown>,
        ): PromiseLike<{ error: { message: string } | null }>;
      };
      const result = await client.rpc(name, {
        ...args,
        p_cycle_id: cycleId,
        p_device_id: getOrCreateDeviceId(),
      });
      if (result.error) throw new Error(result.error.message);
      setMessage(
        name === "acknowledge_cycle_device"
          ? "Este dispositivo confirmó sus registros. Oficina puede cambiar el canal durante los próximos 5 minutos."
          : "Canal actualizado. Los rechazos anteriores siguen disponibles en Sincronización.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cambiar la captura.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MoreDetails label="Quién registra la actividad">
      <p>
        Antes de cambiar entre oficina y conductor, sincroniza y confirma el dispositivo que está
        registrando el recorrido.
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <Button
        variant="quiet"
        disabled={busy || !online || queue.pending > 0}
        onClick={() => void send("acknowledge_cycle_device", { p_queue_empty: true })}
      >
        Confirmar registros de este dispositivo
      </Button>
      {canChange && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void send("change_cycle_capture_channel", {
              p_channel: String(f.get("channel")),
              p_reason: String(f.get("reason")),
            });
          }}
        >
          <label className="admin-field">
            <span>Quién continuará registrando</span>
            <select name="channel">
              <option value="office">Oficina en este dispositivo</option>
              <option value="driver_app">Conductor desde su aplicación</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Motivo del cambio</span>
            <input name="reason" required minLength={3} />
          </label>
          <Button type="submit" disabled={busy || !online}>
            Cambiar canal
          </Button>
        </form>
      )}
    </MoreDetails>
  );
}
