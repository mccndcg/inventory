import { Link } from "@remix-run/react";
import { ChevronLeft, Save } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getInventoryData } from "~/data/dexie";

export default function Dev() {
  async function onDownloadData() {
    const filename = "goods.json";
    const data = await getInventoryData();
    const jsonStr = JSON.stringify(data, null, 2); // pretty-print with 2-space indentation
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Clean up the object URL
  }
  return (
    <div className="grid place-items-center w-dvw" style={{ height: "100dvh" }}>
      <Link to="/" className="fixed top-0 left-0 m-2">
        <Button size="icon">
          <ChevronLeft />
        </Button>
      </Link>
      <div className="grid grid-cols-2 items-center border p-2 rounded gap-2">
        <div>Download goods</div>
        <Button variant="outline" onClick={onDownloadData}>
          Download <Save />
        </Button>
      </div>
    </div>
  );
}
