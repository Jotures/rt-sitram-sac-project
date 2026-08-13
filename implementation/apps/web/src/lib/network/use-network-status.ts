import { useEffect, useState } from "react";
import { getNetworkStatus, subscribeToNetworkChanges, type NetworkStatus } from "./connectivity";

function readBrowserOnlineState(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(() =>
    getNetworkStatus(readBrowserOnlineState()),
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    return subscribeToNetworkChanges(window, readBrowserOnlineState, setStatus);
  }, []);

  return status;
}
