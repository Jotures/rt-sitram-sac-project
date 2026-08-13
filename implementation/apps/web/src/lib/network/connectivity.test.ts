import { describe, expect, it } from "vitest";
import {
  getNetworkStatus,
  subscribeToNetworkChanges,
  type NetworkEventTarget,
} from "./connectivity";

class TestNetworkTarget implements NetworkEventTarget {
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(eventName: "online" | "offline", listener: () => void): void {
    const eventListeners = this.listeners.get(eventName) ?? new Set<() => void>();
    eventListeners.add(listener);
    this.listeners.set(eventName, eventListeners);
  }

  removeEventListener(eventName: "online" | "offline", listener: () => void): void {
    this.listeners.get(eventName)?.delete(listener);
  }

  dispatch(eventName: "online" | "offline"): void {
    this.listeners.get(eventName)?.forEach((listener) => listener());
  }
}

describe("connectivity indicator", () => {
  it("maps navigator signals to visible states", () => {
    expect(getNetworkStatus(true)).toBe("ONLINE");
    expect(getNetworkStatus(false)).toBe("OFFLINE");
  });

  it("reacts to network changes and removes listeners", () => {
    const target = new TestNetworkTarget();
    const observedStatuses: string[] = [];
    let isOnline = true;
    const unsubscribe = subscribeToNetworkChanges(
      target,
      () => isOnline,
      (status) => observedStatuses.push(status),
    );

    isOnline = false;
    target.dispatch("offline");
    isOnline = true;
    target.dispatch("online");
    unsubscribe();
    isOnline = false;
    target.dispatch("offline");

    expect(observedStatuses).toEqual(["OFFLINE", "ONLINE"]);
  });
});
