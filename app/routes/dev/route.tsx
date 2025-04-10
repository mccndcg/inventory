import { Link } from "@remix-run/react";
import { ChevronLeft, LogIn, Save } from "lucide-react";
import {
  dialogAtom,
  dialogIdAtom,
  ResponsiveDialog,
} from "~/components/modal_card";
import { Button } from "~/components/ui/button";
import { getInventoryData } from "~/data/dexie";
import { LoginGUI } from "./LoginGUI";
import { useSetAtom } from "jotai";
import { SyncGoods } from "./SyncGoods";

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
  const setOpen = useSetAtom(dialogAtom);
  const setDialog = useSetAtom(dialogIdAtom);
  function openDialog() {
    setDialog("login_gui");
    setOpen(true);
  }
  return (
    <>
      <ResponsiveDialog title="Login" hide_trigger id="login_gui">
        <LoginGUI />
      </ResponsiveDialog>
      <div
        className="grid place-items-center w-dvw"
        style={{ height: "100dvh" }}
      >
        <Link to="/" className="fixed top-0 left-0 m-2">
          <Button size="icon">
            <ChevronLeft />
          </Button>
        </Link>
        <div className="grid grid-cols-2 items-center border p-2 rounded gap-2">
          <div>Download goods</div>
          <Button variant="outline" onClick={onDownloadData}>
            <Save />
          </Button>
          <div>Login</div>
          <Button variant="outline" onClick={openDialog}>
            <LogIn />
          </Button>
          <SyncGoods />
        </div>
      </div>
    </>
  );
}
