// Utility functions and date range logic for RK Travels Reports

export type DateFilterPreset =
  | "today"
  | "yesterday"
  | "this_month"
  | "last_month"
  | "custom"
  | "all";

export interface DateRangeResult {
  preset: DateFilterPreset;
  startDate: string; // YYYY-MM-DD or ""
  endDate: string; // YYYY-MM-DD or ""
  label: string;
  totalDays: number;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeDateRange(
  preset: DateFilterPreset,
  customStart = "",
  customEnd = ""
): DateRangeResult {
  const now = new Date();
  const todayStr = formatDate(now);

  if (preset === "today") {
    return {
      preset: "today",
      startDate: todayStr,
      endDate: todayStr,
      label: "Today",
      totalDays: 1,
    };
  }

  if (preset === "yesterday") {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = formatDate(yest);
    return {
      preset: "yesterday",
      startDate: yestStr,
      endDate: yestStr,
      label: "Yesterday",
      totalDays: 1,
    };
  }

  if (preset === "this_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = formatDate(firstDay);
    const endStr = formatDate(lastDay);
    const days = lastDay.getDate();
    return {
      preset: "this_month",
      startDate: startStr,
      endDate: endStr,
      label: "This Month",
      totalDays: days,
    };
  }

  if (preset === "last_month") {
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startStr = formatDate(firstDayLastMonth);
    const endStr = formatDate(lastDayLastMonth);
    const days = lastDayLastMonth.getDate();
    return {
      preset: "last_month",
      startDate: startStr,
      endDate: endStr,
      label: "Last Month",
      totalDays: days,
    };
  }

  if (preset === "custom") {
    const start = customStart || todayStr;
    const end = customEnd || todayStr;
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return {
      preset: "custom",
      startDate: start,
      endDate: end,
      label: "Custom Range",
      totalDays: Math.max(1, isNaN(diffDays) ? 1 : diffDays),
    };
  }

  // "all"
  return {
    preset: "all",
    startDate: "",
    endDate: "",
    label: "All Time",
    totalDays: 30, // baseline fallback for averages
  };
}

export function formatINR(amount: number): string {
  const valid = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(valid);
}

export function formatCompactINR(amount: number): string {
  const valid = Number(amount) || 0;
  if (valid >= 10000000) {
    return `₹${(valid / 10000000).toFixed(2)} Cr`;
  }
  if (valid >= 100000) {
    return `₹${(valid / 100000).toFixed(2)} L`;
  }
  if (valid >= 1000) {
    return `₹${(valid / 1000).toFixed(1)}k`;
  }
  return `₹${valid}`;
}

export const SOLID_PALETTE = [
  "#f16623", // RK Primary Orange
  "#2563eb", // Royal Blue
  "#059669", // Emerald Green
  "#d97706", // Amber
  "#7c3aed", // Vivid Violet
  "#0891b2", // Teal / Cyan
  "#e11d48", // Rose Red
  "#4f46e5", // Indigo
  "#0284c7", // Sky Blue
  "#65a30d", // Lime Green
  "#ca8a04", // Yellow
  "#475569", // Slate
];
