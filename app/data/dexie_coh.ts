import { groupByDate, sortObjectByDate, stringDateToNumberDate } from "~/lib/utils";
import { db } from "./dexie";

export function recompute_coh(writable: DexieCOH[]) {
    try {
        db.transaction('rw', db.dexieCOH, async () => {
            for (const ele of writable) {
                const coh = await db.dexieCOH.where("date").equals(ele.date).first()
                if (coh) {
                    db.dexieCOH.update(coh.id, {
                        total_sales: ele.total_sales,
                        current_coh: ele.current_coh
                    })
                }
                else {
                    db.dexieCOH.add(ele)
                }
            }

        })
        console.log("Transaction done.")
    } catch (error) {
        console.log(error)
    }

}
export async function get_all_coh() {
    return await db.dexieCOH.toArray()
}


export async function recompute_coh_from_sales() {
    try {
        db.transaction('rw', db.dexieCOH, db.dexieSales, async () => {
            const sales = await db.dexieSales.toArray()
            const coh = Object.values(sortObjectByDate(groupByDate(sales), true)).reduce<DexieCOH[]>((prev, ele, index) => {
                const { date, sales_arr } = ele
                const total_sales = sales_arr.reduce((sum, curr) => sum +
                    curr.items.reduce((inner_sum, inner_cur) => inner_sum + inner_cur.quantity * (inner_cur.sold_price), 0),
                    0)
                prev.push({
                    date: stringDateToNumberDate(date),
                    total_sales,
                    current_coh: index === 0 ? total_sales : prev[index - 1].current_coh + total_sales
                })
                return prev
            }, [])
            recompute_coh(coh)
        })
        console.log('coh recomputed')
    } catch (error) {

    }
}