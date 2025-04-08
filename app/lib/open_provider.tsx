import {
  createContext,
  useState,
  Dispatch,
  ReactNode,
  SetStateAction,
} from "react";

interface Context {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  dexieGood?: DexieGood;
  setDexieGood: Dispatch<SetStateAction<DexieGood | undefined>>;
}

interface Props {
  children: ReactNode;
}

export const MenuContext = createContext<Context>(undefined!);

export default function OpenProvider({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [dexieGood, setDexieGood] = useState<DexieGood | undefined>();
  return (
    <MenuContext.Provider value={{ open, setOpen, dexieGood, setDexieGood }}>
      {children}
    </MenuContext.Provider>
  );
}
