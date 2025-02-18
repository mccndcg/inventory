import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
// import { deleteGood } from "~/data/dexie";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useInventoryTable } from "./column_def";

interface Props {
  data: DexieGood[];
  filter_string: string;
  setGood: (val: DexieGood) => void;
  setPhysical: (val: DexieGood) => void;
  catString: string;
}

export function TableDemo({
  data,
  filter_string,
  setGood,
  catString,
  setPhysical,
}: Props) {
  const { navigate, inventoryColumns, setOpen, openSidebar } = useInventoryTable({ onClickQuantity });
  function onClickQuantity(val: DexieGood) {
    setPhysical(val);
    setOpen(true);
  }
  const transformed_data = data
    .filter((val) =>
      filter_string.length > 2
        ? val.name.toLowerCase().includes(filter_string)
        : true
    )
    .filter((val) =>
      catString == "all" ? true : val.categories.includes(catString)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const table = useReactTable({
    data,
    columns: inventoryColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <Table>
      {/* <TableCaption>
      </TableCaption> */}
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} onClick={() => false && navigate(`./${row.original.id}`)}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
        {transformed_data.map((subdata) => (
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
              <div className="text-sm text-foreground/60">{subdata?.size}</div>
            </TableCell>
            <TableCell
              onClick={() => {
                setPhysical(subdata);
                setOpen(true);
              }}
            >
              {subdata.physical &&
                subdata.physical.reduce((sum, item) => sum + item.quantity, 0)}
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
