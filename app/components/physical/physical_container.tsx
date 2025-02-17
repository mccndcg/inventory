import { form_physical, PhysicalProp, SinglePhysicalProp } from "~/data/physical"
import { Form } from "../ui/form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table"
import { Button } from "../ui/button"
import { Plus, X } from "lucide-react"
import { ModalNumberInput } from "../number_input"
import { NumberInput } from "./quantity_editor"
import { useState } from "react"
import { format } from "date-fns"
import { isSameDate } from "~/lib/utils"

interface Props {
    dexie_good: DexieGood
    onSubmitProp: (val: PhysicalProp) => void

}

export function PhysicalForm({ dexie_good, onSubmitProp }: Props) {
    let physical = [{
        quantity: 0
    }]
    if (dexie_good.physical && dexie_good.physical.length > 0) {
        physical = dexie_good.physical
    }
    const { form, fields, update, append, remove } = form_physical(physical)
    const [openForm, setOpenForm] = useState(false)
    const [initial, setInitial] = useState<undefined | SinglePhysicalProp>()
    const [selIndex, setSelIndex] = useState<undefined | number>()
    const [isEditingExp, setEditExp] = useState(false)
    const [isNew, setIsNew] = useState(false)
    function updateQuantity(number: number, expiration_date?: Date) {
        // isNew: true - for new expirations
        setOpenForm(false)
        if (isNew) {
            for(const [index, field] of fields.entries()) {
                if (isSameDate(field.expiration_date, expiration_date)) {
                    update(index, {
                        ...field,
                        quantity: field.quantity + number,
                    })
                    return
                }
            }
            append({
                quantity: number,
                ...(isEditingExp && { expiration_date })
            })
        }
        else {
            selIndex != undefined && update(selIndex, {
                quantity: number,
                ...(isEditingExp && { expiration_date })
            })
        }
    }
    function openNewExpForm() {
        setInitial({
            quantity: 0,
            expiration_date: new Date()
        })
        setOpenForm(true)
        setEditExp(true)
        setIsNew(true)
    }
    function openNumberForm(index: number) {
        setInitial(fields[index])
        setSelIndex(index)
        setEditExp(index === 0 ? false : true)
        setIsNew(false)
        setOpenForm(true)
    }
    return <div className="m-2">
        <ModalNumberInput dialogOpen={openForm} setDialogOpen={setOpenForm}>
            {initial !== undefined && <NumberInput
                product={dexie_good.name}
                onOk={updateQuantity}
                initial={initial}
                editExpiration={isEditingExp} />}
        </ModalNumberInput>
        <div className="text-center text-2xl font-bold">{dexie_good.name}</div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitProp, (errors) => console.log(errors))}>
                <div className="m-2 border mb-10">
                    <Table>
                        {/* <TableCaption></TableCaption> */}
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead>Expiration</TableHead>
                                <TableHead className="bg-primary-foreground">Quantity</TableHead>

                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {
                                fields.map((ele, index) => <TableRow key={index} >
                                    <TableCell>
                                        <div>
                                            {index != 0 ?
                                                <Button size="icon" onClick={() => remove(index)} type="button" variant="destructive">
                                                    <X />
                                                </Button> :
                                                <div></div>
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell onClick={() => openNumberForm(index)}>{ele.expiration_date ? format(ele.expiration_date, 'PPP') : 'No Expiration'}</TableCell>
                                    <TableCell className="bg-primary-foreground" onClick={() => openNumberForm(index)}>{ele.quantity}</TableCell>
                                </TableRow>)
                            }

                        </TableBody>
                    </Table >
                </div>
                <div className="m-2 flex gap-2">
                    <Button variant="outline" onClick={openNewExpForm} className="shadow w-full" type="button">Add Expiration<Plus /></Button>
                    <Button className="w-full">Update</Button>
                </div>
            </form>
        </Form>
    </div>
}