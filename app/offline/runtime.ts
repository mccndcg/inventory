export type ServiceWorkerState =
  | "unsupported"
  | "registering"
  | "ready"
  | "update-ready"
  | "error";

export interface OfflineRuntimeSnapshot {
  online: boolean;
  serviceWorker: ServiceWorkerState;
  updateAvailable: boolean;
  error?: string;
}

const listeners = new Set<() => void>();
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;
let snapshot: OfflineRuntimeSnapshot = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  serviceWorker:
    typeof navigator === "undefined" || !("serviceWorker" in navigator)
      ? "unsupported"
      : "registering",
  updateAvailable: false,
};

function publish(next: Partial<OfflineRuntimeSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function getOfflineRuntimeSnapshot(): OfflineRuntimeSnapshot {
  return snapshot;
}

export function subscribeOfflineRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

interface RegisterCallbacks {
  immediate: boolean;
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
  onRegisteredSW: (
    url: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
  onRegisterError: (error: unknown) => void;
}

export type RegisterServiceWorker = (
  callbacks: RegisterCallbacks,
) => (reloadPage?: boolean) => Promise<void>;

export function installOfflineRuntime(registerSW: RegisterServiceWorker): void {
  if (!("serviceWorker" in navigator)) {
    publish({ serviceWorker: "unsupported" });
    return;
  }

  window.addEventListener("online", () => publish({ online: true }));
  window.addEventListener("offline", () => publish({ online: false }));

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      publish({ serviceWorker: "update-ready", updateAvailable: true });
    },
    onOfflineReady() {
      publish({ serviceWorker: "ready" });
    },
    onRegisteredSW(_url, registration) {
      publish({
        serviceWorker:
          registration?.waiting ? "update-ready" : "ready",
        updateAvailable: Boolean(registration?.waiting),
      });
    },
    onRegisterError(error) {
      publish({
        serviceWorker: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });
}

export async function activateOfflineUpdate(): Promise<void> {
  if (!updateServiceWorker) return;
  await updateServiceWorker(true);
}

export function dismissOfflineUpdate(): void {
  publish({ updateAvailable: false });
}
