import { Dispatch, SetStateAction, useState } from "react"
import { InputCategory, NumberKeyboard } from "../number_input"
import { SinglePhysicalProp } from "~/data/physical"

import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Props {
    product: string
    onOk: (val: number, expiration_date?: Date) => any
    initial: SinglePhysicalProp
    editExpiration?: true

}

interface DateProps {
    date?: Date,
    setDate: Dispatch<SetStateAction<Date | undefined>>
}

function DatePicker({ date, setDate }: DateProps) {
    return <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                )}
            >
                <CalendarIcon />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
            />
        </PopoverContent>
    </Popover>
}

export function NumberInput({ product, onOk, initial, editExpiration }: Props) {
    const [val, setVal] = useState(initial.quantity)
    const [date, setDate] = useState<Date | undefined>(initial.expiration_date)
    return <div className="grid place-items-center">
        <div className="border-b text-2xl border-black">
            {product}
        </div>
        {
            editExpiration ? <DatePicker date={date} setDate={setDate} /> :
                <div className="mb-4">
                    {initial.expiration_date ? initial.expiration_date?.toISOString() : 'No Expiration'}
                </div>

        }
        <InputCategory isActive={true} number={val} label="Quantity" />
        <div className="mt-4">
            <NumberKeyboard
                onOkay={() => onOk(val)}
                inputDispatch={setVal} inputValue={val} />
        </div>
    </div>
}