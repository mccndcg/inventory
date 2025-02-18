import { useNavigate } from "@remix-run/react";
import { Button } from "../ui/button";
import { Pencil } from "lucide-react";
import { useContext } from "react";
import { MenuContext } from "~/lib/open_provider";
import { useSidebar } from "../ui/sidebar";
import { useVirtualizedTable } from "~/lib/virtualized_table";

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
  const {
    startIndex,
    rowHeight,
    containerRef,
    containerHeight,
    totalHeight,
    visibleRows,
    endIndex
  } = useVirtualizedTable({ data: transformed_data });
  const context = useContext(MenuContext);
  if (!context) throw Error;
  const { setOpen, setDexieGood } = context;
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  function openSidebar(dexie_good: DexieGood) {
    setDexieGood(dexie_good);
    toggleSidebar();
  }
  return (
    <>
      {rowHeight}
      <div
        className="overflow-y-auto"
        ref={containerRef}
        style={{
          height: containerHeight,
          overflowY: "auto",
          position: "relative",
          border: "1px solid #ddd",
        }}
      >
        <div className={`relative h-[${totalHeight}]`}>
          {visibleRows.map((subdata, index) => (
            <div
              key={subdata.id}
              onClick={() => false && navigate(`./${subdata.id}`)}
              className="grid grid-cols-[200px_1fr_1fr_1fr_1fr]"
              style={{
                position: "absolute",
                top: (startIndex + index) * rowHeight, // Position each row
                height: rowHeight,
                width: "100%",
                // alignItems: "center",
                padding: "0 10px",
                borderBottom: "1px solid #ddd",
                backgroundColor: index % 2 === 0 ? "#f9f9f9" : "#fff",
                cursor: "pointer",
              }}
            >
              <div
                className="font-medium flex flex-col grow"
                onClick={() => openSidebar(subdata)}
              >
                <div>{subdata.name}</div>
                <div className="text-sm text-foreground/60">
                  {subdata?.size}
                </div>
              </div>
              <div
                onClick={() => {
                  setPhysical(subdata);
                  setOpen(true);
                }}
              >
                {subdata.physical &&
                  subdata.physical.reduce(
                    (sum, item) => sum + item.quantity,
                    0
                  )}
              </div>
              <div>{subdata.categories.join(", ")}</div>
              <div className="text-right">{subdata.selling_price}</div>
              <div className="text-right space-x-1.5">
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
