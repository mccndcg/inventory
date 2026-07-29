import { Link } from "react-router";
import { CashWorkspace } from "../../features/cash/CashWorkspace";

export default function CashRoute() {
  return (
    <>
      <nav className="p-4">
        <Link className="underline" to="/">← Dashboard</Link>
      </nav>
      <CashWorkspace />
    </>
  );
}
