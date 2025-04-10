import { FolderSync } from "lucide-react";
import { Button } from "~/components/ui/button";
import { syncGoods } from "~/data/dexie_goods";

export function SyncGoods() {
  return (
    <>
      <div>Sync</div>
      <Button variant="outline" onClick={syncGoods}>
        <FolderSync />
      </Button>
    </>
  );
}
