import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { Minus, Plus } from "lucide-react";
import { PhysicalProp } from "~/data/schemas";
import { Button } from "../ui/button";

interface Props {
  physical: PhysicalProp;
  desired_physical: PhysicalProp;
  quantity: number;
  index: number;
  onIncrease: (
    index: number,
    desired_index: number,
    is_increase: boolean,
    physical_quantity: number
  ) => void;
}

export function ExpirationSelector({
  desired_physical,
  physical,
  onIncrease,
  index,
  quantity,
}: Props) {
  const total_desired = desired_physical.reduce(
    (total, curr) => curr.quantity + total,
    0
  );
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="py-0">
          <div className="shrink-0"></div>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          {desired_physical.map((ele, subindex) => (
            <div
              className="border grid grid-cols-3 p-1 rounded m-0.5"
              key={subindex}
            >
              <div>
                {ele.expiration_date
                  ? format(ele.expiration_date, "MMM d, yyyy")
                  : "No expiration"}
              </div>
              <div>
                {ele.quantity}/{physical[subindex].quantity}
              </div>
              <div className="flex space-x-1 justify-center">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  type="button"
                  disabled={quantity == total_desired}
                  onClick={() => onIncrease(index, subindex, true, quantity)}
                >
                  <Plus />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  type="button"
                  disabled={ele.quantity == 0}
                  onClick={() => onIncrease(index, subindex, false, quantity)}
                >
                  <Minus />
                </Button>
              </div>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
