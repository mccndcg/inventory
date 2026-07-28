import { Dexie, type EntityTable } from 'dexie';
import { formatDateToNumber, getChangedKeys, getNamePrefix, removeQuantities } from '~/lib/utils';
import { dexieCloud } from "dexie-cloud-addon";
import { recompute_coh_from_sales } from './dexie_coh';


export const db = new Dexie('goods', { addons: [dexieCloud] }) as Dexie & {
    dexieGoods: EntityTable<
        DexieGood,
        "id"
    >,
    dexieSales: EntityTable<
        DexieSales,
        "id"
    >,
    dexieCOH: EntityTable<
        DexieCOH,
        "id"
    >,
    dexieGoodSales: EntityTable<
        ItemSaleIndividual,
        "id"
    >
};
db.version(4).stores({
    dexieGoods: '@id,name,selling_price,categories,physical,name_prefix', // Primary key is 'id' (auto-incremented)
    dexieSales: '@id,tx_date,type,items,tx_date_idx', // Primary key is 'id' (auto-incremented)
    dexieCOH: '@id,date,total_sales,current_coh',
    dexieGoodSales: '@id,prod_id,sold_price,quantity,date,operation,tx_date_idx,sale_ref'
});


db.cloud.configure({
    databaseUrl: "https://zkl87x6n6.dexie.cloud",
    requireAuth: true, // optional,
    customLoginGui: false
});

export const getDexieGoodById = async (id: string) => {
    const good = await db.dexieGoods
        .where('id')
        .equals(id)
        .first();  // Returns the first match or undefined if none
    return good
};
export const getDexieGoodByName = async (name: string) => {
    const good = await db.dexieGoods
        .where('name')
        .equals(name)
        .first();  // Returns the first match or undefined if none

    console.log(good); // Log the matching DexieGood
};

export const getDexieGoodsByPrefix = async (prefix: string) => {
    const goods = await db.dexieGoods
        .where('name_prefix') // Search on the indexed 'name_prefix' field
        .startsWith(prefix.toLowerCase()) // Perform the prefix match
        .toArray();
    return goods
};

export const addDexieGood = async (inputGood: DexieGood) => {
    try {
        const newGood: DexieGood = inputGood
        const namePrefix = getNamePrefix(newGood.name)
        // Insert the new DexieGood into the database
        const id = await db.dexieGoods.add({ ...newGood, name_prefix: namePrefix });
        console.log(`New DexieGood added with ID: ${id}`);
        return id
    } catch (error) {
        console.error('Error adding DexieGood:', error);
        throw error
    }
};

export const getInventoryData = async () => await db.dexieGoods.toArray();


export async function updatePhysical(update: UpdateInput) {
    const dexieGood = await db.dexieGoods.get(update.id);
    if (!dexieGood) {
        await addDexieGood({
            name: update.name,
            selling_price: update.selling_price,
            categories: [],
            physical: [update.physical]
        })
    }
    else {
        // Add the new PhysicalGoods to the 'physical' array
        const physical = dexieGood.physical ?? [];
        physical.push(update.physical);
        if (update.selling_price != dexieGood.selling_price) {
            await db.dexieGoods.update(update.id, { physical, selling_price: update.selling_price });

        }
        else {
            // Update the DexieGood document with the new physical array
            await db.dexieGoods.update(update.id, { physical });
        }
    }

}

export async function updatePhysicalRemove(id: string, quantity: number) {
    const dexieGood = await db.dexieGoods.get(id);
    if (!dexieGood) {
        throw Error()
    }
    const new_physical = removeQuantities(dexieGood.physical ?? [], quantity)
    await db.dexieGoods.update(id, { physical: new_physical });
}


export async function deleteGood(id: string) {
    await db.dexieGoods.delete(id)
}

export async function editGood(id: string, old_good: DexieGood, new_good: DexieGood) {
    try {
        const updated_object = getChangedKeys(old_good, new_good)
        if (Object.keys(updated_object).length > 0) {
            await db.dexieGoods.update(id, updated_object)
            console.log(`Sales ID:${id} updated.`)
        }
    } catch (error) {
        console.log(error)
        throw error
    }
}


interface editSales {
    id: string
    item?: ItemSale[]
    date?: Date
}

export async function editSales({ id, item, date }: editSales, onFinish?: (val: boolean) => void) {
    try {
        await db.dexieSales.update(id, (sale) => {
            if (item) {
                sale.items = item
            }
            if (date) {
                sale.tx_date = date
                sale.tx_date_idx = formatDateToNumber(date)
            }
        })
        await recompute_coh_from_sales()
        onFinish && onFinish(true)
    } catch (error) {
        onFinish && onFinish(false)
    }

}
