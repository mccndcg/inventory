import { createColumnHelper } from "@tanstack/react-table";
import { useNavigate } from "@remix-run/react";

const columnHelper = createColumnHelper<DexieGood>();

interface Props {
  onClickQuantity: (good: DexieGood) => void;
}

export function useInventoryTable({ onClickQuantity }: Props) {
  const navigate = useNavigate();

  const inventoryColumns = [
    columnHelper.accessor((row) => row.name, {
      header: "Name",
      cell: (props) => (
        <div
          onClick={() => false && navigate(`./${props.row.original.id}`)}
        ></div>
      ),
    }),
    columnHelper.accessor((row) => row.name, {
      header: "Qty",
      cell: (props) => (
        <div onClick={() => onClickQuantity(props.row.original)}></div>
      ),
    }),
    columnHelper.accessor((row) => row.categories, {
      header: "Categories",
      cell: (props) => (
        <div>
          {props.row.original &&
            props.row.original.physical.reduce(
              (sum, item) => sum + item.quantity,
              0
            )}
        </div>
      ),
    }),
    columnHelper.accessor((row) => row.selling_price, {
      header: "Price",
    }),
  ];
  return { navigate, inventoryColumns };
}
