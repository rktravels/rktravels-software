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
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  bookingStatus?: string;
  totalKm?: number;
  grossAmount?: number;
}

export default function VehiclesReportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

      // Calculate trip duration or default 8 operational hours per booking
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

  // Aggregate Fleet Totals
  const fleetSummary = useMemo(() => {
    const totalVehicles = vehicles.length;
    const daysInPeriod = Math.max(1, dateRange.totalDays);
    const standardDailyCapacity = 24; // 24 hours per day

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
    const utilizationRate =
      totalFleetHoursCapacity > 0
        ? Math.min(100, (totalDrivenHours / (totalVehicles * daysInPeriod * 12)) * 100)
        : 0;

    return {
      totalVehicles,
      totalTrips,
      totalDrivenHours,
      totalFreeHours,
      totalOperatingDaysCount,
      totalFreeDays,
      totalKm,
      totalRevenue,
      utilizationRate: Math.round(utilizationRate),
    };
  }, [vehicles, vehicleStatsMap, dateRange]);

  // 1. Top Vehicles by Driven Hours & Trips
  const topVehiclesData = useMemo(() => {
    return vehicles
      .map((v) => {
        const stats = vehicleStatsMap[v.id] || vehicleStatsMap[v.regNumber] || {
          totalTrips: 0,
          drivenHours: 0,
          totalKm: 0,
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

  // 2. Category Distribution
  const categorySegments = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      const cat = v.category || "Standard";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  // 3. Fuel Distribution
  const fuelSegments = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      const fuel = v.fuelType || "Diesel";
      map[fuel] = (map[fuel] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  // 4. Daily Trips Distribution
  const dailyActivityPoints = useMemo(() => {
    const dayMap: Record<string, { trips: number; km: number }> = {};

    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const dayKey = b.startDate.slice(5); // MM-DD
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { trips: 0, km: 0 };
      }
      dayMap[dayKey].trips += 1;
      dayMap[dayKey].km += Number(b.totalKm || 0);
    });

    const sortedDays = Object.keys(dayMap).sort();
    return sortedDays.slice(-10).map((day) => ({
      label: day,
      value: dayMap[day].trips,
      secondaryValue: Math.round(dayMap[day].km / 10), // scaled
    }));
  }, [periodBookings]);

  // 5. Daily Distance Trend
  const distanceTrendData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const dayKey = b.startDate.slice(5);
      dayMap[dayKey] = (dayMap[dayKey] || 0) + Number(b.totalKm || 0);
    });
    const sorted = Object.keys(dayMap).sort();
    if (sorted.length === 0) {
      return [
        { label: "Start", value: 0 },
        { label: "End", value: 0 },
      ];
    }
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: dayMap[k],
    }));
  }, [periodBookings]);

  // Categories list for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [vehicles]);

  // Filtered Table Data
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (fuelFilter !== "all" && (v.fuelType || "Diesel") !== fuelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          v.regNumber?.toLowerCase().includes(q) ||
          v.vehicleName?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          v.vendorName?.toLowerCase().includes(q);
        if (!matches) return false;
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

    const rows = filteredVehicles.map((v) => {
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

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vehicles_report_${dateRange.startDate || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-[6px] bg-[#f16623] flex items-center justify-center text-white">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-none">
                Vehicle Performance & Utilization Report
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Detailed fleet metrics: driven hours, idle/free hours, active booking days, and distance
              </p>
            </div>
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

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Fleet</span>
            <Car className="w-3.5 h-3.5 text-[#f16623]" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {fleetSummary.totalVehicles}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active vehicles</div>
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
          <div className="text-[10px] text-slate-400 mt-0.5">Engaged on duty</div>
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
          <div className="text-[10px] text-slate-400 mt-0.5">Fare value</div>
        </div>
      </div>

      {/* Graphical Representations - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked Meter: Hours in Drive vs Free */}
        <SolidStackedMeter
          title="Fleet Duty Hours Distribution (Drive vs Free)"
          subtitle="Total operational capacity split between trips in progress and idle availability"
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

        {/* Stacked Meter: Operating Days vs Free Days */}
        <SolidStackedMeter
          title="Fleet Operating Days vs Free Days"
          subtitle="Cumulative daily vehicle allocation across the selected date range"
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
              subText: "Days vehicle remained at depot",
            },
          ]}
        />
      </div>

      {/* Graphical Representations - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top 5 Vehicles by Running Hours */}
        <SolidHorizontalBarChart
          title="Top Vehicles by Driven Hours"
          subtitle="Vehicles with the highest duty hours in this period"
          items={topVehiclesData}
          valueFormatter={(val) => `${val}h`}
        />

        {/* Vehicle Categories Donut */}
        <SolidDonutChart
          title="Vehicle Categories Breakdown"
          subtitle="Distribution of fleet models & segments"
          segments={categorySegments}
          centerLabel="Fleet"
          centerValue={`${vehicles.length}`}
        />

        {/* Fuel Type Distribution Donut */}
        <SolidDonutChart
          title="Fuel Type Distribution"
          subtitle="Power train mix of registered fleet"
          segments={fuelSegments}
          centerLabel="Types"
          centerValue={`${fuelSegments.length}`}
        />
      </div>

      {/* Graphical Representations - Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Trips Activity Bar Chart */}
        <SolidBarChart
          title="Daily Booking Activity"
          subtitle="Daily trip volume across recent dates"
          points={dailyActivityPoints}
          primaryLabel="Trips"
          secondaryLabel="Est. KM (x10)"
          valueFormatter={(val) => `${val}`}
        />

        {/* Distance Trend Line Chart */}
        <SolidLineChart
          title="Daily Distance Covered (KM)"
          subtitle="Odometer progression across active period"
          data={distanceTrendData}
          lineColor="#2563eb"
          valueFormatter={(val) => `${val.toLocaleString()} km`}
        />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Filters Bar */}
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search registration, model, vendor..."
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

        {/* Vehicles Table */}
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
                <th className="px-3 py-2.5 text-center">Duty Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                    Loading vehicle report...
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-medium ${
                            stats.totalTrips > 0
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {stats.totalTrips > 0 ? "Active Duty" : "Depot Free"}
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
