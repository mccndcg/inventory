import { Link } from "@remix-run/react";
import { ChevronLeft, Search, Trash } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { TableDemo } from "~/components/inventory/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { LinksFunction } from "@remix-run/node";

import styles from "~/loader.css?url";
import { editGood, getInventoryData } from "~/data/dexie";
import { ResponsiveDialog } from "~/components/modal_card";
import OpenProvider, { MenuContext } from "~/lib/open_provider";
import RegisterGoods from "~/components/register_goods/register_goods";
import { debounce } from "~/lib/utils";
import { z } from "zod";
import { categories, registerGoodsSchema } from "~/components/register_goods/schema";
import toast from "react-hot-toast"
import { PhysicalForm } from "~/components/physical/physical_container";
import { PhysicalProp } from "~/data/physical";


export const links: LinksFunction = () => [
    { rel: "stylesheet", href: styles },
];

function InventoryTable({ filterString, catString }: { filterString: string, catString: string }) {
    const [tableData, setTableData] = useState<DexieGood[]>([])
    const { open, setOpen } = useContext(MenuContext)
    const [selGood, setSelGood] = useState<undefined | DexieGood>()
    const [editMode, setEditMode] = useState<'good' | 'physical'>('good')

    useEffect(() => {
        getInventoryData().then(val => setTableData(val))
    }, [])

    function openGoodEditor(good: DexieGood) {
        setSelGood(good)
        setEditMode('good')
    }

    function openPhysicalEditor(good: DexieGood) {
        setSelGood(good)
        setEditMode('physical')
    }

    function editPhysicalFunc(val: PhysicalProp) {
        console.log(val)
    }

    function editGoodFunc(val: z.infer<typeof registerGoodsSchema>) {
        selGood !== undefined && selGood.id && editGood(
            selGood.id, selGood, val)
            .then(() => {
                toast.success("Product Updated")
                getInventoryData().then(val => setTableData(val))
            })
            .catch(() => toast.error("Something happened."))
            .finally(() => setOpen(false))
    }


    return (<>
        <ResponsiveDialog title="Modify Good" hide_trigger={true}>
            {
                editMode == 'good' ?
                    (selGood !== undefined && <RegisterGoods def={selGood} onSubmitProp={editGoodFunc} />) :
                    (selGood !== undefined && <PhysicalForm dexie_good={selGood} onSubmitProp={editPhysicalFunc} />)
            }
        </ResponsiveDialog>

        <TableDemo
            data={tableData}
            filter_string={filterString}
            setGood={openGoodEditor}
            catString={catString}
            setPhysical={openPhysicalEditor} />
    </>)
}

export default function Inventory() {
    const [filterString, setFilterString] = useState("")
    const setString = debounce((e: any) => setFilterString(e.target.value), 500)
    const [catFilter, setCatFilter] = useState("all")
    function reset() {
        setFilterString("")
        setCatFilter("all")
    }
    return (
        <>
            <div className="sticky top-0 z-10 p-2 bg-background flex flex-col space-y-4 shadow-md">
                <div className="flex">
                    <Link to="/">
                        <Button size="icon" variant="outline">
                            <ChevronLeft />
                        </Button>

                    </Link>
                    <h2 className="text-3xl font-bold tracking-tight ml-4">Inventory</h2>

                </div>
                <div className="p-2 border rounded flex space-x-4">
                    <Input type="email" placeholder="Product Name" onChange={(e) => setFilterString(e.target.value)} value={filterString} />
                    {/* <DatePickerDemo /> */}
                    {/* <Button size="icon">
                        <Search />
                    </Button> */}
                    <Button size="icon" variant="outline" onClick={() => reset()}>
                        <Trash />
                    </Button>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                    {
                        ["all", ...categories].map((ele, index) => <div
                            className={`${catFilter == ele ? 'bg-foreground text-background ' : 'shadow-md'} cursor-pointer border rounded-lg py-0.5 px-2`}
                            onClick={() => setCatFilter(ele)}
                            key={index}
                        >
                            {ele}
                        </div>)
                    }
                </div>
            </div>
            <div className="p-4 flex flex-col space-y-4">
                <OpenProvider>
                    <InventoryTable filterString={filterString} catString={catFilter} />
                </OpenProvider>

            </div>
        </>)
}