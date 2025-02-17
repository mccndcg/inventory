import { Link } from "@remix-run/react";
import { ChevronLeft, Trash } from "lucide-react";
import { useContext, useState } from "react";
import { TableDemo } from "~/components/inventory/table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { LinksFunction } from "@remix-run/node";

import styles from "~/loader.css?url";
import { editGood, getInventoryData } from "~/data/dexie";
import { ResponsiveDialog } from "~/components/modal_card";
import OpenProvider, { MenuContext } from "~/lib/open_provider";
import RegisterGoods from "~/components/register_goods/register_goods";
import { z } from "zod";
import {
  categories,
  registerGoodsSchema,
} from "~/components/register_goods/schema";
import toast from "react-hot-toast";
import { PhysicalForm } from "~/components/physical/physical_container";
import { PhysicalProp } from "~/data/physical";
import { updatePhysicalGood } from "~/data/dexie_goods";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SidebarGoods } from "~/components/good_sidebar/sidebar";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
import { useLiveQuery } from "dexie-react-hooks";

function InventoryTable({
  filterString,
  catString,
}: {
  filterString: string;
  catString: string;
}) {
  // const [tableData, setTableData] = useState<DexieGood[]>([]);
  const context = useContext(MenuContext);
  if (!context) throw Error;
  const { setOpen } = context;
  const [selGood, setSelGood] = useState<undefined | DexieGood>();
  const [editMode, setEditMode] = useState<"good" | "physical">("good");

  // useEffect(() => {
  //   getInventoryData().then((val) => setTableData(val));
  // }, []);
  const tableData = useLiveQuery(getInventoryData);

  function openGoodEditor(good: DexieGood) {
    setSelGood(good);
    setEditMode("good");
  }

  function openPhysicalEditor(good: DexieGood) {
    setSelGood(good);
    setEditMode("physical");
  }

  function editPhysicalFunc(val: PhysicalProp) {
    selGood !== undefined &&
      selGood.id &&
      updatePhysicalGood(selGood.id, val.physical)
        .then(() => {
          toast.success("Product Updated");
          // getInventoryData().then((val) => setTableData(val));
        })
        .catch(() => toast.error("Something happened."))
        .finally(() => setOpen(false));
  }

  function editGoodFunc(val: z.infer<typeof registerGoodsSchema>) {
    selGood !== undefined &&
      selGood.id &&
      editGood(selGood.id, selGood, val)
        .then(() => {
          toast.success("Product Updated");
          // getInventoryData().then((val) => setTableData(val));
        })
        .catch(() => toast.error("Something happened."))
        .finally(() => setOpen(false));
  }

  return (
    <>
      <ResponsiveDialog title="Modify Good" hide_trigger={true}>
        {editMode == "good"
          ? selGood !== undefined && (
              <RegisterGoods def={selGood} onSubmitProp={editGoodFunc} />
            )
          : selGood !== undefined && (
              <PhysicalForm
                dexie_good={selGood}
                onSubmitProp={editPhysicalFunc}
              />
            )}
      </ResponsiveDialog>
      {tableData && (
        <TableDemo
          data={tableData}
          filter_string={filterString}
          setGood={openGoodEditor}
          catString={catString}
          setPhysical={openPhysicalEditor}
        />
      )}
    </>
  );
}

export default function Inventory() {
  const [filterString, setFilterString] = useState("");
  // const setString = debounce((e: any) => setFilterString(e.target.value), 500)
  const [catFilter, setCatFilter] = useState("all");
  function reset() {
    setFilterString("");
    setCatFilter("all");
  }
  return (
    <OpenProvider>
      <SidebarProvider defaultOpen={false}>
        <SidebarGoods />
        <SidebarInset className="m-0 p-0">
          <main>
            <div className="sticky top-0 z-10 p-2 bg-background flex flex-col space-y-4 shadow-md">
              <div className="flex">
                <Link to="/">
                  <Button size="icon" variant="outline">
                    <ChevronLeft />
                  </Button>
                </Link>
                <h2 className="text-3xl font-bold tracking-tight ml-4">
                  Inventory
                </h2>
              </div>
              <div className="p-2 border rounded flex space-x-4">
                <Input
                  type="email"
                  placeholder="Product Name"
                  onChange={(e) => setFilterString(e.target.value)}
                  value={filterString}
                />
                <Button size="icon" variant="outline" onClick={() => reset()}>
                  <Trash />
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["all", ...categories].map((ele, index) => (
                  <Button
                    variant="ghost"
                    className="p-0 hover:bg-transparent"
                    key={index}
                    onClick={() => setCatFilter(ele)}
                  >
                    <div
                      className={`${
                        catFilter == ele
                          ? "bg-foreground text-background "
                          : "shadow-md hover:bg-primary-foreground"
                      } cursor-pointer border rounded-lg py-0.5 px-2 `}
                    >
                      {ele}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            <div className="p-4 flex flex-col space-y-4">
              <InventoryTable
                filterString={filterString}
                catString={catFilter}
              />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </OpenProvider>
  );
}
