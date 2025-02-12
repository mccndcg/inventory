import { form_physical, PhysicalProp, SinglePhysicalProp } from "~/data/physical"
import { Form } from "../ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { Button } from "../ui/button"
import { Plus } from "lucide-react"
import { ModalNumberInput } from "../number_input"
import { NumberInput } from "./quantity_editor"
import { useState } from "react"

interface Props {
    dexie_good: DexieGood
    onSubmitProp: (val: PhysicalProp) => any

}

export function PhysicalForm({ dexie_good, onSubmitProp }: Props) {
    console.log(dexie_good)
    let physical = [{
        quantity: 0
    }]
    if (dexie_good.physical && dexie_good.physical.length > 0) {
        physical = dexie_good.physical
    }
    const { form, fields, update } = form_physical(physical)
    const [openForm, setOpenForm] = useState(false)
    const [initial, setInitial] = useState<undefined | SinglePhysicalProp>()
    const [selIndex, setSelIndex] = useState<undefined | number>()
    const [isEditingExp, setEditExp] = useState(false)
    function updateQuantity(number: number) {
        console.log(number)
        setOpenForm(false)
        selIndex != undefined && update(selIndex, {
            quantity: number
        })
    }
    function openNewExpForm() {

    }
    function openNumberForm(index: number) {
        setInitial(fields[index])
        setSelIndex(index)
        setOpenForm(true)
    }
    return <div className="m-2">
        <ModalNumberInput dialogOpen={openForm} setDialogOpen={setOpenForm}>
            {initial !== undefined && <NumberInput product={dexie_good.name} onOk={updateQuantity} initial={initial} />}
        </ModalNumberInput>
        <div className="text-center text-2xl font-bold">{dexie_good.name}</div>
        <div className=" m-2 border">
            <Form {...form}>
                <Table>
                    {/* <TableCaption></TableCaption> */}
                    <TableHeader>
                        <TableRow>
                            <TableHead>Expiration</TableHead>
                            <TableHead>Quantity</TableHead>

                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {
                            fields.map((ele, index) => <TableRow key={index}>
                                <TableCell>{ele.expiration_date ? ele.expiration_date.toISOString() : 'No Expiration'}</TableCell>
                                <TableCell onClick={() => openNumberForm(index)}>{ele.quantity}</TableCell>
                            </TableRow>)
                        }

                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell >
                                <Button variant="outline">Add Expiration<Plus /></Button>
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table >
            </Form>
        </div>
        <div className="m-2">

            <Button className="w-full">Update</Button>
        </div>
    </div>
}