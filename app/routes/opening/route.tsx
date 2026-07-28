import type { MetaFunction } from "@remix-run/node";
import { OpeningWorkspace } from "../../features/opening/OpeningWorkspace";

export const meta: MetaFunction = () => [{ title: "Opening | Local Inventory" }];

export default function OpeningRoute() {
  return <OpeningWorkspace />;
}
