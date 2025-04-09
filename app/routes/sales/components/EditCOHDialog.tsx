import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ArrowDown } from "lucide-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { add_modifier } from "~/data/dexie_coh";
import { editCohAtom } from "../sales_atoms";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { dialogAtom } from "~/components/modal_card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

export function EditCOHDialog() {
  const setOpen = useSetAtom(dialogAtom);
  const coh_container = useAtomValue(editCohAtom);
  const [tabVal, setTabVal] = useState<ModifierLit>(
    coh_container?.modifier?.type || "set"
  );
  const [newVal, setNewVal] = useState<number>(
    coh_container?.modifier?.amount || ""
  );
  const [notes, setNotes] = useState(coh_container?.modifier?.notes || "");

  const coh = useMemo(() => {
    if (!coh_container?.modifier) {
      return coh_container.value;
    } else {
      return (
        coh_container.value +
        coh_container.modifier.amount *
          (coh_container.modifier.type == "minus" ? 1 : -1)
      );
    }
  }, []);
  const resultingVal = useMemo(() => {
    return tabVal == "set"
      ? newVal
      : tabVal == "plus"
      ? coh + newVal
      : coh - newVal;
  }, [tabVal, coh, newVal]);
  function updateCOHModifier() {
    add_modifier(coh_container.id, tabVal, newVal, notes);
    setOpen(false);
  }
  return (
    <div className="p-2 space-y-2">
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
      <Label>Value to Modify</Label>
      <Input
        placeholder="Set Change"
        type="number"
        value={newVal}
        onChange={(e) => setNewVal(parseInt(e.target.value))}
      />
      {!isNaN(newVal) && newVal != "" && (
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
              Php {isNaN(newVal) ? 0 : resultingVal.toLocaleString("en-us")}
            </span>
          </div>
        </div>
      )}
      <Label>Notes</Label>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        disabled={isNaN(newVal) || newVal == ""}
        onClick={updateCOHModifier}
      >
        Save
      </Button>
    </div>
  );
}
