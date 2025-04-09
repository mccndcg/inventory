import { SalesHeader } from "./components/SalesHeader";
import { SalesView } from "./components/SalesView";

export default function Sales() {
  return (
    <>
      <SalesHeader />
      <div className="grid place-items-center">
        <SalesView></SalesView>
      </div>
    </>
  );
}
