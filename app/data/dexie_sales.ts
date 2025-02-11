import { formatDate, formatDateToNumber } from "~/lib/utils";
import { db } from "./dexie";

export async function getSalesById(id: string) {
    try {
        return await db.dexieSales.where("id").equals(id).first()
    } catch (error) {
        console.error('Error retrieving products:', error);

    }
}

export async function getAllSales() {
    try {
        const allProducts = await db.dexieSales.toArray();
        return allProducts
    } catch (error) {
        console.error('Error retrieving products:', error);
    }
}

export async function updateTxSales() {
    try {
        const allProducts = await db.dexieSales.toArray();
        for (const prod of allProducts) {
            console.log(prod)
            // prod.id && db.dexieSales.update(prod.id, {
            //     // tx_date_idx: formatDateToNumber(prod.tx_date)
            //     is_good_in: false
            // })
        }
    } catch (error) {
        console.log(error)
    }

}

export async function getSalesByDate(start: number, is_good_in: boolean, end?: number,) {
    try {
        if (!end) {
            console.log(is_good_in)
            return await db.dexieSales
                .where("tx_date_idx").equals(start)
                .and(ele => ele.is_good_in == is_good_in)
                .toArray()
        }
        else {
            return await db.dexieSales.where("tx_date_idx")
                .between(start, end, true, true)
                .and(ele => ele.is_good_in == is_good_in)
                .toArray();
        }
    } catch (error) {
        console.error('Error retrieving products:', error);
    }
}