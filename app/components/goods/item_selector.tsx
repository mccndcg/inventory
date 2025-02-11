import { useEffect, useState } from "react";
import { categories } from "../register_goods/schema";
import { ScrollArea } from "@/components/ui/scroll-area"
import { getSalesByCategory } from "~/data/dexie_goods";
import { Button } from "../ui/button";
import { ArrowLeft } from "lucide-react";
import { GoodsList } from "./goods_list";

interface Props {
    onProductSelect: (val: DexieGood) => any
    onClick: () => any
}

export function ItemSelector({ onProductSelect, onClick }: Props) {
    const [selCategory, setSelCategory] = useState("")
    const [dexieGoods, setDexieGoods] = useState<DexieGood[] | undefined>()

    useEffect(() => {
        selCategory != "" && getSalesByCategory(selCategory).then(val => setDexieGoods(val))
    }, [selCategory])

    return (<>
        <div className="flex gap-2 flex-wrap justify-center">
            <Button size="icon" variant="outline" className="shadow-md" onClick={onClick}><ArrowLeft /></Button>
            {
                categories.map((ele, index) => <div
                    className={`${selCategory == ele ? 'bg-foreground text-background ' : 'shadow-md'} 
                        border rounded-lg py-0.5 px-2 cursor-pointer`}
                    onClick={() => setSelCategory(ele)}
                    key={index}
                >
                    {ele}
                </div>)
            }
        </div>
        <ScrollArea className="h-[calc(100dvh-200px)] border p-4 mt-4">
            {dexieGoods && <GoodsList onProductSelect={onProductSelect} dexieGoods={dexieGoods} />}
        </ScrollArea>
    </>
    )
}