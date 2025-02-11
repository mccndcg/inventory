import { z } from "zod"

export const registerGoodsSchema = z.object({
    name: z.string().min(3),
    selling_price: z.coerce.number().gt(0),
    size: z.string().optional(),
    categories: z.array(z.string())
})


export const categories = ["drink", "beauty", "medicine", "canned", "condiment", "snacks", "food", "etc", "home"]