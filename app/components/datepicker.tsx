"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover"
export const controls = [{
  label: "Today",
  state: "today",
  dateGetter: () => {
    return {
      from: new Date(),
      to: undefined,
    }
  }
},
{
  label: "Last Week",
  state: "last_week",
  dateGetter: () => {
    return {
      from: addDays(new Date(), -7),
      to: new Date(),
    }
  }
},
{
  label: "Last Month",
  state: "last_month",
  dateGetter: () => {
    return {
      from: addDays(new Date(), -30),
      to: new Date(),
    }
  }
}
]

interface Props {
  date: DateRange,
  setDate: React.Dispatch<React.SetStateAction<DateRange>>
}

export function DatePickerDemo({ date, setDate }: Props) {
  const [calendarState, setCalendarState] = React.useState("last_week")
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            " justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "LLL dd, y")} -{" "}
                {format(date.to, "LLL dd, y")}
              </>
            ) : (
              format(date.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="m-2 flex gap-2 flex-wrap justify-center">
          {
            controls.map((ele, index) => <Button
              variant={calendarState == ele.state ? "default" : "outline"}
              onClick={() => {
                setCalendarState(ele.state)
                setDate(ele.dateGetter())
                setOpen(false)
              }}
              key={index}
            >{ele.label}
            </Button>)
          }

        </div>
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={(val) => val && setDate(val)}
          numberOfMonths={2}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
