import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Dispatch, ReactNode, SetStateAction, useState } from "react"
import { Button } from "./ui/button"
import { ArrowLeft } from "lucide-react"

interface InputProps {
    number: number
    onClick: (val: number) => any
}

function InputButton({ number, onClick }: InputProps) {
    return <div>
        <Button className="text-xl border-b-4 border-black/20 p-9" size="icon" variant="outline" onClick={() => onClick(number)}>{number}</Button>
    </div>
}


interface InputCategoryProps {
    isActive: boolean
    number: number
    label: string
}

function InputCategory({ isActive, number, label }: InputCategoryProps) {
    return (
        <div className="flex flex-col">
            <div className={`${isActive ? "font-bold" : ""} text-center`}>{label}</div>
            <div className={`${isActive ? "border-2 border-black/80" : "border-black/40"} p-3.5 border rounded-md text-2xl grid place-items-center`} >
                <div>{number == -1 ? "-" : number}</div>
            </div>
        </div>
    )
}


export function NumberInput({ props, onAccept }: {
    props: NumberInputProps,
    onAccept: (val: number, val1: number, val2: number) => any
}) {
    const { defaultPrice, defaultQuantity, productName } = props
    const defaultTotal = defaultPrice * defaultQuantity
    const [price, setPrice] = useState(defaultPrice)
    const [qty, setQty] = useState(defaultQuantity)
    const [total, setTotal] = useState(defaultTotal)

    const [activeInput, setActiveInput] = useState('price')
    function setNumber(new_number: number) {
        function getNewNumber(old: number) {
            return parseInt(`${old.toString()}${new_number.toString()}`)
        }
        switch (activeInput) {
            case "price": setPrice(getNewNumber(price)); setTotal(getNewNumber(price) * qty); break;
            case "quantity": setQty(getNewNumber(qty)); setTotal(price * getNewNumber(qty)); break;
            case "total": setTotal(getNewNumber(total)); break;
        }
    }
    function resetButton() {
        function removeFirstDigit(num: number) {
            const numStr = num.toString();
            if (numStr.length === 1) {
                return 0;
            }
            return Math.floor(num / 10);
        }
        switch (activeInput) {
            case "price": {
                const new_price = removeFirstDigit(price)
                setPrice(new_price);
                setTotal(new_price * qty)
            }
                break;
            case "quantity": {
                const new_qty = removeFirstDigit(qty)
                setQty(new_qty);
                setTotal(price * new_qty)
            } break;
            case "total": { setTotal(removeFirstDigit(total)); setPrice(-1); } break;
        }
    }
    return (
        <div className="grid place-items-center">
            <div className="border-b text-2xl border-black">
                {productName}
            </div>
            <div className="flex m-4 gap-2 items-center flex-wrap justify-center">
                <div onClick={() => setActiveInput("price")}>
                    <InputCategory number={price} isActive={activeInput == 'price'} label="Price" />
                </div>
                <div className="mt-4">x</div>
                <div onClick={() => setActiveInput("quantity")}>
                    <InputCategory number={qty} isActive={activeInput == 'quantity'} label="Quantity" />
                </div>
                <div className="mt-4">=</div>
                <div onClick={() => setActiveInput("total")}>
                    <InputCategory number={total} isActive={activeInput == 'total'} label="Total" />
                </div>

            </div>
            <div className="grid grid-cols-3 gap-2 ">
                {[...Array(9)].map((_, i) => i + 1).map(ele => <InputButton number={ele} onClick={setNumber} key={ele} />)}
                <Button className="[&_svg]:size-8 border-b-4 border-black/40 p-9" size="icon" variant="outline" onClick={resetButton}>
                    <ArrowLeft />
                </Button>
                <InputButton number={0} onClick={() => setNumber(0)} />
                <Button className="border-b-4 border-black/40 p-9 text-xl" size="icon" onClick={() => onAccept(price, qty, total)}>OK</Button>
            </div>
        </div>
    )
}

interface Props {
    dialogOpen: boolean
    setDialogOpen: Dispatch<SetStateAction<boolean>>
    children: ReactNode
}

export function ModalNumberInput({ dialogOpen, setDialogOpen, children }: Props) {
    return <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle></DialogTitle>
                <DialogDescription>
                </DialogDescription>
            </DialogHeader>
            {children}
        </DialogContent>
    </Dialog>
}