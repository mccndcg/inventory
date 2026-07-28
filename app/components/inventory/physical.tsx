import { useEffect, useState } from "react"
import { getDexieGoodById } from "~/data/dexie"

export function PhysicalInventory({ id }: { id?: string }) {
    const [dexieGood, setDexieGood] = useState<DexieGood | null>()
    useEffect(() => {
        console.log(id)
        id && getDexieGoodById(id).then(val => setDexieGood(val))
    }, [id])
    return (<div>
        {JSON.stringify(dexieGood)}
    </div>)
}
