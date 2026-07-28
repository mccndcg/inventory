import { useAtom } from "jotai";
import { ArrowDown, ArrowUp, ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  isDescFilterAtom,
  isGoodsOutAtom,
  salesDateAtom,
} from "../sales_atoms";
import { DatePickerDemo } from "~/components/datepicker";
import { DateRange } from "react-day-picker";
import { Link } from "@remix-run/react";

const activeClass = "text-3xl font-bold tracking-tight cursor-pointer";
const defaultClass = "text-3xl text-primary/60 cursor-pointer";

export function SalesHeader() {
  const [isGoodsOut, setIsGoodsOut] = useAtom(isGoodsOutAtom);
  const [date, setDate] = useAtom<DateRange>(salesDateAtom);
  const [isDesc, setIsDesc] = useAtom(isDescFilterAtom);

  return (
    <div className="sticky top-0 z-10 p-2 bg-background flex flex-col space-y-4 shadow-md w-dvw">
      <div className="flex gap-2 flex-wrap">
        <Link to="/">
          <Button size="icon" variant="outline">
            <ChevronLeft />
          </Button>
        </Link>
        <Button variant="ghost" onClick={() => setIsGoodsOut(true)}>
          <h2 className={isGoodsOut ? activeClass : defaultClass}>Goods Out</h2>
        </Button>
        <div className="text-3xl">/</div>
        <Button variant="ghost" onClick={() => setIsGoodsOut(false)}>
          <h2 className={!isGoodsOut ? activeClass : defaultClass}>Goods In</h2>
        </Button>
      </div>
      <div className="p-2 border rounded flex space-x-4 flex-wrap">
        <DatePickerDemo date={date} setDate={setDate} />
        <div>
          <Button
            onClick={() => setIsDesc((e) => !e)}
            size="icon"
            variant="outline"
          >
            {isDesc ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </div>
        {/* <Button onClick={recompute_coh_from_sales}>recompute coh</Button> */}
      </div>
    </div>
  );
}
