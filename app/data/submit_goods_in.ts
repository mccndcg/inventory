"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import {
  GoodInProp,
  goodInSchema,
  GoodOutProp,
  goodOutSchema,
  ProductProp,
} from "./schemas";


export function useSubmitGoodsOut(products?: ProductProp, date?: Date) {
  const form = useForm<GoodOutProp>({
    resolver: zodResolver(goodOutSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      date: date || new Date(),
      products: products || [],
      reason: "sales",
    },
  });
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "products",
  });
  function onSubmit(values: GoodOutProp) {
    return values;
  }
  return { form, onSubmit, fields, append, remove, update };
}

export function submit_goods_in() {
  const default_value = {
    product: "",
    quantity: 0,
    price: 0,
    selling_price: 0,
  };
  const form = useForm<GoodInProp>({
    resolver: zodResolver(goodInSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      date: new Date(),
      products: [default_value],
      reason: "stock_in",
    },
  });
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "products",
  });
  function onSubmit(values: GoodInProp) {
    console.log(values);
  }
  return { form, onSubmit, fields, append, remove, update, default_value };
}

export async function dexieSalesUpdate() {}



// export async function dexieSalesIn(values: GoodInProp, onSubmit: CallableFunction) {
//     const newUpdates = values.products.map((val): UpdateInput => {
//         return {
//             id: val.id,
//             selling_price: val.selling_price,
//             name: val.product,
//             physical: {
//                 quantity: val.quantity,
//             }
//         };
//     })
//     try {
//         // await db.transaction('rw', db.dexieGoods, async () => {
//         //     for (const update of newUpdates) {
//         //         updatePhysical(update)
//         //     }
//         //     console.log('All updates successful!');
//         // });
//         await db.transaction('rw', db.dexieSales, db.dexieGoods, async () => {
//             async function getItems() {
//                 const items = []
//                 for (const val of values.products) {
//                     let id = val.id
//                     if (!id) {
//                         id = await addDexieGood({
//                             name: val.product,
//                             selling_price: val.selling_price,
//                             categories: [],
//                             physical: []
//                         })
//                     }
//                     items.push({
//                         name: val.product,
//                         id: id,
//                         selling_price: val.selling_price,
//                         quantity: val.quantity,
//                         sold_price: val.sold_price || 0
//                     })
//                 }
//                 return items
//             }
//             const salesUpdate: DexieSales = {
//                 tx_date: values.date,
//                 tx_date_idx: formatDateToNumber(values.date),
//                 type: values.reason,
//                 items: await getItems(),
//                 // is_good_in: values.
//             }
//             console.log(salesUpdate)
//             onSubmit(true)
//             // updateSales(salesUpdate)
//         });
//     } catch (error) {
//         onSubmit(false)
//         console.error('Transaction failed:', error);
//     }

// }
