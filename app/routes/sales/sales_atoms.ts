import { atom } from "jotai";
import { controls } from "~/components/datepicker";
import { ProductProp } from "~/data/schemas";

interface EditGoodsProp {
  products?: ProductProp;
  date?: Date;
  id?: string;
}

export const isGoodsOutAtom = atom(false);
export const salesDateAtom = atom(controls[1].dateGetter());
export const isDescFilterAtom = atom(false);
export const editGoodsPropAtom = atom<EditGoodsProp | undefined>(undefined);
export const dialogTypeAtom = atom<"sales" | "coh">("sales");

export const editCohAtom = atom({
  value: 0,
  id: "",
  modifier: undefined as COHModifier | undefined,
});
