import { useState, useEffect } from "react";

const useCurrentDateTime = () => {
  const [currentDateTime, setCurrentDateTime] = useState({
    date: "",
    time: "",
  });

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const date = now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
      });
      const time = now.toLocaleString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });

      setCurrentDateTime({ date, time });
    };

    updateDateTime(); // Set initial date and time
    const intervalId = setInterval(updateDateTime, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  return currentDateTime;
};

export function QuickReport() {
  const { date, time } = useCurrentDateTime();
  return (
    <div className="size-32 rounded flex border flex-col text-2xl">
      <div className="grow"></div>
      <div className="text-4xl space-x-2">
        <span>hi!</span>
        <span className="italic font-thin">it's</span>
      </div>
      <div>{time}</div>
      <div>{date}</div>

      {/* <div className="grow flex center flex-col">
        <div className="text-center uppercase text-sm underline">Expiring</div>
        <div className="text-4xl font-bold grid place-items-center grow">
          <div>4</div>
        </div>
      </div>
      <Separator />
      <div className="grow flex center flex-col bg-primary-foreground">
        <div className="text-center uppercase text-sm underline">Running out</div>
        <div className="text-4xl font-bold grid place-items-center grow">
          <div>4</div>
        </div>
      </div> */}
    </div>
  );
}
