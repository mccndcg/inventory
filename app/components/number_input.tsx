import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Dispatch, ReactNode, SetStateAction, useState } from "react";
import { Button } from "./ui/button";
import { ArrowLeft } from "lucide-react";
import { useAtom } from "jotai";
import { numberDialogAtom } from "./goods/goods_atoms";

interface InputProps {
  number: number;
  onClick: (val: number) => void;
}

function InputButton({ number, onClick }: InputProps) {
  return (
    <div>
      <Button
        className="text-xl border-b-4 border-black/20 p-9"
        size="icon"
        variant="outline"
        onClick={() => onClick(number)}
      >
        {number}
      </Button>
    </div>
  );
}

interface InputCategoryProps {
  isActive: boolean;
  number: number;
  label: string;
  onClickLabel?: () => void;
}

export function InputCategory({
  isActive,
  number,
  label,
  onClickLabel,
}: InputCategoryProps) {
  return (
    <div className="flex flex-col">
      <div
        className={`${isActive ? "font-bold" : ""} text-center text-xl`}
        onClick={() => onClickLabel && onClickLabel()}
      >
        {label}
      </div>
      <div
        className={`${
          isActive ? "border-2 border-black/80" : "border-black/40"
        } p-3.5 border rounded-md text-2xl grid place-items-center`}
      >
        {/* <div>{number == -1 ? "-" : number}</div> */}
        <div>{number}</div>
      </div>
    </div>
  );
}

interface KeyboardProps {
  onKeyPress?: (val: number) => void;
  onBackPress?: (new_val: number) => void;
  onOkay: () => void;
  inputDispatch: Dispatch<SetStateAction<number>>;
  inputValue: number;
}

export function NumberKeyboard({
  onKeyPress,
  onBackPress,
  onOkay,
  inputDispatch,
  inputValue,
}: KeyboardProps) {
  function setNumber(val: number) {
    function getNewNumber() {
      return parseInt(`${inputValue.toString()}${val.toString()}`);
    }
    const new_val = getNewNumber();
    inputDispatch(new_val);
    onKeyPress && onKeyPress(new_val);
  }
  function resetButton() {
    function removeFirstDigit(num: number) {
      const numStr = Math.abs(num).toString();
      if (numStr.length === 1) {
        return 0;
      }
      return Math.floor(num / 10);
    }
    const new_val = removeFirstDigit(inputValue);
    inputDispatch(new_val);
    onBackPress && onBackPress(new_val);
  }
  return (
    <div className="grid grid-cols-3 gap-2 ">
      {[...Array(9)]
        .map((_, i) => i + 1)
        .map((ele) => (
          <InputButton number={ele} onClick={setNumber} key={ele} />
        ))}
      <Button
        className="[&_svg]:size-8 border-b-4 border-black/40 p-9"
        size="icon"
        variant="outline"
        onClick={resetButton}
      >
        <ArrowLeft />
      </Button>
      <InputButton number={0} onClick={() => setNumber(0)} />
      <Button
        className="border-b-4 border-black/40 p-9 text-xl"
        size="icon"
        onClick={onOkay}
      >
        OK
      </Button>
    </div>
  );
}
export function NumberInput({
  props,
  onAccept,
}: {
  props: NumberInputProps;
  onAccept: (val: number, val1: number, val2: number) => void;
}) {
  const { defaultPrice, defaultQuantity, productName } = props;
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
