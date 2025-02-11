import { db } from "./dexie"

export async function getSalesByCategory(category: string) {
    try {
        return await db.dexieGoods.toArray().then(items => {
            return items.filter(ele => ele.categories.includes(category))
        })
    } catch (error) {
        console.log(error)
    }
}