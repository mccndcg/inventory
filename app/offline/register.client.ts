import { registerSW } from "virtual:pwa-register";
import { installOfflineRuntime } from "./runtime";

export function registerOfflineApplication(): void {
  installOfflineRuntime(registerSW);
}
