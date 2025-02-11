import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "../ui/input"

import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { Button } from "../ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { addDexieGood } from "~/data/dexie"
import { useContext } from "react"
import { MenuContext } from "~/lib/open_provider"
import toast from "react-hot-toast"
import { categories, registerGoodsSchema } from "./schema"




export function register_goods(def?: z.infer<typeof registerGoodsSchema>) {
    const form = useForm<z.infer<typeof registerGoodsSchema>>({
        resolver: zodResolver(registerGoodsSchema),
        mode: "onChange",
        reValidateMode: "onChange",
        defaultValues: def || {
            name: "",
            selling_price: undefined,
            size: "",
            categories: []
        },
    })
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: 'categories',
    });
    return { form, append, remove }
}


interface Props {
    def?: z.infer<typeof registerGoodsSchema>
    onSubmitProp?: (val: z.infer<typeof registerGoodsSchema>) => any
}

export default function RegisterGoods({ def, onSubmitProp }: Props) {
    const { form, append, remove } = register_goods(def)
    const categories_arr = form.watch('categories')
    const { open, setOpen } = useContext(MenuContext)

    function onSubmit(val: z.infer<typeof registerGoodsSchema>) {
        addDexieGood({
            name: val.name,
            selling_price: val.selling_price,
            categories: val.categories,
            size: val.size,
            physical: []
        })
            .then(() => toast.success("Product Registered"))
            .catch(() => toast.error("Something happened."))
            .finally(() => setOpen(false))
    }
    function modify_array(ele: string) {
        const index = categories_arr.findIndex((val) => val == ele)
        index === -1 ? append(ele) : remove(index)
    }
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitProp || onSubmit, (e) => console.log(e))} className="flex flex-col gap-2 m-2">
                <div>
                    <FormLabel>Good Name</FormLabel>
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input placeholder="Good Name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div>
                    <FormLabel>Selling Price</FormLabel>
                    <FormField
                        control={form.control}
                        name="selling_price"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input placeholder="Selling Price" {...field} type="number" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div>
                    <FormLabel>Size</FormLabel>
                    <FormField
                        control={form.control}
                        name="size"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input placeholder="Size" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex gap-4 flex-wrap justify-center">
                    {
                        categories.map((ele,index) => <div
                            key={index}
                            className={`px-2.5 py-0.5 rounded
                                 ${categories_arr.includes(ele) ? 'bg-primary text-primary-foreground' : 'bg-primary-foreground '
                                }`}
                            onClick={() => modify_array(ele)}>{ele}</div>)
                    }
                </div>
                <Button type="submit">Submit</Button>
            </form>
        </Form>
    )
}