import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { format } from "date-fns";

interface Props {
  dexieGood: DexieGood;
}
export function ExpirationTable({ dexieGood }: Props) {
  return (
    <Table className="border rounded">
      <TableHeader>
        <TableRow>
          <TableHead>Expiration</TableHead>
          <TableHead className="bg-primary-foreground border-l-2">Quantity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dexieGood.physical && dexieGood.physical.map((ele, index) => (
          <TableRow key={index}>
            <TableCell>
              {ele.expiration_date
                ? format(ele.expiration_date, "PPP")
                : "No Expiration"}
            </TableCell>
            <TableCell className="bg-primary-foreground border-l-2">
              {ele.quantity}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
