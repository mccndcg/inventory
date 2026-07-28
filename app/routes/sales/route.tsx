import { Link } from "@remix-run/react";
import { SalesWorkspace } from "../../features/sales/SalesWorkspace";

export default function SalesRoute() {
  return (
    <>
      <nav className="p-4">
        <Link className="underline" to="/">← Dashboard</Link>
      </nav>
      <SalesWorkspace />
    </>
  );
}
