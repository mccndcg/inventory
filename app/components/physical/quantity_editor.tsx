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
    editExpiration: boolean

}

interface DateProps {
    date?: Date,
    setDate: Dispatch<SetStateAction<Date | undefined>>
}

function DatePicker({ date, setDate }: DateProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    return <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
                onSelect={(e)=> {setDate(e); setIsCalendarOpen(false)}}
                initialFocus
            />
        </PopoverContent>
    </Popover>
}

export function NumberInput({ product, onOk, initial, editExpiration }: Props) {
    const [val, setVal] = useState(initial.quantity)
    const [date, setDate] = useState<Date | undefined>(initial.expiration_date)
    return <div className="grid place-items-center">
        <div className="border-b text-2xl border-black mb-2">
            {product}
        </div>
        {
            editExpiration ? <DatePicker date={date} setDate={setDate} /> :
                <div className="mb-4">
                    {initial.expiration_date ? format(initial.expiration_date, 'PPP') : 'No Expiration'}
                </div>

        }
        <InputCategory isActive={true} number={val} label="Quantity" />
        <div className="mt-4">
            <NumberKeyboard
                onOkay={() => onOk(val, date)}
                inputDispatch={setVal} inputValue={val} />
        </div>
    </div>
}