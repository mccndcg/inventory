import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { Form } from "@/components/ui/form";
import {
  useSubmitGoodsOut,
} from "~/data/submit_goods_in";
import { DateComp } from "./date";
import { ReasonComp } from "./reason";
import {
  forwardRef,
  ReactNode,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Separator } from "@/components/ui/separator";
import ProductSearch from "../product_search";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { MenuContext } from "~/lib/open_provider";
import { GoodOutProp, ProductProp } from "~/data/schemas";
import { ItemSelector } from "./item_selector";
import { editSales } from "~/data/dexie";
import { ModalNumberInput, NumberInput } from "../number_input";
import { record_dexie_sale, sales2items } from "~/data/dexie_sales";

const selection_props = {
  sales: "Sales",
  personal_use: "Personal Use",
  spoilage: "Spoilage",
};

const grid_class = "grid-cols-[25px_1fr_60px_60px_80px_40px]";

interface Editable {
  products?: ProductProp;
  date?: Date;
  oldId?: string;
  resettter?: () => void;
}

interface Props {
  itemSelector?: ReactNode;
  editObject?: Editable;
  isGoodIn: boolean;
}

const GoodsOutView = forwardRef(
  ({ itemSelector, editObject, isGoodIn }: Props, ref) => {
    const { products, date, oldId, resettter } = editObject || {
      products: undefined,
      date: undefined,
      oldId: undefined,
      resettter: undefined,
    };
    const { form, fields, append, update, remove } = useSubmitGoodsOut(
      products,
      date
    );
    const product_watcher = form.watch("products");
    const total_price = product_watcher?.reduce(
      (sum, item) => sum + item.sold_price * item.quantity,
      0
    );
    const context = useContext(MenuContext);
    if (!context) throw Error;
    const { setOpen } = context;
    const [numberInput, setNumberInput] = useState(false);
    const [defaultInputs, setDefaultInputs] = useState<
      NumberInputProps | undefined
    >();
    const [selectedIndex, setSelectedIndex] = useState<number | undefined>();

    function onProductSelect(found_product: DexieGood) {
      // DEV: Guard to not accept duplicates.
      // for (const field of fields) {
      //     if (found_product.name == field.product) {
      //         toast.error("Product already added.")
      //         return
      //     }
      // }
      found_product.id && append({
        product: found_product.name,
        price: 12,
        selling_price: found_product.selling_price,
        quantity: 1,
        prod_id: found_product.id,
        sold_price: found_product.selling_price,
        stock_quantity: found_product?.physical
          ? found_product.physical.reduce((sum, item) => sum + item.quantity, 0)
          : 0,
      });
    }
    function closeDialog(success: boolean) {
      setOpen(false);
      success ? toast.success("Goods Added") : toast.error("Error Occured.");
    }
    useImperativeHandle(ref, () => ({
      onProductSelect,
    }));
    function onSubmitValid(sales: GoodOutProp) {
      if (oldId) {
        editSales(
          { id: oldId, item: sales2items(sales), date: sales.date },
          closeDialog
        ).finally(() => resettter && resettter());
      } else {
        record_dexie_sale(sales, closeDialog, isGoodIn).finally(
          () => resettter && resettter()
        );
      }
    }
    function onIncreaseQuantity(
      index: number,
      quantity: number,
      increase?: boolean
    ) {
      update(index, {
        ...fields[index],
        quantity: quantity + (increase ? 1 : -1),
      });
    }
    function onEntry(price: number, qty: number, total: number) {
      setDefaultInputs(undefined);
      setNumberInput(false);
      selectedIndex !== undefined &&
        update(selectedIndex, {
          ...fields[selectedIndex],
          quantity: qty,
          sold_price: total,
          price,
        });
      setSelectedIndex(undefined);
    }
    function openNumberInput(
      price: number,
      qty: number,
      product: string,
      index: number
    ) {
      setDefaultInputs({
        defaultPrice: price || 0,
        defaultQuantity: qty,
        productName: product,
      });
      setSelectedIndex(index);
      setNumberInput(true);
    }
    return (
      <div>
        <ModalNumberInput
          dialogOpen={numberInput}
          setDialogOpen={setNumberInput}
        >
          {defaultInputs && (
            <NumberInput props={defaultInputs} onAccept={onEntry} />
          )}
        </ModalNumberInput>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitValid, (errors) =>
              console.log(errors)
            )}
            className="grid w-full items-center gap-4"
          >
            <div className="flex flex-col  border rounded p-2 shadow-md">
              <div className="flex space-x-1.5">
                <DateComp form={form} />
                <div className="w-full">
                  <ReasonComp form={form} selection={selection_props} />
                </div>
              </div>
              <div className="flex gap-2">
                {itemSelector}
                <ProductSearch onSelectProd={onProductSelect} />
              </div>
            </div>
            <ScrollArea className="h-[calc(100dvh-460px)] border">
              {fields.length > 0 && (
                <div className="flex flex-col  rounded p-2 shadow-md">
                  <Separator className="my-4" />
                  <div className={`${grid_class} grid mb-4`}>
                    <div></div>
                    <Label className="font-bold">Product</Label>
                    <Label className="font-bold ">Price</Label>
                    <Label className="font-bold">Qty</Label>
                    <Label className="text-right font-bold">Total</Label>
                    <div></div>
                  </div>

                  {fields.map((field, index) => {
                    return (
                      <div
                        key={field.prod_id}
                        className={`${grid_class} grid gap-1 `}
                      >
                        <div className="font-bold">{`${index + 1}).`}</div>
                        <div
                          key={`${field.prod_id}-product`}
                          className={`${
                            index % 2 == 0 ? "" : "border-black/40"
                          } border-b-2 border-dashed`}
                        >
                          <div
                            onClick={() =>
                              onIncreaseQuantity(index, field.quantity, false)
                            }
                          >
                            {field.product}
                          </div>
                          <div></div>
                        </div>
                        <div
                          className={`${
                            index % 2 == 0 ? "" : "border-black/40"
                          } border-b-2 border-dashed flex space-x-1.5`}
                          onClick={() =>
                            openNumberInput(
                              field.selling_price || 0,
                              field.quantity,
                              field.product,
                              index
                            )
                          }
                        >
                          <div>{field.sold_price}</div>
                        </div>
                        <div
                          className={`${
                            index % 2 == 0 ? "" : "border-black/40"
                          }  border-b-2 border-dashed flex space-x-1.5 pr-1 `}
                          onClick={() =>
                            onIncreaseQuantity(index, field.quantity, true)
                          }
                        >
                          <div>{field.quantity}</div>
                        </div>
                        <div
                          className={`${
                            index % 2 == 0 ? "" : "border-black/40"
                          } 
                                        text-right mr-2 border-l-4 rounded-bl-lg border-b-2`}
                          onClick={() =>
                            openNumberInput(
                              field.selling_price || 0,
                              field.quantity,
                              field.product,
                              index
                            )
                          }
                        >
                          ₱{" "}
                          {field.sold_price
                            ? field.quantity * field.sold_price
                            : 0.0}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => remove(index)}
                        >
                          <X />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <Separator className="my-4" />
            <div className="flex justify-items-center">
              <Label htmlFor="name">Grand Total:</Label>
              <span className="ml-auto font-bold text-2xl">
                ₱ {total_price}
              </span>
            </div>

            <Button type="submit">Submit</Button>
          </form>
        </Form>
      </div>
    );
  }
);

export function GoodsOutForm({ editObject, isGoodIn }: Props) {
  const [itemSelectorMode, setItemSelectorMode] = useState(true);
  const childRef = useRef<{ onProductSelect: (val: DexieGood) => void }>(null);
  function selectItem(val: DexieGood) {
    if (!childRef.current) return;
    childRef.current.onProductSelect(val);
    setItemSelectorMode(true);
  }
  const itemButtonSelector = (
    <Button
      className="mt-6"
      type="button"
      onClick={() => {
        setItemSelectorMode(false);
      }}
    >
      Select Item <Plus />
    </Button>
  );
  return (
    <>
      <div className={`${!itemSelectorMode && "hidden"}`}>
        <GoodsOutView
          ref={childRef}
          itemSelector={itemButtonSelector}
          editObject={editObject}
          isGoodIn={isGoodIn}
        />
      </div>
      <div className={`${itemSelectorMode && "hidden"}`}>
        <ItemSelector
          onProductSelect={selectItem}
          onClick={() => setItemSelectorMode(true)}
        />
      </div>
    </>
  );
}

GoodsOutView.displayName = "GoodsOutView";
