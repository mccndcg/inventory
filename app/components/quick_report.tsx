import { Separator } from "./ui/separator";

export function QuickReport() {
  return (
    <div className="size-32 rounded flex border flex-col">
      <div className="grow flex center flex-col">
        <div className="text-center uppercase text-sm underline">Expiring</div>
        <div className="text-4xl font-bold grid place-items-center grow">
          <div>4</div>
        </div>
      </div>
      <Separator />
      <div className="grow flex center flex-col bg-primary-foreground">
        <div className="text-center uppercase text-sm underline">Running out</div>
        <div className="text-4xl font-bold grid place-items-center grow">
          <div>4</div>
        </div>
      </div>
    </div>
  );
}
