import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { GoodsOutProps } from "./types";
import { GoodsOutView } from "./GoodsOutView";
import { ItemSelector } from "../item_selector";

export function GoodsOutForm({ editObject }: GoodsOutProps) {
  const [itemSelectorMode, setItemSelectorMode] = useState(true);
  const childRef = useRef<{ onProductSelect: (val: DexieGood) => void }>(null);
  function selectItem(val: DexieGood) {
    if (!childRef.current) return;
    childRef.current.onProductSelect(val);
    setItemSelectorMode(true);
  }
  const itemButtonSelector = (
    <Button
      className="mt-6"
      type="button"
      onClick={() => {
        setItemSelectorMode(false);
      }}
    >
      Select Item <Plus />
    </Button>
  );
  return (
    <>
      {!itemSelectorMode ? (
        <div>
          <GoodsOutView
            ref={childRef}
            itemSelector={itemButtonSelector}
            editObject={editObject}
          />
        </div>
      ) : (
        <div>
          <ItemSelector
            onProductSelect={selectItem}
            onClick={() => setItemSelectorMode(true)}
          />
        </div>
      )}
    </>
  );
}
