import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Input } from "../ui/input";
import { ArrowDown } from "lucide-react";
import { Button } from "../ui/button";
import { useAtomValue } from "jotai";
import { editCohAtom } from "./sales_atoms";
import { useContext, useMemo, useState } from "react";
import { add_modifier } from "~/data/dexie_coh";
import { MenuContext } from "~/lib/open_provider";

export function EditCOHDialog() {
  const context = useContext(MenuContext);
  if (!context) throw Error;
  const { setOpen } = context;
  const coh_container = useAtomValue(editCohAtom);
  const [tabVal, setTabVal] = useState<ModifierLit>("set");
  const [newVal, setNewVal] = useState<number>("");
  const coh = coh_container.value;
  const resultingVal = useMemo(() => {
    return tabVal == "set"
      ? newVal
      : tabVal == "plus"
      ? coh + newVal
      : coh - newVal;
  }, [tabVal, coh, newVal]);
  function updateCOHModifier() {
    add_modifier(coh_container.id, tabVal, coh);
    setOpen(false)
  }
  return (
    <div className="p-2 space-y-2">
      <div>{coh_container.id}</div>
      <Tabs
        defaultValue="set"
        className="dark"
        value={tabVal}
        onValueChange={(val) => setTabVal(val as ModifierLit)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="set">Set</TabsTrigger>
          <TabsTrigger value="minus">Minus</TabsTrigger>
          <TabsTrigger value="plus">Plus</TabsTrigger>
        </TabsList>
      </Tabs>
      <Input
        placeholder="Set Change"
        type="number"
        value={newVal}
        onChange={(e) => setNewVal(parseInt(e.target.value))}
      />
      <div className="flex flex-col items-center">
        <div>
          <span>Php {coh.toLocaleString("en-us")}</span>
          {tabVal == "minus" && (
            <span className="font-bold text-destructive"> - {newVal}</span>
          )}
          {tabVal == "plus" && (
            <span className="font-bold text-green-800"> + {newVal}</span>
          )}
        </div>
        <ArrowDown />
        <div>
          <span>
            Php{" "}
            {newVal == "" || isNaN(newVal)
              ? 0
              : resultingVal.toLocaleString("en-us")}
          </span>
        </div>
      </div>
      <Button
        disabled={newVal == "" || isNaN(newVal)}
        onClick={updateCOHModifier}
      >
        Save
      </Button>
    </div>
  );
}
