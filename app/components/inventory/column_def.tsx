import { createColumnHelper } from "@tanstack/react-table";
import { useNavigate } from "@remix-run/react";
import { Pencil } from "lucide-react";
import { Button } from "../ui/button";

const columnHelper = createColumnHelper<DexieGood>();

interface Props {
  onClickQuantity: (good: DexieGood) => void;
  onEditGood: (good: DexieGood) => void;
}

export function useInventoryTable({ onClickQuantity, onEditGood }: Props) {
  const navigate = useNavigate();

  const inventoryColumns = [
    columnHelper.accessor((row) => row.name, {
      header: "Name",
      cell: (props) => (
        <>
          <div onClick={() => false && navigate(`./${props.row.original.id}`)}>
            {props.getValue()}
          </div>
          <div className="text-sm text-foreground/60">
            {props.row.original?.size}
          </div>
        </>
      ),
    }),
    columnHelper.accessor((row) => row.physical, {
      header: "Qty",
      cell: (props) => (
        <button
          type="button"
          onClick={() => onClickQuantity(props.row.original)}
        >
          {props.getValue()?.reduce((sum, item) => sum + item.quantity, 0) ?? 0}
        </button>
      ),
    }),
    columnHelper.accessor((row) => row.categories, {
      header: "Categories",
      cell: (props) => <div>{props.row.original.categories.join(", ")}</div>,
    }),
    columnHelper.accessor((row) => row.selling_price, {
      header: "Price",
    }),
    columnHelper.accessor((row) => row.selling_price, {
      header: "Actions",
      cell: (props) => {
        const subdata = props.row.original;
        return (
          <div className="text-right space-x-1.5">
            {/* <Button
              variant="outline"
              size="icon"
              onClick={() => subdata.id && deleteGood(subdata.id)}
            >
              <Trash />
            </Button> */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                onEditGood(subdata);
              }}
            >
              <Pencil />
            </Button>
          </div>
        );
      },
    }),
  ];
  return { navigate, inventoryColumns };
}
