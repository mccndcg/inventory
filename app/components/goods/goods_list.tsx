interface Props {
    dexieGoods: DexieGood[]
    onProductSelect: (val: DexieGood) => any
}

export function GoodsList({ dexieGoods, onProductSelect }: Props) {
    return (

        <div className="flex flex-col gap-2">
            {
                dexieGoods.sort((a, b) => a.name.localeCompare(b.name)).map((ele) => <div
                    className="border rounded-md p-2 border-b-2 cursor-pointer hover:bg-primary-foreground hover:border-l-2 hover:border-l-black"
                    key={ele.name}
                    onClick={() => onProductSelect(ele)}
                >
                    {ele.name}
                </div>)
            }
        </div>
    )
}