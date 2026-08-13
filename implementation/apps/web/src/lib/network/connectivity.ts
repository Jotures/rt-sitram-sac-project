export type NetworkStatus = "ONLINE" | "OFFLINE";

type NetworkEventName = "online" | "offline";

export interface NetworkEventTarget {
  addEventListener(eventName: NetworkEventName, listener: () => void): void;
  removeEventListener(eventName: NetworkEventName, listener: () => void): void;
}

export function getNetworkStatus(isOnline: boolean): NetworkStatus {
  return isOnline ? "ONLINE" : "OFFLINE";
}

export function subscribeToNetworkChanges(
  target: NetworkEventTarget,
  getIsOnline: () => boolean,
  onStatusChange: (status: NetworkStatus) => void,
): () => void {
  const reportStatus = (): void => {
    onStatusChange(getNetworkStatus(getIsOnline()));
  };

  target.addEventListener("online", reportStatus);
  target.addEventListener("offline", reportStatus);

  return (): void => {
    target.removeEventListener("online", reportStatus);
    target.removeEventListener("offline", reportStatus);
  };
}
