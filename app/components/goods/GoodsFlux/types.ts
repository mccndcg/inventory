import { ReactNode } from "react";
import { ProductProp } from "~/data/schemas";

interface Editable {
  products?: ProductProp;
  date?: Date;
  oldId?: string;
  resettter?: () => void;
}

export interface GoodsOutProps {
  itemSelector?: ReactNode;
  editObject?: Editable;
}