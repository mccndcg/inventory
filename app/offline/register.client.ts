import {
  installOfflineRuntime,
  type RegisterServiceWorker,
} from "./runtime";

const registerSW: RegisterServiceWorker = (callbacks) => {
  let registration: ServiceWorkerRegistration | undefined;
  let reloadOnActivation = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadOnActivation) window.location.reload();
  });

  void navigator.serviceWorker
    .register("/sw.js")
    .then((nextRegistration) => {
      registration = nextRegistration;
      callbacks.onRegisteredSW("/sw.js", registration);

      if (registration.waiting) callbacks.onNeedRefresh();
      registration.addEventListener("updatefound", () => {
        const candidate = registration?.installing;
        candidate?.addEventListener("statechange", () => {
          if (candidate.state !== "installed") return;
          if (navigator.serviceWorker.controller) callbacks.onNeedRefresh();
          else callbacks.onOfflineReady();
        });
      });

      return navigator.serviceWorker.ready;
    })
    .then(() => callbacks.onOfflineReady())
    .catch(callbacks.onRegisterError);

  return async (reloadPage = false) => {
    const waiting = registration?.waiting;
    if (!waiting) {
      await registration?.update();
      return;
    }
    reloadOnActivation = reloadPage;
    waiting.postMessage({ type: "SKIP_WAITING" });
  };
};

export function registerOfflineApplication(): void {
  installOfflineRuntime(registerSW);
}
