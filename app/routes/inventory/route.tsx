import { Link } from "react-router";
import { InventoryWorkspace } from "../../features/inventory/InventoryWorkspace";

export default function InventoryRoute() {
  return (
    <>
      <nav className="p-4">
        <Link className="underline" to="/">← Dashboard</Link>
      </nav>
      <InventoryWorkspace />
    </>
  );
}
