import { useState, useRef, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover-dialog";
import { getDexieGoodsByPrefix } from "~/data/dexie";
import { ProductMenu } from "./goods/product_menu";
import { closePopover } from "~/lib/utils";

interface Props {
  onSelectProd(input: DexieGood | null): void;
  labelString?: string;
}
export default function ProductSearch({ onSelectProd, labelString }: Props) {
  const [searchString, setSearchString] = useState("");
  const [productsFound, setProductsFound] = useState<DexieGood[] | null>();
  const [openPopover, setOpenPopover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Set focus to the input when the component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  function onProductSearch(value: string) {
    setSearchString(value);
    searchProduct(value);
  }
  function searchProduct(product_search: string) {
    if (product_search.length > 2) {
      getDexieGoodsByPrefix(product_search).then((value) => {
        setProductsFound(value.length > 0 ? value : null);
      });
    } else {
      setProductsFound(null);
    }
  }
  function addProductFields(index: number) {
    setOpenPopover(false);
    setSearchString("");
    console.log(index);
    if (!productsFound) return;
    const found_product = productsFound[index];
    onSelectProd(found_product);
  }
  return (
    <>
      <div className="grow">
        <Label>{labelString || "Add new product:"}</Label>
        <div>
          <Popover open={openPopover} onOpenChange={setOpenPopover}>
            <PopoverTrigger className="w-full">
              <Input
                ref={inputRef}
                placeholder="Product Name"
                onChange={(e) => onProductSearch(e.target.value)}
                value={searchString}
                className="w-full"
              />
            </PopoverTrigger>
            <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()}>
              {productsFound ? (
                <ProductMenu
                  list_index={0}
                  products={productsFound}
                  onClick={(index: number) => addProductFields(index)}
                />
              ) : (
                "No product found."
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  );
}
