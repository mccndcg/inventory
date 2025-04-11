import { Dispatch, SetStateAction } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/button";

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
