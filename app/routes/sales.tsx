import { Link } from "@remix-run/react";
import { ArrowDown, ArrowUp, CalendarArrowDown, CalendarArrowUp, ChevronLeft, Search } from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { DateRange } from "react-day-picker";
import { controls, DatePickerDemo } from "~/components/datepicker";
import { GoodsOutForm } from "~/components/goods/goods_out";
import { ResponsiveDialog } from "~/components/modal_card";
import DailySales from "~/components/sales/daily_sales";
import { deleteSalesItem } from "~/components/sales/dexie";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { get_all_coh, recompute_coh, recompute_coh_from_sales } from "~/data/dexie_coh";
import { getSalesByDate, getSalesById, updateTxSales } from "~/data/dexie_sales";
import OpenProvider, { MenuContext } from "~/lib/open_provider";
import { formatDate, formatDateToNumber, groupByDate, sortObjectByDate, stringDateToNumberDate } from "~/lib/utils";



const activeClass = "text-3xl font-bold tracking-tight ml-4 cursor-pointer"
const defaultClass = "text-3xl text-primary/60 ml-4 cursor-pointer"



interface Props {
    isGoodsIn: boolean
    date: DateRange
    filter_direction: boolean
}

function SalesView({ date, isGoodsIn, filter_direction }: Props) {
    const [editType, setEditType] = useState<'physical' | 'good'>('physical')
    const [salesDict, setSalesDict] = useState<SalesObject>({})
    const [dexieSale, setDexieSale] = useState<any | undefined>()
    const [oldDate, setOldDate] = useState<Date>()
    const [oldId, setOldId] = useState<string | undefined>()
    const [dexieCOH, setDexieCoh] = useState<undefined | { [key: number]: DexieCOH }>()
    const { open, setOpen } = useContext(MenuContext)

    function resetState() {
        setOldId(undefined)
        setOldDate(undefined)
        setDexieSale(undefined)
        if (date.from == undefined) return
        getSalesByDate(formatDateToNumber(date.from), isGoodsIn, date.to && formatDateToNumber(date.to)).then(val => {
            if (val) { setSalesDict(groupByDate(val)) }
        })
    }
    function editSales(val: DexieSales) {
        if (!val.id) return
        setDexieSale(val.items.map(ele => { return { ...ele, product: ele.name } }))
        setOldId(val.id)
        setOldDate(val.tx_date)
        setOpen(true)
    }

    function deleteSales(val: DexieSales) {
        val.id && deleteSalesItem(val.id)
    }

    function onAddItem(date: Date) {
        setOldDate(date)
        setDexieSale(undefined)
        setOpen(true)
    }

    useEffect(() => {
        if (date.from == undefined) return
        getSalesByDate(formatDateToNumber(date.from), isGoodsIn, date.to && formatDateToNumber(date.to))
            .then(val => {
                if (val) { setSalesDict(groupByDate(val)) }
                return get_all_coh()
            })
            .then(val => {
                setDexieCoh(val.reduce((prev, cur) => {
                    prev[cur.date] = cur
                    return prev
                }, {} as { [key: number]: DexieCOH }))
            })
    }, [date, isGoodsIn])
    function process_dict() {
        return sortObjectByDate(salesDict, filter_direction)
    }

    return (
        <>
            <ResponsiveDialog title="Edit Sales" hide_trigger>
                <GoodsOutForm editObject={{ products: dexieSale, oldId, date: oldDate, resettter: resetState }} isGoodIn={isGoodsIn} />
            </ResponsiveDialog>
            <div className="p-4 flex flex-col space-y-4 w-full">
                {/* <Button onClick={recompute_coh_from_sales}>update coh</Button> */}
                {/* <Button onClick={updateTxSales}>update tx</Button> */}
                {
                    salesDict && dexieCOH && Object.values(process_dict()).map(ele => {
                        const { date, sales_arr } = ele
                        return <div key={date} className="border rounded shadow-md">
                            <div className=" text-xl  ml-2 flex flex-col p-2" style={{
                                // background: "rgb(255, 255, 255)",
                                background: "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(235,235,235,1) 73%, rgba(201,231,237,1) 100%)"
                            }}>
                                <div className="grow italic font-bold text-center mb-2">
                                    {formatDate(date)}
                                </div>
                                <div className="space-x-2">
                                    <span className="italic">Sales: </span>
                                    <span className="text-foreground/60">Php</span>
                                    <span className="text-green-700 font-bold">
                                        {sales_arr.reduce((sum, curr) => sum +
                                            curr.items.reduce((inner_sum, inner_cur) => inner_sum + inner_cur.quantity * (inner_cur.sold_price || 0), 0),
                                            0).toLocaleString("en-us")}
                                    </span>
                                </div>
                                <div className="space-x-2">
                                    <span className="italic">COH: </span>
                                    <span className="text-foreground/60">Php</span>
                                    <span className="text-green-700 font-bold">
                                        {dexieCOH[stringDateToNumberDate(date)].current_coh.toLocaleString("en-us")}
                                    </span>
                                </div>
                            </div>
                            <Separator />
                            <DailySales
                                sales_arr={sales_arr}
                                setIndex={editSales}
                                deleteIndex={deleteSales}
                                addItem={() => onAddItem(sales_arr[0].tx_date)} />
                        </div>
                    })
                }
            </div>
        </>
    )
}

export default function Sales() {
    const [isGoodsOut, setIsGoodsOut] = useState(true)
    const [date, setDate] = useState<DateRange>(controls[1].dateGetter())
    const [isDesc, setIsDesc] = useState(false)

    function recomputeDate() {
        setIsDesc(!isDesc)
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

                    <h2 className={isGoodsOut ? activeClass : defaultClass} onClick={() => setIsGoodsOut(true)}>Goods Out</h2>
                    <div className="text-3xl ml-4">/</div>
                    <h2 className={!isGoodsOut ? activeClass : defaultClass} onClick={() => setIsGoodsOut(false)}>Goods In</h2>
                </div>
                <div className="p-2 border rounded flex space-x-4">
                    {/* <Input type="email" placeholder="Product Name" /> */}
                    <DatePickerDemo date={date} setDate={setDate} />
                    <Button onClick={recomputeDate} size="icon" variant="outline">
                        {isDesc ? <ArrowUp /> : <ArrowDown />}</Button>
                    {/* <Button size="icon">
                        <Search />
                    </Button> */}
                </div>
            </div>
            <div className="grid place-items-center">
                <OpenProvider>
                    <SalesView isGoodsIn={!isGoodsOut} date={date} filter_direction={isDesc}></SalesView>
                </OpenProvider>
            </div>
        </>)
}