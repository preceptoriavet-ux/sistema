import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";

const toDate = (s) => { if (!s) return undefined; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

export const DateInput = ({ value, onChange, placeholder = "dd/mm/aaaa", className = "", testId }) => {
  const [open, setOpen] = useState(false);
  const sel = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`w-full justify-start font-normal ${value ? "" : "text-muted-foreground"} ${className}`} data-testid={testId}>
          <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />{fmt(value) || placeholder}
          {value && <X className="ml-auto h-3.5 w-3.5 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(""); }} data-testid={testId && `${testId}-limpar`} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" locale={ptBR} selected={sel} defaultMonth={sel} captionLayout="dropdown-buttons" fromYear={1990} toYear={new Date().getFullYear() + 2}
          classNames={{ caption_label: "hidden", caption_dropdowns: "flex gap-1.5", dropdown: "rounded-md border bg-card px-1.5 py-1 text-sm capitalize", vhidden: "sr-only", dropdown_icon: "hidden" }}
          onSelect={(d) => { onChange(d ? toStr(d) : ""); setOpen(false); }} initialFocus />
      </PopoverContent>
    </Popover>
  );
};
