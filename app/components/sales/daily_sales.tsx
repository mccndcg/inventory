import { Link } from "@remix-run/react";
import { Button } from "../ui/button";
import { Pencil, Plus, Trash } from "lucide-react";

interface Props {
  sales_arr: DexieSales[];
  setIndex: (val: DexieSales) => void;
  deleteIndex: (val: DexieSales) => void;
  addItem: () => void;
}
export default function DailySales({
  sales_arr,
  setIndex,
  deleteIndex,
  addItem,
}: Props) {
  return (
    <div className="grid grid-cols-[1fr_80px_100px_40px]  w-full">
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
                      onClick={() => setIndex(sale)}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteIndex(sale)}><Trash /></Button>
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
          onClick={() => addItem()}
        >
          Add <Plus />
        </Button>
      </div>
    </div>
  );
}
