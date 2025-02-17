import { format } from "date-fns";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { get_good_sales } from "~/data/dexie_good_sales";

interface Props {
  id: string;
}

export function SidebarSales({ id }: Props) {
  const [itemSales, setItemSales] = useState<
    ItemSaleIndividual[] | undefined
  >();
  useEffect(() => {
    get_good_sales(id).then((val) => {
      console.log(val)
      setItemSales(val);
    });
  }, [id]);
  return (
    <>
      {itemSales && itemSales.length > 0 ? (
        <div className="grid grid-cols-[1fr_80px_1fr]  w-full border rounded pb-2 bg-background">
          <div className="text-primary/80 bg-primary-foreground p-2 border-b border-r-2">
            Date
          </div>
          <div className="text-primary/60 p-2 border-b border-r-2">Qty*Prc</div>
          <div className="text-primary/60 p-2 text-right mr-2 border-b">
            Total
          </div>
          {itemSales.map((item) => (
            <div key={item.id} className="contents">
              <div className="bg-primary-foreground/20 border-b-2 border-dashed py-2 border-r-2">
                {format(item.date, "MM/dd/yy")}
              </div>
              <div className="flex space-x-1.5 ml-2 border-b-2 border-dashed py-2 border-r-2">
                <div>{item.quantity}</div>
                <span className="text-primary/40">x</span>
                <div>{item.sold_price}</div>
              </div>
              <div className="text-right border-b-2 border-dashed py-2 bg-muted-foreground/10 pr-2">
                <span className="text-primary/40"></span>{" "}
                {item.quantity * item.sold_price}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="italic flex gap-2">
          <TriangleAlertIcon />
          No recorded sales yet.
        </div>
      )}
    </>
  );
}
