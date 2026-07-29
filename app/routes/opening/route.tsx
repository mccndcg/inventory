import type { MetaFunction } from "react-router";
import { OpeningWorkspace } from "../../features/opening/OpeningWorkspace";

export const meta: MetaFunction = () => [{ title: "Opening | Local Inventory" }];

export default function OpeningRoute() {
  return <OpeningWorkspace />;
}
