import { db } from "./dexie";

export function add_good_sales(sale: ItemSaleIndividual) {
    try {
        db.dexieGoodSales.add(sale)
    } catch (error) {

    }
}