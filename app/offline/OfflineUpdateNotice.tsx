import { useSyncExternalStore } from "react";
import {
  activateOfflineUpdate,
  dismissOfflineUpdate,
  getOfflineRuntimeSnapshot,
  subscribeOfflineRuntime,
} from "./runtime";

const serverSnapshot = {
  online: true,
  serviceWorker: "unsupported" as const,
  updateAvailable: false,
};

export function OfflineUpdateNotice() {
  const state = useSyncExternalStore(
    subscribeOfflineRuntime,
    getOfflineRuntimeSnapshot,
    () => serverSnapshot,
  );

  if (!state.updateAvailable) return null;

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded border border-blue-700 bg-white p-4 shadow-lg"
      role="status"
    >
      <strong>A complete application update is ready.</strong>
      <p className="text-sm">
        Finish or save the current form, then apply it. The current version
        remains active until you choose to update.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          className="rounded bg-blue-700 px-3 py-2 text-white"
          type="button"
          onClick={() => void activateOfflineUpdate()}
        >
          Apply update and reload
        </button>
        <button
          className="rounded border px-3 py-2"
          type="button"
          onClick={dismissOfflineUpdate}
        >
          Later
        </button>
      </div>
    </aside>
  );
}
