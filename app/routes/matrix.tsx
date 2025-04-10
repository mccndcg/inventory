import { useEffect, useRef } from "react";

const colors = [
  "#F72585",
  "#B5179E",
  "#7209B7",
  "#560BAD",
  "#480CA8",
  "#3A0CA3",
  "#F15BB5",
  "#FEE440",
  "#FF6B6B",
  "#FFA600",
];

export default function Matrix() {
  const ref = useRef<HTMLCanvasElement>(null!);
  // Fullskärm

  // Färgpalett

  const columns = 256;
  const drops: number[] = [];
  useEffect(() => {
    const s = window.screen;
    const w = (ref.current.width = s.width);
    const h = (ref.current.height = s.height);
    const ctx = ref.current.getContext("2d");
    for (let i = 0; i < columns; i++) drops[i] = 1;
    const randomChar = () => String.fromCharCode(0x3000 + Math.random() * 33);
    if (!ctx) return;
    const createdInterval = setInterval(() => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < drops.length; i++) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillText(randomChar(), i * 10, drops[i] * 10);

        if (drops[i] * 10 > h && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }, 33);
    return () => {
      try {
        clearInterval(createdInterval);
      } catch (error) {
        error
      }
    };
  }, []);

  return (
    <div className=" w-[500px] h-[300px] overflow-hidden">
      <canvas ref={ref} className="h-[900px] w-[1200px]"></canvas>
    </div>
  );
}
