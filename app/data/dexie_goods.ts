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

export async function updatePhysicalGood(id: string, physical: PhysicalGood[]) {
    try {
        await db.dexieGoods.update(id, {
            physical
        })
        console.log(`Sales ID physical good:${id} updated.`)
    } catch (error) {
        console.log(error)
    }
}