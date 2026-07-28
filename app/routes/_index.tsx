import type { MetaFunction } from "@remix-run/node";
import { LocalDashboard } from "../features/dashboard/LocalDashboard";

export const meta: MetaFunction = () => [
  { title: "Local Inventory" },
  {
    name: "description",
    content: "Offline cash sales and inventory management",
  },
];

export default function IndexRoute() {
  return <LocalDashboard />;
}
