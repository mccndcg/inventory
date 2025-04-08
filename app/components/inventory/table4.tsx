import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useInventoryTable } from "./column_def";
import { useMemo } from "react";

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
  const { navigate, inventoryColumns } = useInventoryTable({
    onClickQuantity: setPhysical,
    onEditGood: (good: DexieGood) => {
      setGood(good);
      console.log("Here");
    },
  });

  const transformed_data = useMemo(
    () =>
      data
        .filter((val) =>
          filter_string.length > 2
            ? val.name.toLowerCase().includes(filter_string)
            : true
        )
        .filter((val) =>
          catString == "all" ? true : val.categories.includes(catString)
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data, catString, filter_string]
  );
  const table = useReactTable({
    data: transformed_data,
    columns: inventoryColumns,
    getCoreRowModel: getCoreRowModel(),
  });
  return (
    <Table>
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
          <TableRow
            key={row.id}
            data-state={row.getIsSelected() && "selected"}
            // onClick={() => false && navigate(`./${row.original.id}`)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
