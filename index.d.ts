interface Product {
  product: string;
  price: number;
  selling_price: number;
  quantity: number;
}

interface PhysicalGood {
  expiration_date?: Date;
  quantity: number;
}

interface DexieGood {
  id?: string;
  categories: string[];
  name: string;
  selling_price: number;
  physical?: PhysicalGood[];
  name_prefix?: string;
  size?: string;
}

interface ItemSale {
  name: string;
  id?: string;
  selling_price: number;
  sold_price: number;
  quantity: number;
}

interface ItemSaleIndividual {
  id?: string;
  prod_id: string; // id of product
  sold_price: number;
  quantity: number;
  date: Date;
  operation: SalesType;
  tx_date_idx: number;
  sale_ref: string; // id of the sale (contains multiple items)
}

type SalesType =
  | "sales"
  | "stock_in"
  | "stock_in"
  | "saleless_stock_in"
  | "personal_use"
  | "spoilage"
  | "set_value"

interface InventoryTable {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
}

interface UpdateInput {
  selling_price: number;
  name: string;
  id?: string;
  physical: PhysicalGood;
}

interface DexieSales {
  id?: string;
  items: ItemSale[];
  tx_date: Date;
  type: SalesType;
  tx_date_idx: number;
  is_good_in: boolean;
}

interface NumberInputProps {
  defaultPrice: number;
  defaultQuantity: number;
  productName: string;
}

type ModifierLit =  "minus" | "plus" | "set"

interface COHModifier {
  type: ModifierLit
  amount: number
}

interface DexieCOH {
  id?: string;
  date: number;
  total_sales: number;
  current_coh: number;
  modifier?: COHModifier
}

interface SalesObject {
  [key: string]: DexieSales[];
}

interface GoodOperation {
  op: "out" | "in" | "manual" | "sales_modify";
  value: number;
  sales_id: string;
}

interface GoodHistory {
  good_id: string;
  history: GoodOperation[];
}
