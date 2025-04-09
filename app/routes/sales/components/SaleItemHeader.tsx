import { useSetAtom } from "jotai";
import { Pencil } from "lucide-react";
import { dialogAtom } from "~/components/modal_card";
import { Button } from "~/components/ui/button";
import { formatDate } from "~/lib/utils";
import { dialogTypeAtom, editCohAtom } from "../sales_atoms";
import { useMemo } from "react";
import { delete_modifier } from "~/data/dexie_coh";

export function SaleItemHeader({
  date,
  sales_arr,
  dexieCOH,
}: {
  dexieCOH: DexieCOH;
  date: string;
  sales_arr: DexieSales[];
}) {
  const setDialogOpen = useSetAtom(dialogAtom);
  const setEditCoh = useSetAtom(editCohAtom);
  const setDialogType = useSetAtom(dialogTypeAtom);
  function editCOH(coh: number, id: string) {
    setEditCoh({
      value: coh,
      id,
      modifier: dexieCOH.modifier,
    });
    setDialogType("coh");
    setDialogOpen(true);
  }
  const modifier_component = useMemo(() => {
    if (!dexieCOH.modifier)
      return (
        <span className="text-green-700 font-bold">
          {dexieCOH.current_coh.toLocaleString("en-us")}
        </span>
      );
    switch (dexieCOH.modifier.type) {
      case "plus": {
        const new_Val = (
          dexieCOH.current_coh - dexieCOH.modifier.amount
        ).toLocaleString();
        return (
          <>
            <span className="text-green-700 font-bold">{new_Val}</span>
            <span className="text-green-800">
              + {dexieCOH.modifier.amount.toLocaleString("en-us")} =
            </span>
            <span className="text-green-800 font-bold">
              {dexieCOH.current_coh.toLocaleString("en-us")}
            </span>
          </>
        );
      }
      case "minus": {
        const new_Val = (
          dexieCOH.current_coh + dexieCOH.modifier.amount
        ).toLocaleString();
        return (
          <>
            <span className="text-green-700 font-bold">{new_Val}</span>
            <span className="text-destructive">
              - {dexieCOH.modifier.amount.toLocaleString("en-us")} =
            </span>
            <span className="text-green-800 font-bold">
              {dexieCOH.current_coh.toLocaleString("en-us")}
            </span>
          </>
        );
      }
      case "set":
        return (
          <>
            <span> Set to </span>
            <span className="text-green-800 font-bold">
              {dexieCOH.current_coh.toLocaleString("en-us")}
            </span>
          </>
        );
    }
  }, [dexieCOH]);
  return (
    <div
      className=" text-xl  ml-2 flex flex-col p-2"
      style={{
        // background: "rgb(255, 255, 255)",
        background:
          "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(235,235,235,1) 73%, rgba(201,231,237,1) 100%)",
      }}
    >
      <div className="grow italic font-bold text-center mb-2">
        {formatDate(date)}
      </div>
      <div className="space-x-2">
        <span className="italic">Sales: </span>
        <span className="text-foreground/60">Php</span>
        <span className="text-green-700 font-bold">
          {sales_arr
            .reduce(
              (sum, curr) =>
                sum +
                curr.items.reduce(
                  (inner_sum, inner_cur) =>
                    inner_sum + inner_cur.quantity * inner_cur.sold_price,
                  0
                ),
              0
            )
            .toLocaleString("en-us")}
        </span>
      </div>
      <div className="space-x-2 flex items-center">
        <span className="italic mr-3">COH: </span>
        <span className="text-foreground/60">Php</span>
        {modifier_component}
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            dexieCOH.id && editCOH(dexieCOH.current_coh, dexieCOH.id)
          }
        >
          <Pencil />
        </Button>
        {dexieCOH?.modifier && (
          <Button
            variant="outline"
            onClick={() => dexieCOH.id && delete_modifier(dexieCOH.id)}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
