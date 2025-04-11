
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