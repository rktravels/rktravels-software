"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Clock, Check, X, RotateCcw } from "lucide-react";

interface CustomTimePickerProps {
  value: string; // "HH:mm" (24-hour format, e.g., "14:30")
  onChange: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  align?: "left" | "right" | "auto";
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1 to 12
const MINUTES = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
];

export function CustomTimePicker({
  value,
  onChange,
  placeholder = "Select time...",
  disabled = false,
  className = "",
  id,
  align = "auto",
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverAlign, setPopoverAlign] = useState<"left" | "right">(
    align === "right" ? "right" : "left"
  );

  // Parse current value into 12-hour components
  const parsedTime = useMemo(() => {
    if (!value) return { hour12: 9, minute: "00", period: "AM" as "AM" | "PM" };
    const [hStr, mStr] = value.split(":");
    let h = parseInt(hStr || "9", 10);
    const m = (mStr || "00").padStart(2, "0");
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { hour12: h, minute: m, period };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState(parsedTime.hour12);
  const [selectedMinute, setSelectedMinute] = useState(parsedTime.minute);
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">(
    parsedTime.period
  );

  // Sync internal state when external value changes
  useEffect(() => {
    setSelectedHour(parsedTime.hour12);
    setSelectedMinute(parsedTime.minute);
    setSelectedPeriod(parsedTime.period);
  }, [parsedTime]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Adjust alignment dynamically to stay within screen/drawer bounds
  useEffect(() => {
    if (align === "right") {
      setPopoverAlign("right");
      return;
    }
    if (align === "left") {
      setPopoverAlign("left");
      return;
    }
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 265;
      const parentDrawer = containerRef.current.closest(".max-w-3xl, [role='dialog'], .overflow-y-auto");
      const boundRight = parentDrawer ? parentDrawer.getBoundingClientRect().right : window.innerWidth;
      if (rect.left + popoverWidth > boundRight - 15) {
        setPopoverAlign("right");
      } else {
        setPopoverAlign("left");
      }
    }
  }, [isOpen, align]);

  // Format 12-hour values back into "HH:mm" 24-hour string
  const commitTime = (h12: number, min: string, period: "AM" | "PM") => {
    let h24 = h12;
    if (period === "AM" && h24 === 12) h24 = 0;
    else if (period === "PM" && h24 < 12) h24 += 12;
    const timeStr = `${String(h24).padStart(2, "0")}:${min}`;
    onChange(timeStr);
  };

  // Formatted display for trigger button
  const displayLabel = useMemo(() => {
    if (!value) return "";
    const hStr = String(parsedTime.hour12).padStart(2, "0");
    return `${hStr}:${parsedTime.minute} ${parsedTime.period}`;
  }, [value, parsedTime]);

  const handleSelectHour = (h: number) => {
    setSelectedHour(h);
    commitTime(h, selectedMinute, selectedPeriod);
  };

  const handleSelectMinute = (m: string) => {
    setSelectedMinute(m);
    commitTime(selectedHour, m, selectedPeriod);
  };

  const handleSelectPeriod = (period: "AM" | "PM") => {
    setSelectedPeriod(period);
    commitTime(selectedHour, selectedMinute, period);
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    onChange(`${h}:${m}`);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-xs font-normal ${className}`}
      id={id}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border rounded-[6px] flex items-center justify-between gap-1.5 transition text-left cursor-pointer focus:outline-none ${
          disabled
            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
            : isOpen
            ? "border-[#f16623] ring-1 ring-[#f16623]/20 text-slate-900"
            : "border-slate-200 text-slate-800 hover:border-slate-300"
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Clock
            className={`w-3.5 h-3.5 shrink-0 ${
              isOpen ? "text-[#f16623]" : "text-slate-400"
            }`}
          />
          {value ? (
            <span className="font-mono font-medium text-slate-900">
              {displayLabel}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        {value && !disabled && (
          <span
            onClick={handleClear}
            title="Clear time"
            className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Popover Card (Guaranteed on top with z-[9999]) */}
      {isOpen && (
        <div
          className={`absolute ${
            popoverAlign === "right" ? "right-0" : "left-0"
          } top-[calc(100%+4px)] z-[9999] w-64 bg-white border border-slate-200 rounded-[8px] shadow-2xl p-3 animate-in fade-in-50 zoom-in-95 duration-100`}
        >
          {/* AM / PM Toggle Banner */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              SELECT TIME
            </span>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[5px]">
              {(["AM", "PM"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectPeriod(p)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-[4px] transition ${
                    selectedPeriod === p
                      ? "bg-[#f16623] text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Time Columns: Hours & Minutes */}
          <div className="grid grid-cols-2 gap-2 text-center">
            {/* Hours Column */}
            <div>
              <div className="text-[10px] font-medium text-slate-400 mb-1">
                HOUR
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5">
                {HOURS_12.map((h) => {
                  const isSel = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={`h-7 rounded-[4px] text-xs font-mono transition flex items-center justify-center ${
                        isSel
                          ? "bg-[#f16623] text-white font-medium"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Column */}
            <div>
              <div className="text-[10px] font-medium text-slate-400 mb-1">
                MINUTE
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto pr-0.5">
                {MINUTES.map((m) => {
                  const isSel = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={`h-7 rounded-[4px] text-xs font-mono transition flex items-center justify-center ${
                        isSel
                          ? "bg-[#f16623] text-white font-medium"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Shortcuts */}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetNow}
              className="text-[#f16623] hover:text-[#d9551a] font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Current Time</span>
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="h-6 px-2 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[4px] transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
