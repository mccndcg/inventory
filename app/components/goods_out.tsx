import { Label } from "~/components/ui/label"
import { Input } from "~/components/ui/input"
import { DatePickerDemo } from "./datepicker"
import { Button } from "~/components/ui/button"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "app/components/ui/select"



export function GoodsOutForm() {
    return <div className="grid w-full items-center gap-4">
        <div className="flex space-x-1.5 border rounded p-2">

            <div className="flex flex-col space-y-1.5">
                <Label htmlFor="framework">Date</Label>
                <DatePickerDemo />
            </div>
            <div className="flex flex-col space-y-1.5">
                <Label htmlFor="framework">Reason</Label>
                <Select>
                    <SelectTrigger>
                        <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectGroup>
                            {/* <SelectLabel>Fruits</SelectLabel> */}
                            <SelectItem value="apple">Sales</SelectItem>
                            <SelectItem value="banana">Personal</SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
        </div>
        <div className="flex space-x-1.5 border rounded p-2 shadow-md">
            <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Product</Label>
                <Input id="name" placeholder="Name of your project" />
            </div>
            <div className="flex flex-col space-y-1.5 w-12">
                <Label htmlFor="name">Qty</Label>
                <Input id="name" defaultValue={1} />
            </div>
            <div className="flex flex-col space-y-1.5 w-24">
                <Label htmlFor="name">Price</Label>
                <Input id="name" defaultValue={1} />
            </div>
        </div>
        <div className="flex flex-col space-y-1.5">
            <Label htmlFor="name">Total</Label>
            <Input id="name" placeholder="Name of your project" />
        </div>
        <Button>Submit</Button>

    </div>
}