import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Combines a date picker (calendar popover) with a strict 24-hour time selector.
 * value: ISO-like string "YYYY-MM-DDTHH:mm" (same format as <input type="datetime-local">)
 * The time selector uses two Select components (hour 00-23 and minute 00-59)
 * to guarantee 24-hour display regardless of OS locale.
 */
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function DateTimePicker({ value, onChange, testIdPrefix = "datetime" }) {
  const [open, setOpen] = useState(false);

  let selectedDate = null;
  let hour = "00";
  let minute = "00";
  if (value) {
    const [datePart, timePart] = value.split("T");
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      if (y && m && d) selectedDate = new Date(y, m - 1, d);
    }
    if (timePart) {
      const [hh, mm] = timePart.slice(0, 5).split(":");
      hour = (hh || "00").padStart(2, "0");
      minute = (mm || "00").padStart(2, "0");
    }
  }

  const buildValue = (date, h, m) => {
    if (!date) return "";
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${h}:${m}`;
  };

  const handleDateSelect = (date) => {
    if (!date) return;
    onChange(buildValue(date, hour, minute));
    setOpen(false);
  };

  const setHour = (h) => {
    onChange(buildValue(selectedDate || new Date(), h, minute));
  };
  const setMinute = (m) => {
    onChange(buildValue(selectedDate || new Date(), hour, m));
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 min-w-[160px] justify-start text-left font-normal bg-[#0A0A0A] border-[#262626] text-white hover:bg-[#141414] hover:text-white",
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

      <div className="flex items-center gap-1">
        <Select value={hour} onValueChange={setHour}>
          <SelectTrigger
            className="w-20 bg-[#0A0A0A] border-[#262626] text-white"
            data-testid={`${testIdPrefix}-hour`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
            {HOURS_24.map((h) => (
              <SelectItem key={h} value={h}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-neutral-500">:</span>
        <Select value={minute} onValueChange={setMinute}>
          <SelectTrigger
            className="w-20 bg-[#0A0A0A] border-[#262626] text-white"
            data-testid={`${testIdPrefix}-minute`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#141414] border-[#262626] text-white max-h-72">
            {MINUTES_60.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
