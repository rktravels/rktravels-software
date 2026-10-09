"use client";

import { Calendar, Check } from "lucide-react";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { DateFilterPreset, DateRangeResult } from "@/lib/report-utils";

interface ReportDateFilterProps {
  currentPreset: DateFilterPreset;
  onPresetChange: (preset: DateFilterPreset) => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartChange: (val: string) => void;
  onCustomEndChange: (val: string) => void;
  dateRange: DateRangeResult;
}

const PRESET_OPTIONS: { id: DateFilterPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom Range" },
  { id: "all", label: "All Time" },
];

export function ReportDateFilter({
  currentPreset,
  onPresetChange,
  customStartDate,
  customEndDate,
  onCustomStartChange,
  onCustomEndChange,
  dateRange,
}: ReportDateFilterProps) {
  return (
    <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 px-2.5 h-[34px] max-h-[34px] rounded-[6px] bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#f16623]" />
            <span>Date Filter:</span>
          </div>

          {PRESET_OPTIONS.map((opt) => {
            const isActive = currentPreset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPresetChange(opt.id)}
                className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Current Active Range Badge */}
        <div className="flex items-center gap-2">
          <div className="h-[34px] max-h-[34px] px-3 rounded-[6px] bg-orange-50/70 border border-orange-200/80 text-[11px] font-medium text-orange-900 flex items-center gap-2">
            <span className="text-[#f16623] font-semibold">{dateRange.label}:</span>
            {dateRange.startDate ? (
              <span>
                {dateRange.startDate} {dateRange.endDate && dateRange.endDate !== dateRange.startDate ? `to ${dateRange.endDate}` : ""}
              </span>
            ) : (
              <span>Complete Records</span>
            )}
            <span className="bg-[#f16623] text-white px-1.5 py-0.5 rounded-[4px] text-[10px]">
              {dateRange.totalDays} {dateRange.totalDays === 1 ? "day" : "days"}
            </span>
          </div>
        </div>
      </div>

      {/* Custom Date Pickers Drawer (when custom is selected) */}
      {currentPreset === "custom" && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 shrink-0">From Date:</label>
            <div className="w-44">
              <CustomDatePicker
                value={customStartDate}
                onChange={onCustomStartChange}
                placeholder="Start Date"
                className="h-[34px] max-h-[34px] text-xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 shrink-0">To Date:</label>
            <div className="w-44">
              <CustomDatePicker
                value={customEndDate}
                onChange={onCustomEndChange}
                placeholder="End Date"
                className="h-[34px] max-h-[34px] text-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
