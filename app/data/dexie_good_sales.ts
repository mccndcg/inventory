import { db } from "./dexie";

export function add_good_sales(sale: ItemSaleIndividual) {
  try {
    db.dexieGoodSales.add(sale);
  } catch (error) {
    console.log(error);
  }
}

export async function get_good_sales(prod_id: string) {
  try {
    console.log(await db.dexieGoodSales.toArray())
    return await db.dexieGoodSales.where("prod_id").equals(prod_id).toArray();
  } catch (error) {
    console.log(error);
  }
}
