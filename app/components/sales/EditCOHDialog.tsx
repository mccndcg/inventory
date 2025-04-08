import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { ArrowDown } from "lucide-react";
import { Button } from "../ui/button";

interface Props {
  coh: number;
}

export function EditCOHDialog({ coh }: Props) {
  return (
    <div className="p-2 space-y-2">
      <Tabs defaultValue="a" className="dark">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="a">Set</TabsTrigger>
          <TabsTrigger value="minus">Minus</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input placeholder="Set Change" />
      <div className="flex flex-col items-center">
        <div>Php 150,000.00</div>
        <ArrowDown />
        <div>Php 120,000.00</div>
      </div>
      <Button>Save</Button>
    </div>
  );
}
