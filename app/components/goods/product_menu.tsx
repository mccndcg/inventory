interface Props {
  products: DexieGood[];
  onClick: CallableFunction;
  list_index: number;
}
// TODO PHYSICAL
export function ProductMenu({ products, onClick, list_index }: Props) {
  return (
    <div>
      {products.map((ele, index) => {
        return (
          <div
            onClick={() => {
              console.log("here");
              onClick(index, list_index);
            }}
            className="cursor-pointer"
            key={index}
          >
            {ele.name}
            {/*({ele.physical.reduce((sum, item) => sum + item.quantity, 0)}) */}
          </div>
        );
      })}
    </div>
  );
}
