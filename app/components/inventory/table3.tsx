import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useNavigate } from "@remix-run/react";
// import { deleteGood } from "~/data/dexie";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { useContext } from "react";
import { MenuContext } from "~/lib/open_provider";
import { useSidebar } from "../ui/sidebar";

interface Props {
  data: DexieGood[];
  filter_string: string;
  setGood: (val: DexieGood) => any;
  setPhysical: (val: DexieGood) => any;
  catString: string;
}

export function TableDemo({
  data,
  filter_string,
  setGood,
  catString,
  setPhysical,
}: Props) {
  const context = useContext(MenuContext);
  if (!context) throw Error;
  const { setOpen, setDexieGood } = context;
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  function openSidebar(dexie_good: DexieGood) {
    setDexieGood(dexie_good)
    toggleSidebar()
  }
  return (
    <Table>
      {/* <TableCaption>
      </TableCaption> */}
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Name</TableHead>
          <TableHead>Qty</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data
          .filter((val) =>
            filter_string.length > 2
              ? val.name.toLowerCase().includes(filter_string)
              : true
          )
          .filter((val) =>
            catString == "all" ? true : val.categories.includes(catString)
          )
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((subdata) => (
            <TableRow
              key={subdata.id}
              className="cursor-pointer"
              onClick={() => false && navigate(`./${subdata.id}`)}
            >
              <TableCell
                className="font-medium flex flex-col"
                onClick={() => openSidebar(subdata)}
              >
                <div>{subdata.name}</div>
                <div className="text-sm text-foreground/60">
                  {subdata?.size}
                </div>
              </TableCell>
              <TableCell
                onClick={() => {
                  setPhysical(subdata);
                  setOpen(true);
                }}
              >
                {subdata.physical.reduce((sum, item) => sum + item.quantity, 0)}
              </TableCell>
              <TableCell>{subdata.categories.join(", ")}</TableCell>
              <TableCell className="text-right">
                {subdata.selling_price}
              </TableCell>
              <TableCell className="text-right space-x-1.5">
                {/* <Button variant="outline" size="icon" onClick={() => subdata.id && deleteGood(subdata.id)}><Trash /></Button> */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    subdata.id && setOpen(true);
                    setGood(subdata);
                  }}
                >
                  <Pencil />
                </Button>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
