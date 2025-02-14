import { db } from "./dexie";
import { isSameYear, isSameMonth, isSameDay } from "date-fns";

export async function getSalesByCategory(category: string) {
  try {
    return await db.dexieGoods.toArray().then((items) => {
      return items.filter((ele) => ele.categories.includes(category));
    });
  } catch (error) {
    console.log(error);
  }
}

export async function updatePhysicalGood(id: string, physical: PhysicalGood[]) {
  try {
    await db.dexieGoods.update(id, {
      physical,
    });
    console.log(`Sales ID physical good:${id} updated.`);
  } catch (error) {
    console.log(error);
  }
}

export async function addExpiration(
  prod_id: string,
  quantity: number,
  is_good_in: boolean,
  expiration?: Date
) {
  try {
    const good = await db.dexieGoods.get(prod_id);
    if (!good) throw Error;
    const physical = good?.physical;
    if (!physical || physical.length == 0) {
      await db.dexieGoods.update(prod_id, {
        physical: [
          {
            quantity,
            ...(expiration && { expiration_date: expiration }),
          },
        ],
      });
    }
    // already initialized
    else {
      const physical_item = physical.find((ele) =>
        expiration && ele?.expiration_date
          ? isSameYear(expiration, ele.expiration_date) &&
            isSameMonth(expiration, ele.expiration_date) &&
            isSameDay(expiration, ele.expiration_date)
          : !Object.hasOwn(ele, "expiration_date") ||
            ele?.expiration_date === undefined
      );
      console.log(physical_item);
      if (physical_item) {
        physical_item.quantity =
          physical_item.quantity + (is_good_in ? quantity : quantity * -1);
      }
      await db.dexieGoods.update(prod_id, {
        physical,
      });
    }
  } catch (error) {
    console.log(error);
    throw Error;
  }
}
