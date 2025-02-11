import { useEffect, useState } from "react"
import DailySales from "~/components/sales/daily_sales"
import { getInventoryData } from "~/data/dexie"

const sales_arr: DexieSales[] = [
    {
        items: [
            {
                name: "Jim's Coffee",
                sold_price: 200,
                quantity: 5,
                orig_price: 100,
                selling_price: 100
            }
        ],
        tx_date: new Date(),
        type: 'sales'
    },
]


export default function ThreePanel() {
    const [goodsArr, setGoodsArr] = useState<null | DexieGood[]>()
    useEffect(() => {
        getInventoryData().then((val) => setGoodsArr(val))
    }, [])
    return (<div className="grid grid-cols-3 h-dvh">
        <div className="m-1 border">
            {
                goodsArr && goodsArr.map((ele, index) => <div key={index}>
                    {ele.name} [5]
                </div>)
            }
        </div>
        <div className="m-1 border"></div>
        <div className="m-1 border">
            <DailySales sales_arr={sales_arr} />
        </div>
    </div>)
}