"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  RotateCcw,
} from "lucide-react";

interface CustomDatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  pastYearsCount?: number;
  futureYearsCount?: number;
  align?: "left" | "right" | "auto";
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date...",
  minDate,
  maxDate,
  disabled = false,
  className = "",
  id,
  pastYearsCount = 10,
  futureYearsCount = 5,
  align = "auto",
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [popoverAlign, setPopoverAlign] = useState<"left" | "right">(
    align === "right" ? "right" : "left"
  );

  // Initialize calendar view year and month based on value or today
  const initialDate = useMemo(() => {
    if (value) {
      const [y, m, d] = value.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Generate Year options: present year to 10 previous years + future years up to +5 (or viewYear)
  const years = useMemo(() => {
    const max = Math.max(currentYear + futureYearsCount, viewYear);
    const min = Math.min(currentYear - pastYearsCount, viewYear);
    const list: number[] = [];
    for (let y = max; y >= min; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear, viewYear, pastYearsCount, futureYearsCount]);

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [value]);

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
      const popoverWidth = 295;
      const parentDrawer = containerRef.current.closest(".max-w-3xl, [role='dialog'], .overflow-y-auto");
      const boundRight = parentDrawer ? parentDrawer.getBoundingClientRect().right : window.innerWidth;
      if (rect.left + popoverWidth > boundRight - 15) {
        setPopoverAlign("right");
      } else {
        setPopoverAlign("left");
      }
    }
  }, [isOpen, align]);

  // Generate calendar days for current viewMonth and viewYear
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      day: number;
      month: number;
      year: number;
      isCurrentMonth: boolean;
      dateStr: string;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isDisabled:
          (!!minDate && dateStr < minDate) || (!!maxDate && dateStr > maxDate),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(
        2,
        "0"
      )}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        month: viewMonth,
        year: viewYear,
        isCurrentMonth: true,
        dateStr,
        isDisabled:
          (!!minDate && dateStr < minDate) || (!!maxDate && dateStr > maxDate),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    // Next month filler days (fill up to 35 or 42 grid cells)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr,
        isDisabled:
          (!!minDate && dateStr < minDate) || (!!maxDate && dateStr > maxDate),
        isToday: dateStr === todayStr,
        isSelected: dateStr === value,
      });
    }

    return days;
  }, [viewYear, viewMonth, minDate, maxDate, value]);

  // Navigate months
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  // Format display text
  const formattedDisplay = useMemo(() => {
    if (!value) return "";
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return value;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [value]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date().toISOString().split("T")[0];
    onChange(today);
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
          <CalendarIcon
            className={`w-3.5 h-3.5 shrink-0 ${
              isOpen ? "text-[#f16623]" : "text-slate-400"
            }`}
          />
          {value ? (
            <span className="font-medium text-slate-900">{formattedDisplay}</span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </div>

        {value && !disabled && (
          <span
            onClick={handleClear}
            title="Clear date"
            className="p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Popover Calendar Card (z-[9999] guarantees top-level placement) */}
      {isOpen && (
        <div
          className={`absolute ${
            popoverAlign === "right" ? "right-0" : "left-0"
          } top-[calc(100%+4px)] z-[9999] w-72 bg-white border border-slate-200 rounded-[8px] shadow-2xl p-3 animate-in fade-in-50 zoom-in-95 duration-100`}
        >
          {/* Header: Month & Year Dropdown navigation */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 gap-1.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous month"
              className="p-1 rounded-[4px] hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {/* Month Dropdown */}
              <div className="relative flex-1 min-w-0">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="w-full h-[28px] pl-2 pr-5 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-[5px] hover:border-slate-300 focus:outline-none focus:border-[#f16623] focus:ring-1 focus:ring-[#f16623]/20 cursor-pointer transition appearance-none truncate"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Year Dropdown */}
              <div className="relative w-[76px] shrink-0">
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="w-full h-[28px] pl-2 pr-5 text-xs font-semibold font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-[5px] hover:border-slate-300 focus:outline-none focus:border-[#f16623] focus:ring-1 focus:ring-[#f16623]/20 cursor-pointer transition appearance-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="font-mono">
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title="Next month"
              className="p-1 rounded-[4px] hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-400 pb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map((item, index) => {
              return (
                <button
                  key={`${item.dateStr}-${index}`}
                  type="button"
                  disabled={item.isDisabled}
                  onClick={() => !item.isDisabled && handleSelectDate(item.dateStr)}
                  className={`h-7 w-full rounded-[4px] text-xs flex items-center justify-center transition cursor-pointer relative ${
                    item.isDisabled
                      ? "opacity-25 cursor-not-allowed text-slate-300"
                      : item.isSelected
                      ? "bg-[#f16623] text-white font-medium shadow-xs"
                      : item.isToday
                      ? "bg-orange-50/80 text-[#f16623] font-medium border border-orange-200"
                      : item.isCurrentMonth
                      ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      : "text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.day}</span>
                  {item.isToday && !item.isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#f16623]" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Shortcuts */}
          <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleSetToday}
              className="text-[#f16623] hover:text-[#d9551a] font-medium flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Today</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
