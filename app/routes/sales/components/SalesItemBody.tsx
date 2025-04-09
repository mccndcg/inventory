import { Link } from "@remix-run/react";
import { useSetAtom } from "jotai";
import { Pencil, Plus, Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { dialogTypeAtom, editGoodsPropAtom } from "../sales_atoms";
import { dialogAtom, dialogIdAtom } from "~/components/modal_card";
import { deleteSingleSales } from "~/data/dexie_sales";

interface Props {
  sales_arr: DexieSales[];
  onRefresh: () => void;
}
export default function DailySales({ sales_arr, onRefresh }: Props) {
  const setEditGoodsProp = useSetAtom(editGoodsPropAtom);
  const setDialogOpen = useSetAtom(dialogAtom);
  const setDialogId = useSetAtom(dialogIdAtom);
  const setDialogType = useSetAtom(dialogTypeAtom);

  function deleteSales(val: DexieSales) {
    val.id &&
      deleteSingleSales(val.id).then(() => {
        onRefresh();
      });
  }

  function onAddItem() {
    setEditGoodsProp({
      products: undefined,
      date: sales_arr[0].tx_date,
    });
    setDialogId("sales_edit");
    setDialogType("sales");
    setDialogOpen(true);
  }

  function editSales(val: DexieSales) {
    if (!val.id) return;
    setEditGoodsProp({
      products: val.items.map((ele) => {
        if (!ele.id) throw Error;
        return { ...ele, product: ele.name, prod_id: ele.id };
      }),
      date: val.tx_date,
      id: val.id,
    });
    setDialogId("sales_edit");
    setDialogType("sales");
    setDialogOpen(true);
  }

  return (
    <div className="grid grid-cols-[1fr_80px_100px_80px]  w-full">
      <div className="text-primary/80 bg-primary-foreground p-2 border-b">
        Item
      </div>
      <div className="text-primary/60 p-2 border-b">Qty * Prc</div>
      {/* <div className="text-primary/60 p-2">Sold Prc</div> */}
      <div className="text-primary/60 p-2 text-right mr-2 border-b">Total</div>
      <div className="text-primary/60 p-2 text-right mr-2 border-b"></div>

      {sales_arr.map((sale, superindex) => {
        return sale.items.map((item, index) => {
          return (
            <div key={index} className="contents">
              <Link to={`/inventory/${item.id}`}>
                <div className="bg-primary-foreground/20 pl-4 border-b-2 border-dashed py-2">
                  {item.name}
                </div>
              </Link>
              <div className="flex space-x-1.5 ml-2 border-b-2 border-dashed py-2">
                <div>{item.quantity}</div>
                <span className="text-primary/40">x</span>
                <div>{item.sold_price}</div>
              </div>
              <div className="text-right mr-4 border-b-2 border-dashed py-2">
                <span className="text-primary/40">Php</span>{" "}
                {item.quantity * item.sold_price}
              </div>
              <div
                className={`${
                  superindex % 2 == 0 ? "bg-foreground/5" : ""
                } grid place-items-center`}
              >
                {index == 0 && (
                  <div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => editSales(sale)}
                      className="border-r"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteSales(sale)}
                      className="bg-muted-foreground/20"
                    >
                      <Trash />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        });
      })}
      <div className="bg-primary-foreground p-2">
        <Button
          variant="outline"
          className="shadow-md"
          onClick={() => onAddItem()}
        >
          Add <Plus />
        </Button>
      </div>
    </div>
  );
}
