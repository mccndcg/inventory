import { db } from "./dexie";

export function add_good_sales(sale: ItemSaleIndividual) {
  try {
    console.log(sale)
    db.dexieGoodSales.add(sale);
  } catch (error) {
    console.log(error);
  }
}

export async function get_good_sales(prod_id: string) {
  try { 
    return await db.dexieGoodSales.where("prod_id").equals(prod_id).toArray();
  } catch (error) {
    console.log(error);
  }
}
