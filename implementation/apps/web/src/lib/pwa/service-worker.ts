export type PwaShellStatus = "READY" | "NOT_READY";

interface ServiceWorkerRegistrationEligibility {
  isProduction: boolean;
  isServiceWorkerSupported: boolean;
}

export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export function shouldRegisterServiceWorker({
  isProduction,
  isServiceWorkerSupported: serviceWorkerSupported,
}: ServiceWorkerRegistrationEligibility): boolean {
  return isProduction && serviceWorkerSupported;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (
    !shouldRegisterServiceWorker({
      isProduction: import.meta.env.PROD,
      isServiceWorkerSupported: isServiceWorkerSupported(),
    })
  ) {
    return Promise.resolve(undefined);
  }

  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}
