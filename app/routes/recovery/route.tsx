import type { MetaFunction } from "@remix-run/node";
import { RecoveryWorkspace } from "../../features/recovery/RecoveryWorkspace";

export const meta: MetaFunction = () => [
  { title: "Recovery | Local Inventory" },
];

export default function RecoveryRoute() {
  return <RecoveryWorkspace />;
}
