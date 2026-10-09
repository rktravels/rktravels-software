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
  Filter,
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
  SolidPieChart,
  SolidBarChart,
  SolidAreaChart,
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
  bookingNumber?: string;
  driverId?: string;
  driverName?: string;
  bookingStatus?: string;
  startDate?: string;
  customerName?: string;
  clientType?: string;
  fromLocation?: string;
  toLocation?: string;
  vehicleRegNumber?: string;
  driverBata?: number;
  grossAmount?: number;
  startTime?: string;
  endTime?: string;
}

export default function DriversReportPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Scope: "all" or specific driver ID
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");

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

  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  const activeDriver = useMemo(() => {
    if (selectedDriverId === "all") return null;
    return drivers.find((d) => d.id === selectedDriverId || d.name === selectedDriverId) || null;
  }, [drivers, selectedDriverId]);

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
      map[key].totalBata += Number(b.driverBata || 400);

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

  // Individual Driver Detailed Metrics
  const individualDriverStats = useMemo(() => {
    if (!activeDriver) return null;
    const stats = driverStatsMap[activeDriver.id] || driverStatsMap[activeDriver.name] || {
      totalTrips: 0,
      completedTrips: 0,
      totalBata: 0,
      dutyHours: 0,
      operatingDates: new Set<string>(),
    };

    const daysInPeriod = Math.max(1, dateRange.totalDays);
    const totalPossibleHours = daysInPeriod * 24;
    const freeHours = Math.max(0, totalPossibleHours - stats.dutyHours);
    const activeDays = stats.operatingDates.size;
    const freeDays = Math.max(0, daysInPeriod - activeDays);

    const driverBookings = periodBookings.filter(
      (b) => b.driverId === activeDriver.id || b.driverName === activeDriver.name
    );

    const dailyMap: Record<string, { trips: number; bata: number; hours: number }> = {};
    driverBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!dailyMap[key]) dailyMap[key] = { trips: 0, bata: 0, hours: 0 };
      dailyMap[key].trips += 1;
      dailyMap[key].bata += Number(b.driverBata || 400);
      dailyMap[key].hours += 8;
    });

    const sortedDays = Object.keys(dailyMap).sort();

    const clientMap: Record<string, number> = {};
    driverBookings.forEach((b) => {
      const c = b.clientType || "Retail";
      clientMap[c] = (clientMap[c] || 0) + 1;
    });

    const statusMap: Record<string, number> = {};
    driverBookings.forEach((b) => {
      const st = b.bookingStatus || "Confirmed";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });

    return {
      stats,
      daysInPeriod,
      freeHours,
      activeDays,
      freeDays,
      bookings: driverBookings,
      dailyPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].trips,
      })),
      bataAreaPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].bata,
      })),
      hoursLinePoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].hours,
      })),
      clientSlices: Object.entries(clientMap).map(([label, value]) => ({ label, value })),
      statusSlices: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
    };
  }, [activeDriver, driverStatsMap, dateRange, periodBookings]);

  // Overall metrics (All drivers)
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

  // All Drivers Graphs Data
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

  const availabilityDonut = useMemo(() => {
    return [
      { label: "On Duty", value: metrics.activeDriversCount, color: "#2563eb" },
      { label: "Available Free", value: metrics.availableDriversCount, color: "#059669" },
    ].filter((s) => s.value > 0);
  }, [metrics]);

  const statusPieSlices = useMemo(() => {
    return [
      { label: "Completed Trips", value: metrics.totalCompleted, color: "#059669" },
      { label: "In Transit / Scheduled", value: Math.max(0, metrics.totalTrips - metrics.totalCompleted), color: "#2563eb" },
    ].filter((s) => s.value > 0);
  }, [metrics]);

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

  const bataAreaPoints = useMemo(() => {
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

  const dutyHoursLinePoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      map[key] = (map[key] || 0) + 8;
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [periodBookings]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      const stats = driverStatsMap[d.id] || driverStatsMap[d.name];
      const hasTrips = (stats?.totalTrips || 0) > 0;

      if (statusFilter === "active" && !hasTrips) return false;
      if (statusFilter === "free" && hasTrips) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.name?.toLowerCase().includes(q) ||
          d.phone?.toLowerCase().includes(q) ||
          d.licenseNumber?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [drivers, driverStatsMap, statusFilter, searchQuery]);

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

    const dataRows = (selectedDriverId === "all" ? filteredDrivers : activeDriver ? [activeDriver] : []).map((d) => {
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
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `drivers_report_${selectedDriverId}_${dateRange.startDate || "all"}.csv`);
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
              Trip volumes, duty hours, driver availability, and bata payouts
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

      {/* Scope Selector: All Drivers vs Individual Driver */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#f16623]" />
            Report Scope:
          </span>

          <button
            type="button"
            onClick={() => setSelectedDriverId("all")}
            className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              selectedDriverId === "all"
                ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Drivers ({drivers.length})
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">or</span>
            <select
              value={selectedDriverId === "all" ? "" : selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value || "all")}
              className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium cursor-pointer transition ${
                selectedDriverId !== "all"
                  ? "border-[#f16623] text-[#f16623] bg-orange-50/50"
                  : "border-slate-200 text-slate-700 bg-white"
              }`}
            >
              <option value="">Select Individual Driver...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.phone ? `(${d.phone})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeDriver && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-[4px] bg-blue-50 text-blue-700 font-semibold">
              {activeDriver.name}
            </span>
            <span className="text-slate-500 font-medium">{activeDriver.phone || "No phone"}</span>
          </div>
        )}
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

      {/* VIEW A: INDIVIDUAL DRIVER DRILLDOWN */}
      {selectedDriverId !== "all" && activeDriver && individualDriverStats && (
        <div className="space-y-4">
          {/* Individual Driver KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Driver Trips</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {individualDriverStats.stats.totalTrips}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">In selected period</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Duty Hours</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {individualDriverStats.stats.dutyHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Steering hours</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Available Free</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {individualDriverStats.freeHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Off-duty / rest</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Bata Earned</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {formatINR(individualDriverStats.stats.totalBata)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Trip allowances</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Active Days</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {individualDriverStats.activeDays}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Out of {individualDriverStats.daysInPeriod}d</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#64748b] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Free / Leave Days</div>
              <div className="text-xl font-bold text-slate-700 mt-1">
                {individualDriverStats.freeDays}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Rest days</div>
            </div>
          </div>

          {/* Individual Graphs Row 1: Split Meters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidStackedMeter
              title={`Duty vs Free Hours: ${activeDriver.name}`}
              subtitle="Engaged driving hours vs rest availability"
              unit="hrs"
              segments={[
                {
                  label: "Duty Hours",
                  value: individualDriverStats.stats.dutyHours,
                  color: "#2563eb",
                  subText: "On-trip driving time",
                },
                {
                  label: "Free / Rest Hours",
                  value: individualDriverStats.freeHours,
                  color: "#059669",
                  subText: "Depot standby time",
                },
              ]}
            />

            <SolidStackedMeter
              title={`Active Duty Days vs Free Days: ${activeDriver.name}`}
              subtitle="Working schedule distribution during period"
              unit="days"
              segments={[
                {
                  label: "Working Days",
                  value: individualDriverStats.activeDays,
                  color: "#f16623",
                  subText: "Trips dispatched",
                },
                {
                  label: "Rest Days",
                  value: individualDriverStats.freeDays,
                  color: "#64748b",
                  subText: "Off-duty days",
                },
              ]}
            />
          </div>

          {/* Individual Graphs Row 2: Pie, Donut & Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidPieChart
              title="Trip Status Breakdown (Pie Chart)"
              subtitle="Completed vs active trips"
              slices={individualDriverStats.statusSlices}
              valueFormatter={(v) => `${v} trips`}
            />

            <SolidDonutChart
              title="Customer Types Served (Donut Chart)"
              subtitle="Corporate vs Retail rides"
              segments={individualDriverStats.clientSlices}
              centerLabel="Trips"
              centerValue={`${individualDriverStats.stats.totalTrips}`}
            />

            <SolidBarChart
              title="Daily Trips Logged (Bar Chart)"
              subtitle="Trips driven per day"
              points={individualDriverStats.dailyPoints}
              primaryLabel="Trips"
              valueFormatter={(v) => `${v}`}
            />
          </div>

          {/* Individual Graphs Row 3: Area & Line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidAreaChart
              title="Daily Bata Allowances (Area Graph)"
              subtitle="Driver daily allowance earnings in Rupees"
              data={individualDriverStats.bataAreaPoints}
              color="#d97706"
              valueFormatter={(v) => formatINR(v)}
            />

            <SolidLineChart
              title="Daily Steering Hours (Line Graph)"
              subtitle="Estimated daily on-duty hours"
              data={individualDriverStats.hoursLinePoints}
              lineColor="#2563eb"
              valueFormatter={(v) => `${v}h`}
            />
          </div>

          {/* Individual Trips Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">
                Trip Logs for {activeDriver.name} ({individualDriverStats.bookings.length} trips)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Booking / Date</th>
                    <th className="px-3 py-2.5">Customer & Type</th>
                    <th className="px-3 py-2.5">Route</th>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Bata Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {individualDriverStats.bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No bookings found for this driver in selected period
                      </td>
                    </tr>
                  ) : (
                    individualDriverStats.bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{b.bookingNumber}</div>
                          <div className="text-[11px] text-slate-400">{b.startDate}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{b.customerName}</div>
                          <div className="text-[10px] text-slate-400">{b.clientType || "Retail"}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{b.fromLocation}</div>
                          <div className="text-[11px] text-slate-400">→ {b.toLocation || "Local"}</div>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          {b.vehicleRegNumber || "Unassigned"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                            {b.bookingStatus || "Confirmed"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-amber-600">
                          {formatINR(Number(b.driverBata || 400))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: ALL DRIVERS OVERVIEW */}
      {selectedDriverId === "all" && (
        <div className="space-y-4">
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

          {/* Stacked Meter */}
          <SolidStackedMeter
            title="Driver Roster Allocation: On Duty vs Available Standby"
            subtitle="Engaged drivers assigned to trips vs standby available drivers"
            unit="drivers"
            segments={[
              {
                label: "Drivers On Duty",
                value: metrics.activeDriversCount,
                color: "#2563eb",
                subText: "Currently assigned to customer bookings",
              },
              {
                label: "Available Standby Drivers",
                value: metrics.availableDriversCount,
                color: "#059669",
                subText: "Ready at depot for instant dispatch",
              },
            ]}
          />

          {/* All Drivers Graphs Row 2: Top Drivers Bar, Availability Donut, Status Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidHorizontalBarChart
              title="Top Performing Drivers (Bar Chart)"
              subtitle="Ranked by trips driven"
              items={topDriversData}
              valueFormatter={(val) => `${val} trips`}
            />

            <SolidDonutChart
              title="Roster Availability (Donut Chart)"
              subtitle="Active engagement proportion"
              segments={availabilityDonut}
              centerLabel="Drivers"
              centerValue={`${metrics.totalDrivers}`}
            />

            <SolidPieChart
              title="Trip Fulfillment (Pie Chart)"
              subtitle="True circular sector completion"
              slices={statusPieSlices}
              valueFormatter={(val) => `${val} trips`}
            />
          </div>

          {/* All Drivers Graphs Row 3: Daily Trips Bar, Bata Area Graph, Hours Line Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidBarChart
              title="Daily Driver Trips (Bar Chart)"
              subtitle="Bookings handled per day"
              points={dailyTripsPoints}
              primaryLabel="Trips"
              valueFormatter={(val) => `${val}`}
            />

            <SolidAreaChart
              title="Driver Bata Accrual (Area Graph)"
              subtitle="Daily allowance expense progression"
              data={bataAreaPoints}
              color="#d97706"
              valueFormatter={(val) => formatINR(val)}
            />

            <SolidLineChart
              title="Fleet Duty Hours (Line Graph)"
              subtitle="Daily driver hours on duty"
              data={dutyHoursLinePoints}
              lineColor="#2563eb"
              valueFormatter={(val) => `${val}h`}
            />
          </div>

          {/* All Drivers Table */}
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
                    <th className="px-3 py-2.5 text-center">Action</th>
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
                            <button
                              type="button"
                              onClick={() => setSelectedDriverId(d.id)}
                              className="px-2 py-1 rounded-[4px] bg-orange-50 hover:bg-orange-100 text-[#f16623] font-medium text-[11px] cursor-pointer"
                            >
                              View Individual
                            </button>
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
      )}
    </div>
  );
}
