import { Link } from "@remix-run/react";
import { ChevronLeft, Trash } from "lucide-react";
import { useState } from "react";
import { SidebarGoods } from "~/components/good_sidebar/sidebar";
import { categories } from "~/components/register_goods/schema";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { InventoryTable } from "./InventoryTable";

export default function Inventory() {
  const [filterString, setFilterString] = useState("");
  // const setString = debounce((e: any) => setFilterString(e.target.value), 500)
  const [catFilter, setCatFilter] = useState("all");
  function reset() {
    setFilterString("");
    setCatFilter("all");
  }
  return (
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
            <InventoryTable filterString={filterString} catString={catFilter} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
