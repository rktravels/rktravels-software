"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Car,
  Search,
  Download,
  Printer,
  RefreshCw,
  Fuel,
  Gauge,
  Clock,
  CalendarDays,
  TrendingUp,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
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

interface Vehicle {
  id: string;
  regNumber: string;
  vehicleName: string;
  category: string;
  fuelType?: string;
  status?: string;
  ownershipType?: string;
  vendorName?: string;
}

interface Booking {
  id: string;
  bookingNumber?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  customerName?: string;
  clientType?: string;
  fromLocation?: string;
  toLocation?: string;
  driverName?: string;
  bookingStatus?: string;
  totalKm?: number;
  grossAmount?: number;
}

export default function VehiclesReportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Scope: "all" or specific vehicle ID
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("all");

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fuelFilter, setFuelFilter] = useState("all");

  const dateRange = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setVehicles(list);
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBookings(list);
      setLoading(false);
    });

    return () => {
      unsubVehicles();
      unsubBookings();
    };
  }, []);

  // Filter bookings according to active date filter
  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  // Selected vehicle object
  const activeVehicle = useMemo(() => {
    if (selectedVehicleId === "all") return null;
    return vehicles.find((v) => v.id === selectedVehicleId || v.regNumber === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  // Vehicle-level aggregated stats within the filtered period
  const vehicleStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        totalTrips: number;
        completedTrips: number;
        drivenHours: number;
        operatingDates: Set<string>;
        totalKm: number;
        revenue: number;
      }
    > = {};

    periodBookings.forEach((b) => {
      const key = b.vehicleId || b.vehicleRegNumber || "unknown";
      if (!map[key]) {
        map[key] = {
          totalTrips: 0,
          completedTrips: 0,
          drivenHours: 0,
          operatingDates: new Set<string>(),
          totalKm: 0,
          revenue: 0,
        };
      }

      map[key].totalTrips += 1;
      if (b.bookingStatus === "Trip Completed") {
        map[key].completedTrips += 1;
      }

      let durationHours = 8;
      if (b.startTime && b.endTime) {
        const [sh, sm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        if (!isNaN(sh) && !isNaN(eh)) {
          let diffMin = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
          if (diffMin <= 0) diffMin += 24 * 60;
          durationHours = Math.max(1, Math.round(diffMin / 60));
        }
      }
      map[key].drivenHours += durationHours;

      if (b.startDate) {
        map[key].operatingDates.add(b.startDate);
      }
      map[key].totalKm += Number(b.totalKm || 0);
      map[key].revenue += Number(b.grossAmount || 0);
    });

    return map;
  }, [periodBookings]);

  // Specific single vehicle stats
  const individualVehicleStats = useMemo(() => {
    if (!activeVehicle) return null;
    const stats = vehicleStatsMap[activeVehicle.id] || vehicleStatsMap[activeVehicle.regNumber] || {
      totalTrips: 0,
      completedTrips: 0,
      drivenHours: 0,
      totalKm: 0,
      revenue: 0,
      operatingDates: new Set<string>(),
    };

    const daysInPeriod = Math.max(1, dateRange.totalDays);
    const totalPossibleHours = daysInPeriod * 24;
    const freeHours = Math.max(0, totalPossibleHours - stats.drivenHours);
    const activeDays = stats.operatingDates.size;
    const freeDays = Math.max(0, daysInPeriod - activeDays);

    // Bookings for this vehicle
    const vehicleBookings = periodBookings.filter(
      (b) => b.vehicleId === activeVehicle.id || b.vehicleRegNumber === activeVehicle.regNumber
    );

    // Daily trips and km
    const dailyMap: Record<string, { trips: number; km: number; rev: number }> = {};
    vehicleBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!dailyMap[key]) dailyMap[key] = { trips: 0, km: 0, rev: 0 };
      dailyMap[key].trips += 1;
      dailyMap[key].km += Number(b.totalKm || 0);
      dailyMap[key].rev += Number(b.grossAmount || 0);
    });

    const sortedDays = Object.keys(dailyMap).sort();

    // Client types served pie
    const clientMap: Record<string, number> = {};
    vehicleBookings.forEach((b) => {
      const c = b.clientType || "Retail";
      clientMap[c] = (clientMap[c] || 0) + 1;
    });

    // Booking status distribution pie
    const statusMap: Record<string, number> = {};
    vehicleBookings.forEach((b) => {
      const st = b.bookingStatus || "Confirmed";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });

    return {
      stats,
      daysInPeriod,
      totalPossibleHours,
      freeHours,
      activeDays,
      freeDays,
      bookings: vehicleBookings,
      dailyPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].trips,
      })),
      kmAreaPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].km,
      })),
      revLinePoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].rev,
      })),
      clientSlices: Object.entries(clientMap).map(([label, value]) => ({ label, value })),
      statusSlices: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
    };
  }, [activeVehicle, vehicleStatsMap, dateRange, periodBookings]);

  // Aggregate Fleet Totals (When "All" is selected)
  const fleetSummary = useMemo(() => {
    const totalVehicles = vehicles.length;
    const daysInPeriod = Math.max(1, dateRange.totalDays);
    const standardDailyCapacity = 24;

    let totalTrips = 0;
    let totalDrivenHours = 0;
    let totalKm = 0;
    let totalRevenue = 0;
    let totalOperatingDaysCount = 0;

    vehicles.forEach((v) => {
      const stats = vehicleStatsMap[v.id] || vehicleStatsMap[v.regNumber];
      if (stats) {
        totalTrips += stats.totalTrips;
        totalDrivenHours += stats.drivenHours;
        totalKm += stats.totalKm;
        totalRevenue += stats.revenue;
        totalOperatingDaysCount += stats.operatingDates.size;
      }
    });

    const totalFleetHoursCapacity = totalVehicles * daysInPeriod * standardDailyCapacity;
    const totalFreeHours = Math.max(0, totalFleetHoursCapacity - totalDrivenHours);
    const totalFleetDaysCapacity = totalVehicles * daysInPeriod;
    const totalFreeDays = Math.max(0, totalFleetDaysCapacity - totalOperatingDaysCount);

    return {
      totalVehicles,
      totalTrips,
      totalDrivenHours,
      totalFreeHours,
      totalOperatingDaysCount,
      totalFreeDays,
      totalKm,
      totalRevenue,
    };
  }, [vehicles, vehicleStatsMap, dateRange]);

  // All Vehicles Graphs Data
  const topVehiclesData = useMemo(() => {
    return vehicles
      .map((v) => {
        const stats = vehicleStatsMap[v.id] || vehicleStatsMap[v.regNumber] || {
          totalTrips: 0,
          drivenHours: 0,
          operatingDates: new Set(),
        };
        const activeDays = stats.operatingDates.size;
        const freeDays = Math.max(0, dateRange.totalDays - activeDays);
        return {
          id: v.id,
          label: `${v.regNumber}`,
          subLabel: v.vehicleName || v.category,
          value: stats.drivenHours,
          secondaryValue: `${stats.totalTrips} trips • ${activeDays}d active / ${freeDays}d free`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [vehicles, vehicleStatsMap, dateRange]);

  const categorySegments = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      const cat = v.category || "Standard";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  const fuelPieSlices = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      const fuel = v.fuelType || "Diesel";
      map[fuel] = (map[fuel] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  const dailyActivityPoints = useMemo(() => {
    const dayMap: Record<string, { trips: number; km: number }> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const dayKey = b.startDate.slice(5);
      if (!dayMap[dayKey]) dayMap[dayKey] = { trips: 0, km: 0 };
      dayMap[dayKey].trips += 1;
      dayMap[dayKey].km += Number(b.totalKm || 0);
    });
    const sortedDays = Object.keys(dayMap).sort();
    return sortedDays.slice(-10).map((day) => ({
      label: day,
      value: dayMap[day].trips,
      secondaryValue: Math.round(dayMap[day].km / 10),
    }));
  }, [periodBookings]);

  const distanceAreaPoints = useMemo(() => {
    const dayMap: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const dayKey = b.startDate.slice(5);
      dayMap[dayKey] = (dayMap[dayKey] || 0) + Number(b.totalKm || 0);
    });
    const sorted = Object.keys(dayMap).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: dayMap[k],
    }));
  }, [periodBookings]);

  const revenueLinePoints = useMemo(() => {
    const dayMap: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const dayKey = b.startDate.slice(5);
      dayMap[dayKey] = (dayMap[dayKey] || 0) + Number(b.grossAmount || 0);
    });
    const sorted = Object.keys(dayMap).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: dayMap[k],
    }));
  }, [periodBookings]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (fuelFilter !== "all" && (v.fuelType || "Diesel") !== fuelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.regNumber?.toLowerCase().includes(q) ||
          v.vehicleName?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vehicles, categoryFilter, fuelFilter, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Registration No",
      "Vehicle Name",
      "Category",
      "Fuel Type",
      "Trips (Period)",
      "Active Days",
      "Free Days",
      "Hours Driven",
      "Hours Free",
      "Total KM",
      "Revenue (INR)",
    ];

    const dataRows = (selectedVehicleId === "all" ? filteredVehicles : activeVehicle ? [activeVehicle] : []).map((v) => {
      const stats = vehicleStatsMap[v.id] || vehicleStatsMap[v.regNumber] || {
        totalTrips: 0,
        drivenHours: 0,
        totalKm: 0,
        revenue: 0,
        operatingDates: new Set(),
      };
      const activeDays = stats.operatingDates.size;
      const freeDays = Math.max(0, dateRange.totalDays - activeDays);
      const freeHours = Math.max(0, dateRange.totalDays * 24 - stats.drivenHours);

      return [
        `"${v.regNumber || ""}"`,
        `"${v.vehicleName || ""}"`,
        `"${v.category || ""}"`,
        `"${v.fuelType || "Diesel"}"`,
        stats.totalTrips,
        activeDays,
        freeDays,
        stats.drivenHours,
        freeHours,
        stats.totalKm,
        stats.revenue,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vehicles_report_${selectedVehicleId}_${dateRange.startDate || "all"}.csv`);
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
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-none">
              Vehicle Performance & Utilization Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive analytics: all vehicles overview or single vehicle drilldown
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

      {/* Scope Selector: All Vehicles vs Individual Vehicle */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#f16623]" />
            Report Scope:
          </span>

          <button
            type="button"
            onClick={() => setSelectedVehicleId("all")}
            className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              selectedVehicleId === "all"
                ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Vehicles ({vehicles.length})
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">or</span>
            <select
              value={selectedVehicleId === "all" ? "" : selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value || "all")}
              className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium cursor-pointer transition ${
                selectedVehicleId !== "all"
                  ? "border-[#f16623] text-[#f16623] bg-orange-50/50"
                  : "border-slate-200 text-slate-700 bg-white"
              }`}
            >
              <option value="">Select Individual Vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.regNumber} — {v.vehicleName || v.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeVehicle && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-[4px] bg-blue-50 text-blue-700 font-semibold">
              {activeVehicle.regNumber}
            </span>
            <span className="text-slate-500 font-medium">
              {activeVehicle.vehicleName} ({activeVehicle.category})
            </span>
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

      {/* VIEW A: INDIVIDUAL VEHICLE DRILLDOWN */}
      {selectedVehicleId !== "all" && activeVehicle && individualVehicleStats && (
        <div className="space-y-4">
          {/* Individual Vehicle Profile KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Vehicle Bookings</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {individualVehicleStats.stats.totalTrips}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Trips in period</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Hours In Drive</div>
              <div className="text-xl font-bold text-[#f16623] mt-1">
                {individualVehicleStats.stats.drivenHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Engaged on duty</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Hours In Free</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {individualVehicleStats.freeHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Available at depot</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Active Duty Days</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {individualVehicleStats.activeDays}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Out of {individualVehicleStats.daysInPeriod}d</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Free / Idle Days</div>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {individualVehicleStats.freeDays}d
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">No bookings logged</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Vehicle Revenue</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(individualVehicleStats.stats.revenue)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total trip billings</div>
            </div>
          </div>

          {/* Individual Graphs Row 1: Split Meters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidStackedMeter
              title={`Operating Hours: ${activeVehicle.regNumber}`}
              subtitle="Breakdown of duty driving hours vs unassigned free time"
              unit="hrs"
              segments={[
                {
                  label: "Hours In Drive",
                  value: individualVehicleStats.stats.drivenHours,
                  color: "#f16623",
                  subText: "Trip drive duration",
                },
                {
                  label: "Hours In Free",
                  value: individualVehicleStats.freeHours,
                  color: "#059669",
                  subText: "Available for dispatch",
                },
              ]}
            />

            <SolidStackedMeter
              title={`Operating Days: ${activeVehicle.regNumber}`}
              subtitle="Active trip schedule days vs depot idle days in period"
              unit="days"
              segments={[
                {
                  label: "Operating Days",
                  value: individualVehicleStats.activeDays,
                  color: "#2563eb",
                  subText: "Days with bookings",
                },
                {
                  label: "Free / Idle Days",
                  value: individualVehicleStats.freeDays,
                  color: "#64748b",
                  subText: "Days vehicle was free",
                },
              ]}
            />
          </div>

          {/* Individual Graphs Row 2: Pie, Donut & Bar Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pie Chart */}
            <SolidPieChart
              title="Trip Status Fulfillment (Pie Chart)"
              subtitle="Completed vs active vs pending trips"
              slices={individualVehicleStats.statusSlices}
              valueFormatter={(v) => `${v} trips`}
            />

            {/* Donut Chart */}
            <SolidDonutChart
              title="Client Types Served (Donut Chart)"
              subtitle="Corporate vs Retail bookings share"
              segments={individualVehicleStats.clientSlices}
              centerLabel="Trips"
              centerValue={`${individualVehicleStats.stats.totalTrips}`}
            />

            {/* Bar Chart */}
            <SolidBarChart
              title="Daily Trips Logged (Bar Chart)"
              subtitle="Trips dispatched per day"
              points={individualVehicleStats.dailyPoints}
              primaryLabel="Trips"
              valueFormatter={(v) => `${v}`}
            />
          </div>

          {/* Individual Graphs Row 3: Area Graph & Line Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Area Graph */}
            <SolidAreaChart
              title="Daily Distance Covered (Area Graph)"
              subtitle="Odometer progression in kilometers"
              data={individualVehicleStats.kmAreaPoints}
              color="#f16623"
              valueFormatter={(v) => `${v} km`}
            />

            {/* Line Graph */}
            <SolidLineChart
              title="Daily Fare Inflow (Line Graph)"
              subtitle="Revenue generated by this vehicle"
              data={individualVehicleStats.revLinePoints}
              lineColor="#2563eb"
              valueFormatter={(v) => formatINR(v)}
            />
          </div>

          {/* Individual Bookings Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">
                Trip Logs for {activeVehicle.regNumber} ({individualVehicleStats.bookings.length} trips)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Booking / Date</th>
                    <th className="px-3 py-2.5">Customer & Type</th>
                    <th className="px-3 py-2.5">Route</th>
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Distance</th>
                    <th className="px-3 py-2.5 text-right">Gross Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {individualVehicleStats.bookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No bookings found for this vehicle in selected period
                      </td>
                    </tr>
                  ) : (
                    individualVehicleStats.bookings.map((b) => (
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
                          {b.driverName || "No Driver"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                            {b.bookingStatus || "Confirmed"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {b.totalKm ? `${b.totalKm} km` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {formatINR(Number(b.grossAmount || 0))}
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

      {/* VIEW B: ALL VEHICLES FLEET OVERVIEW */}
      {selectedVehicleId === "all" && (
        <div className="space-y-4">
          {/* Primary Fleet KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Fleet</span>
                <Car className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {fleetSummary.totalVehicles}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active registered</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Trips Booked</span>
                <CalendarDays className="w-3.5 h-3.5 text-[#2563eb]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {fleetSummary.totalTrips}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">In selected period</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Hours In Drive</span>
                <Clock className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {fleetSummary.totalDrivenHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Fleet drive time</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Hours In Free</span>
                <Zap className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {fleetSummary.totalFreeHours}h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Available for dispatch</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Distance</span>
                <Gauge className="w-3.5 h-3.5 text-[#7c3aed]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {fleetSummary.totalKm.toLocaleString()} km
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Odometer run</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Gross Revenue</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(fleetSummary.totalRevenue)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Fare revenue</div>
            </div>
          </div>

          {/* Fleet Stacked Meters: Driven vs Free Hours & Days */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidStackedMeter
              title="Fleet Duty Hours: Drive vs Free"
              subtitle="Hours fleet was actively driving vs idle/available"
              unit="hrs"
              segments={[
                {
                  label: "Hours In Drive",
                  value: fleetSummary.totalDrivenHours,
                  color: "#f16623",
                  subText: "Vehicle engaged on bookings",
                },
                {
                  label: "Hours In Free",
                  value: fleetSummary.totalFreeHours,
                  color: "#059669",
                  subText: "Ready & unassigned hours",
                },
              ]}
            />

            <SolidStackedMeter
              title="Fleet Operating Days vs Free Days"
              subtitle="Cumulative daily vehicle allocation across selected date range"
              unit="days"
              segments={[
                {
                  label: "Operating Days",
                  value: fleetSummary.totalOperatingDaysCount,
                  color: "#2563eb",
                  subText: "Days with active trip dispatch",
                },
                {
                  label: "Free / Idle Days",
                  value: fleetSummary.totalFreeDays,
                  color: "#64748b",
                  subText: "Days vehicle stayed in depot",
                },
              ]}
            />
          </div>

          {/* Fleet Graphs Row 2: Top Vehicles Bar, Categories Donut, Fuel Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Horizontal Bar Chart */}
            <SolidHorizontalBarChart
              title="Top Vehicles by Driven Hours (Bar Chart)"
              subtitle="Vehicles with highest duty hours"
              items={topVehiclesData}
              valueFormatter={(val) => `${val}h`}
            />

            {/* Donut Chart */}
            <SolidDonutChart
              title="Vehicle Categories (Donut Chart)"
              subtitle="Models and segments mix"
              segments={categorySegments}
              centerLabel="Fleet"
              centerValue={`${vehicles.length}`}
            />

            {/* Pie Chart */}
            <SolidPieChart
              title="Fuel Types Distribution (Pie Chart)"
              subtitle="True circular sector distribution"
              slices={fuelPieSlices}
              valueFormatter={(val) => `${val} cars`}
            />
          </div>

          {/* Fleet Graphs Row 3: Daily Activity Bar, Distance Area Graph, Revenue Line Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Vertical Bar Chart */}
            <SolidBarChart
              title="Daily Booking Activity (Bar Chart)"
              subtitle="Daily trip volume across dates"
              points={dailyActivityPoints}
              primaryLabel="Trips"
              secondaryLabel="Est. KM (x10)"
              valueFormatter={(val) => `${val}`}
            />

            {/* Area Graph */}
            <SolidAreaChart
              title="Fleet Distance Progression (Area Graph)"
              subtitle="Daily total kilometers covered"
              data={distanceAreaPoints}
              color="#2563eb"
              valueFormatter={(val) => `${val.toLocaleString()} km`}
            />

            {/* Line Graph */}
            <SolidLineChart
              title="Daily Billing Velocity (Line Graph)"
              subtitle="Gross revenue booked per day"
              data={revenueLinePoints}
              lineColor="#f16623"
              valueFormatter={(val) => formatINR(val)}
            />
          </div>

          {/* All Vehicles Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search registration, model, category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 text-xs focus:outline-hidden focus:border-[#f16623]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={fuelFilter}
                  onChange={(e) => setFuelFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Fuels</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                  <option value="CNG">CNG</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Vehicle Details</th>
                    <th className="px-3 py-2.5">Category / Fuel</th>
                    <th className="px-3 py-2.5 text-center">Bookings</th>
                    <th className="px-3 py-2.5 text-center">Active Days</th>
                    <th className="px-3 py-2.5 text-center">Free Days</th>
                    <th className="px-3 py-2.5 text-right">Driven Hours</th>
                    <th className="px-3 py-2.5 text-right">Free Hours</th>
                    <th className="px-3 py-2.5 text-right">Total KM</th>
                    <th className="px-3 py-2.5 text-right">Revenue</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                        Loading vehicles report...
                      </td>
                    </tr>
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                        No vehicles found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => {
                      const stats = vehicleStatsMap[v.id] || vehicleStatsMap[v.regNumber] || {
                        totalTrips: 0,
                        completedTrips: 0,
                        drivenHours: 0,
                        totalKm: 0,
                        revenue: 0,
                        operatingDates: new Set(),
                      };
                      const activeDays = stats.operatingDates.size;
                      const freeDays = Math.max(0, dateRange.totalDays - activeDays);
                      const freeHours = Math.max(0, dateRange.totalDays * 24 - stats.drivenHours);

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{v.regNumber}</div>
                            <div className="text-[11px] text-slate-400">{v.vehicleName || "—"}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-slate-700 font-medium">{v.category}</div>
                            <div className="text-[10px] text-slate-400">{v.fuelType || "Diesel"}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
                            {stats.totalTrips}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-blue-50 text-blue-700 font-medium text-[11px]">
                              {activeDays}d
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-slate-600 font-medium text-[11px]">
                              {freeDays}d
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[#f16623]">
                            {stats.drivenHours}h
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-[#059669]">
                            {freeHours}h
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                            {stats.totalKm ? `${stats.totalKm.toLocaleString()} km` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatINR(stats.revenue)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedVehicleId(v.id)}
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
