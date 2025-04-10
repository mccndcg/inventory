import { useLiveQuery } from "dexie-react-hooks";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { dialogAtom, dialogIdAtom, ResponsiveDialog } from "~/components/modal_card";
import { editGood, getInventoryData } from "~/data/dexie";
import { updatePhysicalGood } from "~/data/dexie_goods";
import toast from "react-hot-toast";
import { TableDemo } from "~/components/inventory/table4";
import { PhysicalForm } from "~/components/physical/physical_container";
import RegisterGoods from "~/components/register_goods/register_goods";
import { registerGoodsSchema } from "~/components/register_goods/schema";
import { z } from "zod";
import { PhysicalProp } from "~/data/physical";

export function InventoryTable({
  filterString,
  catString,
}: {
  filterString: string;
  catString: string;
}) {
  const setOpen = useSetAtom(dialogAtom);
  const setType = useSetAtom(dialogIdAtom);
  const [selGood, setSelGood] = useState<undefined | DexieGood>();
  const [editMode, setEditMode] = useState<"good" | "physical">("good");
  // useEffect(() => {
  //   getInventoryData().then((val) => setTableData(val));
  // }, []);
  const tableData = useLiveQuery(getInventoryData);

  function openGoodEditor(good: DexieGood) {
    setSelGood(good);
    setEditMode("good");
    setType("edit_inventory")
    setOpen(true);
  }

  function openPhysicalEditor(good: DexieGood) {
    setSelGood(good);
    setEditMode("physical");
  }

  function editPhysicalFunc(val: PhysicalProp) {
    selGood !== undefined &&
      selGood.id &&
      updatePhysicalGood(selGood.id, val.physical)
        .then(() => {
          toast.success("Product Updated");
          // getInventoryData().then((val) => setTableData(val));
        })
        .catch(() => toast.error("Something happened."))
        .finally(() => setOpen(false));
  }

  function editGoodFunc(val: z.infer<typeof registerGoodsSchema>) {
    selGood !== undefined &&
      selGood.id &&
      editGood(selGood.id, selGood, val)
        .then(() => {
          toast.success("Product Updated");
          // getInventoryData().then((val) => setTableData(val));
        })
        .catch(() => toast.error("Something happened."))
        .finally(() => setOpen(false));
  }

  return (
    <>
      <ResponsiveDialog
        title="Modify Good"
        hide_trigger={true}
        id="edit_inventory"
      >
        {editMode == "good"
          ? selGood !== undefined && (
              <RegisterGoods def={selGood} onSubmitProp={editGoodFunc} />
            )
          : selGood !== undefined && (
              <PhysicalForm
                dexie_good={selGood}
                onSubmitProp={editPhysicalFunc}
              />
            )}
      </ResponsiveDialog>
      {tableData && (
        <TableDemo
          data={tableData}
          filter_string={filterString}
          setGood={openGoodEditor}
          catString={catString}
          setPhysical={openPhysicalEditor}
        />
      )}
    </>
  );
}
