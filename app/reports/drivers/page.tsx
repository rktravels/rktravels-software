"use client";

import { useState, useEffect, useMemo } from "react";
import {
  UserCheck,
  Search,
  Download,
  Printer,
  RefreshCw,
  Phone,
  Car,
  Clock,
  IndianRupee,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DateFilterPreset,
  computeDateRange,
  formatINR,
  formatCompactINR,
} from "@/lib/report-utils";
import { ReportDateFilter } from "@/components/reports/ReportDateFilter";
import {
  SolidHorizontalBarChart,
  SolidDonutChart,
  SolidBarChart,
  SolidStackedMeter,
  SolidLineChart,
} from "@/components/reports/ReportCharts";

interface Driver {
  id: string;
  name: string;
  phone?: string;
  licenseNumber?: string;
  status?: string;
  address?: string;
  assignedVehicle?: string;
}

interface Booking {
  id: string;
  driverId?: string;
  driverName?: string;
  bookingStatus?: string;
  startDate?: string;
  driverBata?: number;
  startTime?: string;
  endTime?: string;
}

export default function DriversReportPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const dateRange = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setDrivers(list);
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBookings(list);
      setLoading(false);
    });

    return () => {
      unsubDrivers();
      unsubBookings();
    };
  }, []);

  // Filter bookings in selected date range
  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  // Aggregate stats per driver in selected period
  const driverStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        totalTrips: number;
        completedTrips: number;
        totalBata: number;
        dutyHours: number;
        operatingDates: Set<string>;
      }
    > = {};

    periodBookings.forEach((b) => {
      const key = b.driverId || b.driverName || "unknown";
      if (!map[key]) {
        map[key] = {
          totalTrips: 0,
          completedTrips: 0,
          totalBata: 0,
          dutyHours: 0,
          operatingDates: new Set<string>(),
        };
      }
      map[key].totalTrips += 1;
      if (b.bookingStatus === "Trip Completed") {
        map[key].completedTrips += 1;
      }
      map[key].totalBata += Number(b.driverBata || 400); // standard daily bata

      let duration = 8;
      if (b.startTime && b.endTime) {
        const [sh] = b.startTime.split(":").map(Number);
        const [eh] = b.endTime.split(":").map(Number);
        if (!isNaN(sh) && !isNaN(eh)) {
          let diff = eh - sh;
          if (diff <= 0) diff += 24;
          duration = Math.max(1, diff);
        }
      }
      map[key].dutyHours += duration;

      if (b.startDate) {
        map[key].operatingDates.add(b.startDate);
      }
    });

    return map;
  }, [periodBookings]);

  // Overall metrics
  const metrics = useMemo(() => {
    const totalDrivers = drivers.length;
    let totalTrips = 0;
    let totalCompleted = 0;
    let totalBata = 0;
    let totalDutyHours = 0;
    let activeDriversCount = 0;

    drivers.forEach((d) => {
      const stats = driverStatsMap[d.id] || driverStatsMap[d.name];
      if (stats) {
        totalTrips += stats.totalTrips;
        totalCompleted += stats.completedTrips;
        totalBata += stats.totalBata;
        totalDutyHours += stats.dutyHours;
        if (stats.totalTrips > 0) activeDriversCount++;
      }
    });

    const availableDriversCount = Math.max(0, totalDrivers - activeDriversCount);

    return {
      totalDrivers,
      totalTrips,
      totalCompleted,
      totalBata,
      totalDutyHours,
      activeDriversCount,
      availableDriversCount,
    };
  }, [drivers, driverStatsMap]);

  // 1. Top Performing Drivers (Horizontal bar chart)
  const topDriversData = useMemo(() => {
    return drivers
      .map((d) => {
        const stats = driverStatsMap[d.id] || driverStatsMap[d.name] || {
          totalTrips: 0,
          completedTrips: 0,
          dutyHours: 0,
          totalBata: 0,
        };
        return {
          id: d.id,
          label: d.name,
          subLabel: d.phone || d.licenseNumber,
          value: stats.totalTrips,
          secondaryValue: `${stats.dutyHours}h duty • ${formatINR(stats.totalBata)} bata`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [drivers, driverStatsMap]);

  // 2. Driver Availability Segments (Donut)
  const availabilitySegments = useMemo(() => {
    return [
      { label: "Assigned / On Duty", value: metrics.activeDriversCount, color: "#2563eb" },
      { label: "Available / Free", value: metrics.availableDriversCount, color: "#059669" },
    ].filter((s) => s.value > 0);
  }, [metrics]);

  // 3. Daily Driver Trips (Bar Chart)
  const dailyTripsPoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      map[key] = (map[key] || 0) + 1;
    });
    const sorted = Object.keys(map).sort();
    return sorted.slice(-10).map((d) => ({
      label: d,
      value: map[d],
    }));
  }, [periodBookings]);

  // 4. Daily Bata Expense Trend (Line Chart)
  const bataTrendPoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      map[key] = (map[key] || 0) + Number(b.driverBata || 400);
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [periodBookings]);

  // Filtered Table Data
  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const stats = driverStatsMap[d.id] || driverStatsMap[d.name];
      const hasTrips = (stats?.totalTrips || 0) > 0;

      if (statusFilter === "active" && !hasTrips) return false;
      if (statusFilter === "free" && hasTrips) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          d.name?.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q) ||
          d.licenseNumber?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [drivers, driverStatsMap, statusFilter, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Driver Name",
      "Phone",
      "License",
      "Total Trips",
      "Completed",
      "Duty Hours",
      "Active Days",
      "Bata Earned (INR)",
      "Current Status",
    ];

    const rows = filteredDrivers.map((d) => {
      const stats = driverStatsMap[d.id] || driverStatsMap[d.name] || {
        totalTrips: 0,
        completedTrips: 0,
        dutyHours: 0,
        totalBata: 0,
        operatingDates: new Set(),
      };
      return [
        `"${d.name || ""}"`,
        `"${d.phone || ""}"`,
        `"${d.licenseNumber || ""}"`,
        stats.totalTrips,
        stats.completedTrips,
        stats.dutyHours,
        stats.operatingDates.size,
        stats.totalBata,
        stats.totalTrips > 0 ? "On Duty" : "Available",
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `drivers_report_${dateRange.startDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[6px] bg-[#f16623] flex items-center justify-center text-white">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-none">
              Driver Operations & Bata Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Trip volumes, duty hours, driver availability, and total bata payouts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white hover:bg-[#d9551a] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs shadow-[#f16623]/25"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <ReportDateFilter
        currentPreset={datePreset}
        onPresetChange={setDatePreset}
        customStartDate={customStart}
        customEndDate={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        dateRange={dateRange}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Drivers</span>
            <UserCheck className="w-3.5 h-3.5 text-[#f16623]" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.totalDrivers}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Roster strength</div>
        </div>

        <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>On Duty Drivers</span>
            <Car className="w-3.5 h-3.5 text-[#2563eb]" />
          </div>
          <div className="text-xl font-bold text-blue-600 mt-1">{metrics.activeDriversCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned to trips</div>
        </div>

        <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Free / Available</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{metrics.availableDriversCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Ready for booking</div>
        </div>

        <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Trips Executed</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#f16623]" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.totalTrips}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{metrics.totalCompleted} completed</div>
        </div>

        <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Duty Hours</span>
            <Clock className="w-3.5 h-3.5 text-[#7c3aed]" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{metrics.totalDutyHours}h</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cumulated drive time</div>
        </div>

        <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Driver Bata Total</span>
            <IndianRupee className="w-3.5 h-3.5 text-[#d97706]" />
          </div>
          <div className="text-xl font-bold text-amber-600 mt-1">{formatCompactINR(metrics.totalBata)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Allowance expenses</div>
        </div>
      </div>

      {/* Row 1: Stacked Meter */}
      <SolidStackedMeter
        title="Driver Roster Allocation Status"
        subtitle="Distribution between actively assigned drivers and standby free drivers"
        unit="drivers"
        segments={[
          {
            label: "Drivers On Duty",
            value: metrics.activeDriversCount,
            color: "#2563eb",
            subText: "Currently assigned to customer bookings",
          },
          {
            label: "Available / Free Drivers",
            value: metrics.availableDriversCount,
            color: "#059669",
            subText: "Standby at depot for instant dispatch",
          },
        ]}
      />

      {/* Row 2: Top Drivers, Availability Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SolidHorizontalBarChart
          title="Top Performing Drivers"
          subtitle="Ranked by number of trips driven during this period"
          items={topDriversData}
          valueFormatter={(val) => `${val} trips`}
        />

        <SolidDonutChart
          title="Driver Availability Proportion"
          subtitle="Active roster engagement percentage"
          segments={availabilitySegments}
          centerLabel="Total"
          centerValue={`${metrics.totalDrivers}`}
        />
      </div>

      {/* Row 3: Daily Activity & Bata Line Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SolidBarChart
          title="Daily Driver Trips Dispatched"
          subtitle="Number of bookings handled per day"
          points={dailyTripsPoints}
          primaryLabel="Trips"
          valueFormatter={(val) => `${val}`}
        />

        <SolidLineChart
          title="Daily Driver Bata Allowances (₹)"
          subtitle="Allowance expenses paid or accrued per day"
          data={bataTrendPoints}
          lineColor="#d97706"
          valueFormatter={(val) => formatINR(val)}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search driver name, phone, license..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 text-xs focus:outline-hidden focus:border-[#f16623]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
            >
              <option value="all">All Drivers</option>
              <option value="active">On Duty / Active</option>
              <option value="free">Available / Free</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2.5">Driver Name</th>
                <th className="px-3 py-2.5">Phone / License</th>
                <th className="px-3 py-2.5 text-center">Trips</th>
                <th className="px-3 py-2.5 text-center">Active Days</th>
                <th className="px-3 py-2.5 text-right">Duty Hours</th>
                <th className="px-3 py-2.5 text-right">Total Bata (₹)</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                    Loading drivers report...
                  </td>
                </tr>
              ) : filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No drivers found matching criteria
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((d) => {
                  const stats = driverStatsMap[d.id] || driverStatsMap[d.name] || {
                    totalTrips: 0,
                    completedTrips: 0,
                    dutyHours: 0,
                    totalBata: 0,
                    operatingDates: new Set(),
                  };
                  const isOnDuty = stats.totalTrips > 0;

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{d.name}</td>
                      <td className="px-3 py-2.5">
                        <div className="text-slate-800 font-medium">{d.phone || "—"}</div>
                        <div className="text-[10px] text-slate-400">{d.licenseNumber || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                        {stats.totalTrips}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-blue-50 text-blue-700 font-medium text-[11px]">
                          {stats.operatingDates.size}d
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#f16623]">
                        {stats.dutyHours}h
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {formatINR(stats.totalBata)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-medium ${
                            isOnDuty
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isOnDuty ? "On Duty" : "Standby Free"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
