import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { useNavigate } from "@remix-run/react";
import { deleteGood } from "~/data/dexie";
import { Button } from "../ui/button";
import { Pencil, Trash } from "lucide-react";
import { Dispatch, SetStateAction, useContext } from "react";
import { MenuContext } from "~/lib/open_provider";


interface Props {
  data: DexieGood[]
  filter_string: string
  setGood: Dispatch<SetStateAction<DexieGood | undefined>>
  catString: string
}

export function TableDemo({ data, filter_string, setGood, catString }: Props) {
  const { setOpen } = useContext(MenuContext)
  const navigate = useNavigate();
  return (
    <Table>
      {/* <TableCaption></TableCaption> */}
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Name</TableHead>
          <TableHead>Quantity</TableHead>
          <TableHead>Categories</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead className="text-right">Actions</TableHead>

        </TableRow>
      </TableHeader>
      <TableBody>
        {data
          .filter((val) => filter_string.length > 2 ? val.name.toLowerCase().includes(filter_string) : true)
          .filter((val) => catString == "all" ? true : val.categories.includes(catString))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((subdata, index) => (
            <TableRow key={subdata.id} className="cursor-pointer" onClick={() => false && navigate(`./${subdata.id}`)}>
              <TableCell className="font-medium flex flex-col">
                <div>{subdata.name}</div>
                <div className="text-sm text-foreground/60">{subdata?.size}</div>

              </TableCell>
              <TableCell>{subdata.physical.reduce((sum, item) => sum + item.quantity, 0)}</TableCell>
              <TableCell>{subdata.categories}</TableCell>
              <TableCell className="text-right">{subdata.selling_price}</TableCell>
              <TableCell className="text-right space-x-1.5">
                <Button variant="outline" size="icon" onClick={() => subdata.id && deleteGood(subdata.id)}><Trash /></Button>
                <Button variant="outline" size="icon" onClick={() => { subdata.id && setOpen(true); setGood(subdata); }}><Pencil /></Button>
              </TableCell>

            </TableRow>
          ))}
      </TableBody>
    </Table >
  )
}
