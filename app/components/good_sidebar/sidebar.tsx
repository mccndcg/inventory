import { useContext } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
} from "../ui/sidebar";
import { MenuContext } from "~/lib/open_provider";
import { ExpirationTable } from "./expiration_table";
import { SidebarSales } from "./sales";
import { TriangleAlertIcon } from "lucide-react";

export function SidebarGoods() {
  const context = useContext(MenuContext);
  if (!context) throw Error;
  const { dexieGood } = context;
  return (
    <Sidebar>
      {dexieGood && dexieGood.id ? (
        <>
          <SidebarHeader className="text-2xl font-bold">
            {dexieGood.name} 
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Expiration</SidebarGroupLabel>
              {dexieGood.physical && dexieGood.physical.length > 0 ? (
                <ExpirationTable dexieGood={dexieGood} />
              ) : (
                <div className="italic flex gap-2">
                  <TriangleAlertIcon />
                  No recorded item yet.
                </div>
              )}
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Sales</SidebarGroupLabel>
              <SidebarSales id={dexieGood.id} />
            </SidebarGroup>
          </SidebarContent>
        </>
      ) : (
        <div></div>
      )}
    </Sidebar>
  );
}
