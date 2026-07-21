import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Combines a date picker (calendar popover) and a time input (HH:MM).
 * value: ISO-like string "YYYY-MM-DDTHH:mm" (same format as <input type="datetime-local">)
 */
export function DateTimePicker({ value, onChange, testIdPrefix = "datetime" }) {
  const [open, setOpen] = useState(false);

  // Parse value into date and time parts
  let selectedDate = null;
  let timeStr = "00:00";
  if (value) {
    const [datePart, timePart] = value.split("T");
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      if (y && m && d) selectedDate = new Date(y, m - 1, d);
    }
    if (timePart) {
      timeStr = timePart.slice(0, 5);
    }
  }

  const buildValue = (date, time) => {
    if (!date) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${time || "00:00"}`;
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    onChange(buildValue(date, timeStr));
    setOpen(false);
  };

  const handleTimeChange = (e) => {
    const t = e.target.value || "00:00";
    onChange(buildValue(selectedDate || new Date(), t));
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 justify-start text-left font-normal bg-[#0A0A0A] border-[#262626] text-white hover:bg-[#141414] hover:text-white",
              !selectedDate && "text-neutral-500"
            )}
            data-testid={`${testIdPrefix}-date-trigger`}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-[#00F0FF]" />
            {selectedDate ? format(selectedDate, "yyyy/MM/dd") : "選擇日期"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 bg-[#141414] border-[#262626] text-white"
          align="start"
          data-testid={`${testIdPrefix}-calendar-popover`}
        >
          <Calendar
            mode="single"
            selected={selectedDate || undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timeStr}
        onChange={handleTimeChange}
        className="w-28 bg-[#0A0A0A] border-[#262626] text-white"
        data-testid={`${testIdPrefix}-time`}
      />
    </div>
  );
}
