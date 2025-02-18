import React, { useState, useEffect, useRef } from 'react';

const VirtualizedTable = ({ data }) => {
  const rowHeight = 50; // Height of each row (in pixels)
  const containerHeight = 400; // Height of the container (in pixels)
  const buffer = 5; // Number of extra rows to render above and below

  const [visibleRows, setVisibleRows] = useState([]);
  const [startIndex, setStartIndex] = useState(0);
  const containerRef = useRef(null);

  // Calculate the total height of the table (useful for scrolling)
  const totalHeight = data.length * rowHeight;

  // Handle the scroll event to calculate which rows should be visible
  const onScroll = () => {
    const scrollTop = containerRef.current.scrollTop;
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
    setVisibleRows(data.slice(newStartIndex, newEndIndex + 1)); // Slice the visible rows
  };

  // Update visible rows when the component mounts or when the data changes
  useEffect(() => {
    onScroll(); // Initial calculation for rendering visible rows
    const container = containerRef.current;

    // Attach the scroll event listener
    container.addEventListener('scroll', onScroll);

    // Cleanup listener on unmount
    return () => {
      container.removeEventListener('scroll', onScroll);
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
        border: '1px solid #ddd',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleRows.map((item, index) => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              top: (startIndex + index) * rowHeight, // Position each row
              height: rowHeight,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              borderBottom: '1px solid #ddd',
              backgroundColor: index % 2 === 0 ? '#f9f9f9' : '#fff',
              cursor: 'pointer',
            }}
            onClick={() => alert(`Clicked on ${item.name}`)} // Example onClick for a row
          >
            <div style={{ width: '100px' }}>{item.id}</div>
            <div style={{ flex: 1 }}>{item.name}</div>
            <div style={{ width: '100px' }}>{item.age}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const App = () => {
  const data = new Array(1000000).fill(null).map((_, index) => ({
    id: index + 1,
    name: `Name ${index + 1}`,
    age: 20 + (index % 50),
  }));

  return (
    <div>
      <h1>Virtualized Table Example</h1>
      <VirtualizedTable data={data} />
    </div>
  );
};

export default App;
