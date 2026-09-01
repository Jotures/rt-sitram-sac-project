import { usePowerSync } from "@powersync/react";
import { useEffect, useState } from "react";

interface UploadQueueState {
  readonly pending: number;
  readonly error: Error | null;
}

export function useUploadQueue(sqliteReady: boolean): UploadQueueState {
  const database = usePowerSync();
  const [state, setState] = useState<UploadQueueState>({ pending: 0, error: null });

  useEffect(() => {
    if (!sqliteReady) {
      return;
    }

    let current = true;

    const refresh = async (): Promise<void> => {
      try {
        const stats = await database.getUploadQueueStats();

        if (current) {
          setState({ pending: stats.count, error: null });
        }
      } catch (error: unknown) {
        if (current) {
          setState({
            pending: 0,
            error:
              error instanceof Error ? error : new Error("No se pudo leer la cola de uploads."),
          });
        }
      }
    };

    void refresh();
    const interval = window.setInterval(() => void refresh(), 1000);

    return (): void => {
      current = false;
      window.clearInterval(interval);
    };
  }, [database, sqliteReady]);

  return state;
}
