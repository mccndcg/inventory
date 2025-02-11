import React, { createContext, useState, Dispatch, ReactNode, SetStateAction, } from "react"

interface Context {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}

interface Props {
  children: ReactNode
}

export const MenuContext = createContext<Context>(undefined)

export default function OpenProvider({ children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <MenuContext.Provider value={{open, setOpen}}>
      {children}
    </MenuContext.Provider>
  );
}