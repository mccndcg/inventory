import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ReactNode, useState } from "react";
import { useAtom } from "jotai";
import { InputCategory } from "./InputCategory";
import { NumberKeyboard } from "./NumberKeyboard";
import { numberDialogAtom } from "../goods/goods_atoms";

export function NumberInput({
  defaultInputs,
  onAccept,
}: {
  defaultInputs: NumberInputProps;
  onAccept: (val: number, val1: number, val2: number) => void;
}) {
  const { defaultPrice, defaultQuantity, productName } = defaultInputs;
  const defaultTotal = defaultPrice * defaultQuantity;
  const [price, setPrice] = useState(defaultPrice);
  const [qty, setQty] = useState(defaultQuantity);
  const [total, setTotal] = useState(defaultTotal);
  const [activeInput, setActiveInput] = useState("price");
  const inputDispatch =
    activeInput == "price"
      ? setPrice
      : activeInput == "quantity"
      ? setQty
      : setTotal;
  const inputValue =
    activeInput == "price" ? price : activeInput == "quantity" ? qty : total;
  function setNumber(new_number: number) {
    switch (activeInput) {
      case "price":
        setTotal(new_number * qty);
        break;
      case "quantity":
        setTotal(price * new_number);
        break;
    }
  }
  function resetButton(new_val: number) {
    function removeFirstDigit(num: number) {
      const numStr = num.toString();
      if (numStr.length === 1) {
        return 0;
      }
      return Math.floor(num / 10);
    }
    switch (activeInput) {
      case "price":
        {
          setTotal(new_val * qty);
        }
        break;
      case "quantity":
        {
          setTotal(price * new_val);
        }
        break;
      case "total":
        {
          setTotal(removeFirstDigit(total));
          setPrice(-1);
        }
        break;
    }
  }
  return (
    <div className="grid place-items-center">
      <div className="border-b text-2xl border-black">{productName}</div>
      <div className="flex m-4 gap-2 items-center flex-wrap justify-center">
        <div onClick={() => setActiveInput("price")}>
          <InputCategory
            onClickLabel={() => {
              setPrice(0);
              setTotal(0);
            }}
            number={price}
            isActive={activeInput == "price"}
            label="Price"
          />
        </div>
        <div className="mt-4">x</div>
        <div onClick={() => setActiveInput("quantity")}>
          <InputCategory
            onClickLabel={() => {
              setQty(0);
              setTotal(0);
            }}
            number={qty}
            isActive={activeInput == "quantity"}
            label="Quantity"
          />
        </div>
        <div className="mt-4">=</div>
        <div onClick={() => setActiveInput("total")}>
          <InputCategory
            number={total}
            isActive={activeInput == "total"}
            label="Total"
          />
        </div>
      </div>
      <NumberKeyboard
        onKeyPress={setNumber}
        onBackPress={resetButton}
        onOkay={() => onAccept(price, qty, total)}
        inputDispatch={inputDispatch}
        inputValue={inputValue}
      />
    </div>
  );
}

interface Props {
  children: ReactNode;
}

export function ModalNumberInput({ children }: Props) {
  const [dialogOpen, setDialogOpen] = useAtom(numberDialogAtom);
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle></DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
