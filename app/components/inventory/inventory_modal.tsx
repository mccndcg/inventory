import { useState, } from "react";
import ProductSearch from "../product_search";
import { Button } from "../ui/button";
import { Link } from "@remix-run/react";


export default function InventoryModalContent() {
    const [dexieGood, setDexieGood] = useState<DexieGood | null>()
    function onProductSelect(good: DexieGood) {
        setDexieGood(good)
    }
    return (<div className="m-2 grid grid-cols-[1fr_80px]">
        <div>
            <ProductSearch onSelectProd={onProductSelect} labelString="Search product:" />

        </div>
        <div className="mt-6 ml-2 flex">
            <span className="mr-1 mt-1 italic">or</span> <Link to="/inventory"><Button>ALL</Button></Link>
        </div>
        <div>
            {
                dexieGood ? <div className="grid grid-cols-[150px_1fr] shadow-sm w-full border rounded gap-2 mt-1">
                    <div className="p-1 bg-primary/10 rounded">Name</div>
                    <div className="m-1 font-bold">{dexieGood.name}</div>
                    <div className="p-1 border-r-4">Price</div>
                    <div className="m-1"><span className="text-primary/60">Php </span>{dexieGood.selling_price}</div>
                    <div className="p-1 border-r-4 bg-primary/10 rounded">Quantity</div>
                    <div className=""></div>
                    {/* <div className="p-1 border-r-4">Actual</div> */}
                    {/* <div className="m-1">{JSON.stringify(dexieGood.physical)}</div> */}
                </div> : <div className="grid place-items-center h-[200px] border rounded mt-1">
                    <div>No product selected
                    </div>
                </div>
            }
        </div>
        <div className="mt-1 ml-2">
            <Button variant="outline" className="shadow-md">Sales</Button>
        </div>
    </div>)
}