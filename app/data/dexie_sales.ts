import { db } from "./dexie";
import { GoodOutProp } from "./schemas";
import { formatDateToNumber, sales_type_to_is_good_in } from "~/lib/utils";
import { add_good_sales } from "./dexie_good_sales";
import { recompute_coh_from_sales, txless_recompute_coh } from "./dexie_coh";
import { addExpiration } from "./dexie_goods";
import toast from "react-hot-toast";

export async function getSalesById(id: string) {
  try {
    return await db.dexieSales.where("id").equals(id).first();
  } catch (error) {
    console.error("Error retrieving products:", error);
  }
}

export async function getAllSales() {
  try {
    const allProducts = await db.dexieSales.toArray();
    return allProducts;
  } catch (error) {
    console.error("Error retrieving products:", error);
  }
}

export async function updateTxSales() {
  try {
    const allProducts = await db.dexieSales.toArray();
    for (const prod of allProducts) {
      console.log(prod);
      // prod.id && db.dexieSales.update(prod.id, {
      //     // tx_date_idx: formatDateToNumber(prod.tx_date)
      //     is_good_in: false
      // })
    }
  } catch (error) {
    console.log(error);
  }
}

export async function getSalesByDate(
  start: number,
  is_good_in: boolean,
  end?: number
) {
  try {
    if (!end) {
      console.log(is_good_in);
      return await db.dexieSales
        .where("tx_date_idx")
        .equals(start)
        .and((ele) => ele.is_good_in == is_good_in)
        .toArray();
    } else {
      return await db.dexieSales
        .where("tx_date_idx")
        .between(start, end, true, true)
        .and((ele) => ele.is_good_in == is_good_in)
        .toArray();
    }
  } catch (error) {
    console.error("Error retrieving products:", error);
  }
}

/**
 * Insert a new sale record.
 */
export async function record_dexie_sale(
  values: GoodOutProp,
  onSubmit: CallableFunction,
  is_good_in: boolean
) {
  // 1. add dexie sales
  // 2. add dexie good sales
  // 3. update goods
  // 4. update dexie coh
  try {
    await db.transaction(
      "rw",
      db.dexieSales,
      db.dexieGoodSales,
      db.dexieGoods,
      async () => {
        // 1. add dexie sales
        const items = sales2items(values);
        const salesUpdate: DexieSales = {
          tx_date: values.date,
          tx_date_idx: formatDateToNumber(values.date),
          type: values.reason,
          items,
          is_good_in,
        };
        const sale_id = await insertSales(salesUpdate);
        if (!sale_id) {
          throw Error;
        }
        // 2. add dexie good sales
        const goodsitem = sales2gooditems(values, sale_id);
        for (const gooditem of goodsitem) {
          add_good_sales(gooditem);
        }
        // 3. update goods
        // for (const item of items) {
        //   item.id && addExpiration(item.id, item.quantity, is_good_in);
        // }
      }
    );
    await db.transaction("rw", db.dexieCOH, db.dexieSales, async () => {
      // 4. update dexie coh
      await txless_recompute_coh();
    });
    onSubmit(true);
  } catch (error) {
    onSubmit(false);
    console.error("Transaction failed:", error);
  }
}

function sales2gooditems(
  values: GoodOutProp,
  sales_id: string
): ItemSaleIndividual[] {
  return values.products.map((ele) => {
    if (!ele.prod_id) {
      throw Error;
    }
    return {
      prod_id: ele.prod_id,
      sold_price: ele.sold_price,
      quantity: ele.quantity,
      date: values.date,
      tx_date_idx: formatDateToNumber(values.date),
      operation: values.reason,
      sale_ref: sales_id,
    };
  });
}

export function sales2items(values: GoodOutProp) {
  return values.products.map((val) => {
    return {
      name: val.product,
      id: val.prod_id,
      // orig_price: val.price || 0,
      selling_price: val.selling_price || 0,
      sold_price: val.sold_price,
      quantity: val.quantity,
    };
  });
}

async function insertSales(sales: DexieSales) {
  try {
    const id = await db.dexieSales.add(sales);
    await recompute_coh_from_sales();
    console.log(`Sales ID:${id} added.`);
    return id;
  } catch (error) {
    console.log(error);
  }
}

export async function deleteSingleSales(sales_id: string) {
  // 1. Delete sales
  // 2. Delete good Sale
  // 3. update dexie Goods
  // 4. update dexie coh
  try {
    db.transaction(
      "rw",
      db.dexieSales,
      db.dexieGoodSales,
      db.dexieCOH,
      async () => {
        const sales_obj = await db.dexieSales.get(sales_id)
        if (!sales_obj) throw Error
        // 1. Delete sales
        await db.dexieSales.delete(sales_id);
        // 2. Delete good Sale
        const good_sales = await db.dexieGoodSales
        .where("sale_ref")
        .equals(sales_id)
        .first();
        console.log(sales_id, good_sales)
        if (!good_sales) throw Error;
        await db.dexieGoodSales.delete(good_sales.id);
        // 3. update dexie Goods
        // for (const item of sales_obj.items) {
        //   item.id && addExpiration(item.id, item.quantity, !sales_type_to_is_good_in(sales_obj.type))
        // }
        // 4. update dexie coh
        await txless_recompute_coh();
        toast.success("Sales item deleted.");
      }
    );
  } catch (error) {
    toast.error("Error occured.");
  }
}
