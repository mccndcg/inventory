import { Label } from "~/components/ui/label"
import { Button } from "~/components/ui/button"

import {
    Form,
} from "@/components/ui/form"
import { dexieSalesIn, submit_goods_in } from "~/data/submit_goods_in";
import { DateComp } from "./date";
import { ReasonComp } from "./reason"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { useContext, useEffect, useState } from "react";
import { ProductMenu } from "./product_menu";
import { getDexieGoodsByPrefix } from "~/data/dexie";
import { closePopover } from "~/lib/utils";
import { Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator"
import { X } from "lucide-react";
import { MenuContext } from "~/lib/open_provider";
import toast from "react-hot-toast"

const selection_props = {
    stock_in: "Stock In",
    saleless_stock_in: "Saleless Stock In"
}

const input_class = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
const err_class = "text-[0.8rem] text-destructive"
const displayable_field = {
    product: "Product",
    quantity: "Quantity",
    price: "Prc",
    selling_price: "Sell Price"
}

export function GoodsInForm() {
    const { form, onSubmit, fields, append, remove, update, default_value } = submit_goods_in()
    const [productsFound, setProductsFound] = useState<DexieGood[] | null>()
    const product_watcher = form.watch("products")
    const { open, setOpen } = useContext(MenuContext)

    const total_price = product_watcher?.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    function setProductFields(index: number, list_index: number) {
        closePopover()
        if (!productsFound) return
        const found_product = productsFound[index]
        update(list_index, {
            product: found_product.name,
            price: 12,
            selling_price: found_product.selling_price,
            quantity: 1,
            id: found_product.id,
            orig_selling_price: found_product.selling_price
        })
    }
    function searchProduct(product_search: string, index: number) {
        if (product_search.length > 2) {
            getDexieGoodsByPrefix(product_search).then(
                (value) => {
                    setProductsFound(value.length > 0 ? value : null)
                }
            )
        }
        else {
            setProductsFound(null)
        }
    }
    function closeDialog(success: boolean) {
        setOpen(false)
        success ? toast.success("Goods Added"): toast.error("Error Occured.")
    }
    return <div >
        <Form {...form}>
            <form onSubmit={form.handleSubmit((val: any) => { dexieSalesIn(val, closeDialog) }, (errors) => console.log(errors))} className="grid w-full items-center gap-4">
                <div className="flex space-x-1.5 border rounded p-2">
                    <DateComp form={form} />
                    <div className="w-full">
                        <ReasonComp form={form} selection={selection_props} />
                    </div>
                </div>
                <div className="flex flex-col border rounded p-2 shadow-md">
                    {fields.length > 0 && <>
                        <Separator className="my-4" />
                        <div className="grid grid-cols-[25px_1fr_1fr_1fr_1fr_40px] mb-4 gap-1">
                            {/* <div className="grid grid-cols-[25px_1fr_150px_120px_120px_40px] mb-4"> */}
                            <div></div>
                            <Label className="font-bold">Product</Label>
                            <Label className="font-bold ">Qty</Label>
                            <Label className="font-bold">Price</Label>
                            <Label className="text-right font-bold mr-2">Sell Price</Label>
                            <div></div>
                        </div>
                    </>}
                    {fields.map((field, index) => {
                        return (
                            <div key={field.id} className="grid grid-cols-[25px_1fr_1fr_1fr_1fr_40px] gap-1">
                                <div className="font-bold">{`${index + 1}).`}</div>
                                {Object.keys(field).map((ele: keyof Product, subindex) => {
                                    if (Object.keys(displayable_field).includes(ele)) {
                                        const error = form.formState.errors?.products?.[index]?.[ele]
                                        return <div key={`${field.id}-${subindex}`}>

                                            {ele == "product" ? <Popover>
                                                <PopoverTrigger >
                                                    <input
                                                        autoComplete="off"
                                                        onInput={(e) => searchProduct(e.target.value, index)}
                                                        {...form.register(`products.${index}.${ele}` as const,)}
                                                        defaultValue={field[ele]}
                                                        className={input_class}
                                                        type="text"
                                                    />
                                                </PopoverTrigger>
                                                <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()}>
                                                    {productsFound ?
                                                        <ProductMenu
                                                            list_index={index}
                                                            products={productsFound}
                                                            onClick={setProductFields} />
                                                        : "No product found."}
                                                </PopoverContent>
                                            </Popover> : <input
                                                autoComplete="off"
                                                {...form.register(`products.${index}.${ele}` as const,)}
                                                defaultValue={field[ele]}
                                                className={input_class}
                                                type="number"
                                            />
                                            }
                                            {error?.message && <p className={err_class}>{error?.message}</p>}

                                        </div>
                                    }


                                })}
                                <Button variant="outline" size="icon" onClick={() => remove(index)}>
                                    <X />
                                </Button>

                            </div>
                        )
                    })}
                    <Button variant="outline" className="mt-2 shadow-md" onClick={() => append(default_value)}>Add<Plus /></Button>
                </div>
                <hr className="h-px my-2 bg-gray-200 border-0 dark:bg-gray-700" />
                <div className="flex justify-items-center">
                    <Label htmlFor="name">Grand Total:</Label>
                    <span className="ml-auto  font-bold text-2xl">₱ {total_price}</span>
                </div>

                <Button type="submit">Submit</Button>
            </form>
        </Form>



    </div>
}