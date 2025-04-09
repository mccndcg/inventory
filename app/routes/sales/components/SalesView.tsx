import { useEffect, useMemo, useState } from "react";
import {
  formatDateToNumber,
  groupByDate,
  sortObjectByDate,
  stringDateToNumberDate,
} from "~/lib/utils";
import { SaleItemHeader } from "./SaleItemHeader";
import { ResponsiveDialog } from "~/components/modal_card";
import { GoodsOutForm } from "~/components/goods/goods_out";
import { useAtom, useAtomValue } from "jotai";
import {
  dialogTypeAtom,
  editGoodsPropAtom,
  isDescFilterAtom,
  isGoodsOutAtom,
  salesDateAtom,
} from "../sales_atoms";
import DailySales from "./SalesItemBody";
import { getSalesByDate } from "~/data/dexie_sales";
import { get_all_coh } from "~/data/dexie_coh";
import { Separator } from "~/components/ui/separator";
import { EditCOHDialog } from "./EditCOHDialog";
import { useLiveQuery } from "dexie-react-hooks";

export function SalesView() {
  const dialogType = useAtomValue(dialogTypeAtom);
  const [salesDict, setSalesDict] = useState<SalesObject>({});
  const [editGoodsProp, setEditGoodsProp] = useAtom(editGoodsPropAtom);

  const date = useAtomValue(salesDateAtom);
  const isGoodsOut = useAtomValue(isGoodsOutAtom);
  const filter_direction = useAtomValue(isDescFilterAtom);
  const isGoodsIn = !isGoodsOut;
  function resetState() {
    setEditGoodsProp({
      id: undefined,
      date: undefined,
      products: undefined,
    });
    if (date.from == undefined) return;
    getSalesByDate(
      formatDateToNumber(date.from),
      isGoodsIn,
      date.to && formatDateToNumber(date.to)
    ).then((val) => {
      if (val) {
        setSalesDict(groupByDate(val));
      }
    });
  }

  useEffect(() => {
    if (date.from == undefined) return;
    getSalesByDate(
      formatDateToNumber(date.from),
      isGoodsIn,
      date.to && formatDateToNumber(date.to)
    ).then((val) => {
      if (val) {
        setSalesDict(groupByDate(val));
      }
    });
  }, [date, isGoodsIn]);

  const originalDexieCOH = useLiveQuery(get_all_coh);
  const dexieCOH = useMemo(() => {
    return (
      originalDexieCOH &&
      originalDexieCOH.reduce((prev, cur) => {
        prev[cur.date] = cur;
        return prev;
      }, {} as { [key: number]: DexieCOH })
    );
  }, [originalDexieCOH]);

  function process_dict() {
    return sortObjectByDate(salesDict, filter_direction);
  }
  return (
    <>
      <ResponsiveDialog
        id="sales_edit"
        title={dialogType == "sales" ? "Edit Sales" : "Edit COH"}
        hide_trigger
      >
        {dialogType == "sales" ? (
          <GoodsOutForm
            editObject={{
              ...editGoodsProp,
              resettter: resetState,
              oldId: editGoodsProp?.id,
            }}
            isGoodIn={isGoodsIn}
          />
        ) : (
          <EditCOHDialog />
        )}
      </ResponsiveDialog>
      <div className="p-4 flex flex-col space-y-4 w-full">
        {/* <Button onClick={updateTxSales}>update tx</Button> */}
        {salesDict &&
          dexieCOH &&
          Object.values(process_dict()).map((ele) => {
            const { date, sales_arr } = ele;
            return (
              <div key={date} className="border rounded shadow-md">
                <SaleItemHeader
                  {...{ date, sales_arr }}
                  dexieCOH={dexieCOH[stringDateToNumberDate(date)]}
                />
                <Separator />
                <DailySales sales_arr={sales_arr} onRefresh={resetState} />
              </div>
            );
          })}
      </div>
    </>
  );
}
