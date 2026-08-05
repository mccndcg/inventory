import type { MetaFunction } from "react-router";
import { DevelopmentWorkspace } from "../../features/development/DevelopmentWorkspace";

export const meta: MetaFunction = () => [
  { title: "Development | Local Inventory" },
];

export default function DevelopmentRoute() {
  return <DevelopmentWorkspace />;
}
