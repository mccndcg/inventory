import { db } from "~/data/dexie";

export function deleteSalesItem(id: string) {
    db.dexieSales.delete(id)
        .then(() => console.log("deleted"))
}