interface Props {
    products: DexieGood[]
    onClick: CallableFunction
    list_index: number
}

export function ProductMenu({ products, onClick, list_index }: Props) {
    return (<div>
        {products.map((ele, index) => {
            return <div onClick={() => { onClick(index, list_index) }} className="cursor-pointer" key={index}>
                {ele.name} ({ele.physical.reduce((sum ,item) => sum + item.quantity, 0)})
            </div>
        })}
    </div >
    )
}