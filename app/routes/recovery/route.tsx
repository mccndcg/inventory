import type { MetaFunction } from "react-router";
import { RecoveryWorkspace } from "../../features/recovery/RecoveryWorkspace";

export const meta: MetaFunction = () => [
  { title: "Recovery | Local Inventory" },
];

export default function RecoveryRoute() {
  return <RecoveryWorkspace />;
}
