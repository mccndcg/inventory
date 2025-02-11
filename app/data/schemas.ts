import { z } from "zod"


type SalesType = 'sales' | 'stock_in' | 'stock_in' | 'saleless_stock_in' | 'personal_use' | 'spoilage'

const productSchema = z.object({
    product: z.coerce.string().min(3, "Product too short"),
    quantity: z.coerce.number().gt(0, "Invalid"),
    price: z.coerce.number().gt(0, "Invalid"),
    selling_price: z.coerce.number().gt(0, "Invalid"),
    id: z.coerce.number().optional(),
    sold_price: z.coerce.number().optional(),
    orig_selling_price: z.coerce.number().optional()
})

export const goodInSchema = z.object({
    reason: z.enum(['sales', 'stock_in','stock_in', 'saleless_stock_in', 'personal_use','spoilage']),
    date: z.date({
        required_error: "A date is required.",
    }),
    products: z.array(productSchema)
})



export const productOutSchema = z.object({
    product: z.coerce.string().min(3, "Product too short"),
    quantity: z.coerce.number().gt(0),
    price: z.coerce.number().gt(0).optional(),
    selling_price: z.coerce.number().gt(0).optional(),
    id: z.coerce.string().optional(),
    sold_price: z.coerce.number(),
    stock_quantity: z.coerce.number().optional()
})

export const goodOutSchema = z.object({
    reason: z.enum(['sales', 'stock_in','stock_in', 'saleless_stock_in', 'personal_use','spoilage']),
    date: z.date({
        required_error: "A date of birth is required.",
    }),
    products: z.array(productOutSchema)
})



export type ProductProp = z.infer<typeof productOutSchema>[]
export type GoodOutProp = z.infer<typeof goodOutSchema>
export type GoodInProp = z.infer<typeof goodInSchema>