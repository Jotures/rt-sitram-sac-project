import { usePowerSync } from "@powersync/react";
import { useState } from "react";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { getOrCreateDeviceId } from "./device-and-evidence";

export function useDriverCapture() {
  const database = usePowerSync();
  const network = useNetworkStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const run = async (operation: (context: { sourceDeviceId: string }) => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await operation({ sourceDeviceId: getOrCreateDeviceId() });
      setSaved(
        network === "OFFLINE"
          ? "Quedó en cola y se enviará automáticamente al recuperar conexión."
          : "Quedó en cola local. PowerSync confirmará el envío al servidor.",
      );
      return true;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar el registro.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, database, error, run, saved };
}
