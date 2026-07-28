import { Link, useParams } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { LinksFunction } from "@remix-run/node";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "~/components/ui/tabs"

import styles from "~/loader.css?url";
import { getDexieGoodById } from "~/data/dexie";
import { useEffect, useState } from "react";
import { PhysicalInventory } from "~/components/inventory/physical";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: styles },
];


export default function InventoryWithId() {
    const params = useParams();
    const [tab, setTab] = useState("physical")

    const [dexieGood, setDexieGood] = useState<DexieGood | null>()
    useEffect(() => {
        if (!params.id) return
        getDexieGoodById(params.id).then((val) => setDexieGood(val))
    }, [params.id])
    return (
        <>
            <div className="sticky top-0 z-10 p-2 bg-background flex flex-col space-y-4 shadow-md">
                <div className="flex">
                    <Link to="/inventory">
                        <Button size="icon" variant="outline">
                            <ChevronLeft />
                        </Button>

                    </Link>
                    <h2 className="text-3xl  tracking-tight ml-4 mr-4">Inventory</h2>
                    <div className="text-3xl">/</div>
                    <h2 className="text-3xl font-bold tracking-tight ml-4">{dexieGood ? dexieGood.name : ""}</h2>
                </div>
                <div className="p-2 border rounded flex space-x-4 justify-center">
                    <Tabs defaultValue="physical" onValueChange={setTab}>
                        <TabsList>
                            <TabsTrigger value="physical">Physical</TabsTrigger>
                            <TabsTrigger value="sales">Sales</TabsTrigger>
                        </TabsList>

                    </Tabs>
                </div>
            </div>
            <div className="p-4">
                {
                    tab == "physical" && params.id
                      ? <PhysicalInventory id={params.id} />
                      : "wenk"
                }
            </div>

        </>
    )
}
