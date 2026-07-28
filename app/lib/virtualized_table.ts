import { useEffect, useRef, useState } from "react";

const rowHeight = 50; // Height of each row (in pixels)
const containerHeight = 400; // Height of the container (in pixels)
const buffer = 5; // Number of extra rows to render above and below

interface Props {
  data: DexieGood[];
}

export function useVirtualizedTable({ data }: Props) {
  const [visibleRows, setVisibleRows] = useState<DexieGood[]>([]);
  const [startIndex, setStartIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the total height of the table (useful for scrolling)
  const totalHeight = data.length * rowHeight;

  // Update visible rows when the component mounts or when the data changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Handle the scroll event to calculate which rows should be visible
    const onScroll = () => {
      const scrollTop = container.scrollTop;

      const visibleCount = Math.ceil(containerHeight / rowHeight); // Rows that fit in the container

      const newStartIndex = Math.max(
        0,
        Math.floor(scrollTop / rowHeight) - buffer
      ); // Start rendering rows above the viewport for smooth scrolling

      const newEndIndex = Math.min(
        data.length - 1,
        newStartIndex + visibleCount + buffer * 2
      ); // Ensure we don't go beyond the end of the data

      setStartIndex(newStartIndex);
      setVisibleRows(data.slice(newStartIndex, newEndIndex + 1));
    };
    onScroll();

    // Attach the scroll event listener
    container.addEventListener("scroll", onScroll);

    // Cleanup listener on unmount
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [data]);
  return {
    totalHeight,
    visibleRows,
    startIndex,
    rowHeight,
    containerHeight,
    containerRef,
  };
}
