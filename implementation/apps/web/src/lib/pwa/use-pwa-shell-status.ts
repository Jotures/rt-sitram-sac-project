import { useEffect, useState } from "react";
import {
  isServiceWorkerSupported,
  shouldRegisterServiceWorker,
  type PwaShellStatus,
} from "./service-worker";

export function usePwaShellStatus(): PwaShellStatus {
  const [status, setStatus] = useState<PwaShellStatus>("NOT_READY");

  useEffect(() => {
    if (
      !shouldRegisterServiceWorker({
        isProduction: import.meta.env.PROD,
        isServiceWorkerSupported: isServiceWorkerSupported(),
      })
    ) {
      return;
    }

    let isActive = true;

    void navigator.serviceWorker.ready
      .then(() => {
        if (isActive) {
          setStatus("READY");
        }
      })
      .catch(() => {
        if (isActive) {
          setStatus("NOT_READY");
        }
      });

    return (): void => {
      isActive = false;
    };
  }, []);

  return status;
}
