import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Minus } from "lucide-react"
import { useSubmitGoodsIn } from "~/data/submit_goods_in"
import { Button } from "../ui/button"

export function ProductComp({ index }: { index: number }) {
    const { form } = useSubmitGoodsIn()
    return (<div className="flex space-x-1.5 items-center">
        <div>{index}</div>
        <FormField
            control={form.control}
            defaultValue=""
            name={`products.${index}.product`}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Product</FormLabel>
                    <FormControl>
                        <Input placeholder="Prod Name" {...field} />
                    </FormControl>
                    <FormDescription>
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            defaultValue={0}
            control={form.control}
            name={`products.${index}.quantity`}
            render={({ field }) => (
                <FormItem className="shrink">
                    <FormLabel>Qty</FormLabel>
                    <FormControl>
                        <Input {...field} type="number" />
                    </FormControl>
                    <FormDescription>
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            defaultValue={0}
            control={form.control}
            name={`products.${index}.price`}
            render={({ field }) => (
                <FormItem >
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                        <Input {...field} type="number" />
                    </FormControl>
                    <FormDescription>
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        <FormField
            defaultValue={0}
            control={form.control}
            name={`products.${index}.selling_price`}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Sell Price</FormLabel>
                    <FormControl>
                        <Input {...field} type="number" />
                    </FormControl>
                    <FormDescription>
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
        <div>
            <Button size="icon" variant="outline" className="shadow-lg"><Minus /></Button>

        </div>
    </div>
    )
}
