import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";


const physical = z.object({
    expiration_date: z.date().optional(),
    quantity: z.number()
})
const physicalSchema = z.object({
    physical: z.array(physical)
})
export type PhysicalProp = z.infer<typeof physicalSchema>

export function form_physical() {
    const form = useForm<PhysicalProp>({
        resolver: zodResolver(physicalSchema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: {
            physical: []
        },
    })
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: 'physical',
    });
    return { form, fields, append, remove, update }
}