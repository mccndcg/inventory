
interface Product {
    product: string
    price: number
    selling_price: number
    quantity: number
}

interface PhysicalGood {
    expiration_date?: Date
    quantity: number
}

interface DexieGood {
    id?: string
    categories: string[]
    name: string
    selling_price: number
    physical: PhysicalGood[]
    name_prefix?: string
    size?: string
}


interface ItemSale {
    name: string
    id?: string
    orig_price: number
    selling_price: number
    sold_price?: number
    quantity: number
}


type SalesType = 'sales' | 'stock_in' | 'stock_in' | 'saleless_stock_in' | 'personal_use' | 'spoilage'

interface InventoryTable {
    id?: string
    name: string
    quantity: number
    price: number
    size?: string
}

interface UpdateInput {
    selling_price: number
    name: string
    id?: number
    physical: PhysicalGood
}



interface DexieSales {
    id?: string
    items: ItemSale[]
    tx_date: Date
    type: SalesType
    tx_date_idx: number
    is_good_in: boolean
}


interface NumberInputProps {
    defaultPrice: number
    defaultQuantity: number
    productName: string
}

interface DexieCOH {
    id?: string
    date: number
    total_sales: number
    current_coh: number
}

interface SalesObject {
    [key: string]: DexieSales[];
}