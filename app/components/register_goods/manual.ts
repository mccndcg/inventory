import { db } from "~/data/dexie";
import { products_json } from "./products_json";
import { products_food } from "./products_food";

export async function addManual() {
    try {
        await db.transaction('rw', db.dexieGoods, async () => {
            const products = products_food.map(ele => {
                return {
                    name: ele.Product,
                    selling_price: typeof ele.Price == 'string' ? 0 : ele.Price,
                    size: ele.Size,
                    categories: [],
                    physical: []
                }
            })
            db.dexieGoods.bulkAdd(products).then(() => console.log("Write done"))
        })
    } catch (error) {

    }
}

export async function addPrefix() {
    try {
        await db.transaction('rw', db.dexieGoods, async () => {
            const goods = await db.dexieGoods.toArray()
            for (const good of goods) {
                // console.log(good.name_prefix, "--", good.name)
                if (!good.name_prefix) {
                    const namePrefix = good.name.slice(0, 6).toLowerCase();
                    await db.dexieGoods.update(good.id, {
                        name_prefix: namePrefix
                    })
                }
            }
        })
        console.log("Prefix done")
    } catch (error) {
        console.log(error)
    }
}