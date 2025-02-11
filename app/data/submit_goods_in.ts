"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import { addDexieGood, db, insertSales, } from "./dexie"
import { GoodInProp, goodInSchema, GoodOutProp, goodOutSchema, ProductProp } from "./schemas"
import { formatDateToNumber } from "~/lib/utils"


export function submit_goods_out(products?: ProductProp, date?: Date) {
    const form = useForm<GoodOutProp>({
        resolver: zodResolver(goodOutSchema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: {
            date: date || new Date(),
            products: products || [],
            reason: 'sales',
        },
    })
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: 'products',
    });
    function onSubmit(values: GoodOutProp) {
        return values
    }
    return { form, onSubmit, fields, append, remove, update }
}

export function submit_goods_in() {
    const default_value = {
        product: "",
        quantity: "",
        price: "",
        selling_price: "",
    }
    const form = useForm<GoodInProp>({
        resolver: zodResolver(goodInSchema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: {
            date: new Date(),
            products: [default_value],
            reason: 'stock_in'
        },
    })
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: 'products',
    });
    function onSubmit(values: GoodInProp) {
        console.log(values)
    }
    return { form, onSubmit, fields, append, remove, update, default_value }
}

export async function dexieSalesUpdate() {
    
}

export function sales2items(values: GoodOutProp) {
    return values.products.map((val) => {
        return {
            name: val.product,
            id: val.id,
            orig_price: val.price || 0,
            selling_price: val.selling_price || 0,
            sold_price: val.sold_price,
            quantity: val.quantity
        }
    })
}

export async function dexieSalesOut(values: GoodOutProp, onSubmit: CallableFunction, is_good_in: boolean) {
    try {
        await db.transaction('rw', db.dexieSales, async () => {
            const salesUpdate: DexieSales = {
                tx_date: values.date,
                tx_date_idx: formatDateToNumber(values.date),
                type: values.reason,
                items: sales2items(values),
                is_good_in
            }
            insertSales(salesUpdate)
            onSubmit(true)
        });
    } catch (error) {
        onSubmit(false)
        console.error('Transaction failed:', error);
    }

}

export async function dexieSalesIn(values: GoodInProp, onSubmit: CallableFunction) {
    const newUpdates = values.products.map((val): UpdateInput => {
        return {
            id: val.id,
            selling_price: val.selling_price,
            name: val.product,
            physical: {
                date_added: new Date(),
                orig_price: val.price,
                quantity: val.quantity,
            }
        };
    })
    try {
        // await db.transaction('rw', db.dexieGoods, async () => {
        //     for (const update of newUpdates) {
        //         updatePhysical(update)
        //     }
        //     console.log('All updates successful!');
        // });
        await db.transaction('rw', db.dexieSales, db.dexieGoods, async () => {
            async function getItems() {
                const items = []
                for (const val of values.products) {
                    let id = val.id
                    if (!id) {
                        id = await addDexieGood({
                            name: val.product,
                            selling_price: val.selling_price,
                            categories: [],
                            physical: []
                        })
                    }
                    items.push({
                        name: val.product,
                        id: id,
                        orig_price: val.price,
                        selling_price: val.selling_price,
                        quantity: val.quantity
                    })
                }
                return items
            }
            const salesUpdate: DexieSales = {
                tx_date: values.date,
                tx_date_idx: formatDateToNumber(values.date),
                type: values.reason,
                items: await getItems()
            }
            console.log(salesUpdate)
            onSubmit(true)
            // updateSales(salesUpdate)
        });
    } catch (error) {
        onSubmit(false)
        console.error('Transaction failed:', error);
    }

}


