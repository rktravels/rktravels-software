"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Search,
  Download,
  Printer,
  RefreshCw,
  Phone,
  Building2,
  Car,
  IndianRupee,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
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

interface CarVendor {
  id: string;
  name: string;
  mobile: string;
  city?: string;
  state?: string;
  bankName?: string;
  accountNumber?: string;
  status?: string;
}

interface Vehicle {
  id: string;
  regNumber: string;
  category?: string;
  fuelType?: string;
  vendorId?: string;
  vendorName?: string;
}

interface Booking {
  id: string;
  bookingNumber?: string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  startDate?: string;
  customerName?: string;
  clientType?: string;
  fromLocation?: string;
  toLocation?: string;
  driverName?: string;
  bookingStatus?: string;
  grossAmount?: number;
}

export default function CarVendorsReportPage() {
  const [vendors, setVendors] = useState<CarVendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Scope: "all" or specific vendor ID
  const [selectedVendorId, setSelectedVendorId] = useState<string>("all");

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");

  const dateRange = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const unsubVendors = onSnapshot(collection(db, "car-vendors"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setVendors(list);
    });

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
      unsubVendors();
      unsubVehicles();
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

  const activeVendor = useMemo(() => {
    if (selectedVendorId === "all") return null;
    return vendors.find((v) => v.id === selectedVendorId) || null;
  }, [vendors, selectedVendorId]);

  const vehicleVendorMap = useMemo(() => {
    const map: Record<string, { vendorId?: string; vendorName?: string; category?: string }> = {};
    vehicles.forEach((v) => {
      if (v.vendorId || v.vendorName) {
        map[v.id] = { vendorId: v.vendorId, vendorName: v.vendorName, category: v.category };
        map[v.regNumber] = { vendorId: v.vendorId, vendorName: v.vendorName, category: v.category };
      }
    });
    return map;
  }, [vehicles]);

  // Aggregate stats per vendor
  const vendorStatsMap = useMemo(() => {
    const stats: Record<
      string,
      {
        vehiclesCount: number;
        totalTrips: number;
        completedTrips: number;
        grossRevenue: number;
        estimatedPayout: number;
        agencyMargin: number;
      }
    > = {};

    vendors.forEach((v) => {
      stats[v.id] = {
        vehiclesCount: 0,
        totalTrips: 0,
        completedTrips: 0,
        grossRevenue: 0,
        estimatedPayout: 0,
        agencyMargin: 0,
      };
    });

    vehicles.forEach((veh) => {
      if (veh.vendorId && stats[veh.vendorId]) {
        stats[veh.vendorId].vehiclesCount += 1;
      }
    });

    periodBookings.forEach((b) => {
      const info = vehicleVendorMap[b.vehicleId || ""] || vehicleVendorMap[b.vehicleRegNumber || ""];
      if (info && info.vendorId && stats[info.vendorId]) {
        stats[info.vendorId].totalTrips += 1;
        if (b.bookingStatus === "Trip Completed") {
          stats[info.vendorId].completedTrips += 1;
        }
        const gross = Number(b.grossAmount || 0);
        stats[info.vendorId].grossRevenue += gross;
        const payout = Math.round(gross * 0.85);
        stats[info.vendorId].estimatedPayout += payout;
        stats[info.vendorId].agencyMargin += gross - payout;
      }
    });

    return stats;
  }, [vendors, vehicles, periodBookings, vehicleVendorMap]);

  // Individual Vendor Detailed Metrics
  const individualVendorData = useMemo(() => {
    if (!activeVendor) return null;
    const stats = vendorStatsMap[activeVendor.id] || {
      vehiclesCount: 0,
      totalTrips: 0,
      completedTrips: 0,
      grossRevenue: 0,
      estimatedPayout: 0,
      agencyMargin: 0,
    };

    const vendorVehicles = vehicles.filter((v) => v.vendorId === activeVendor.id);
    const vendorRegs = new Set(vendorVehicles.map((v) => v.regNumber));
    const vendorIds = new Set(vendorVehicles.map((v) => v.id));

    const vendorBookings = periodBookings.filter(
      (b) =>
        (b.vehicleId && vendorIds.has(b.vehicleId)) ||
        (b.vehicleRegNumber && vendorRegs.has(b.vehicleRegNumber))
    );

    const dailyMap: Record<string, { trips: number; gross: number; payout: number }> = {};
    vendorBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!dailyMap[key]) dailyMap[key] = { trips: 0, gross: 0, payout: 0 };
      const gross = Number(b.grossAmount || 0);
      dailyMap[key].trips += 1;
      dailyMap[key].gross += gross;
      dailyMap[key].payout += Math.round(gross * 0.85);
    });

    const sortedDays = Object.keys(dailyMap).sort();

    // Vehicles by category for this vendor pie
    const catMap: Record<string, number> = {};
    vendorVehicles.forEach((v) => {
      const c = v.category || "Sedan";
      catMap[c] = (catMap[c] || 0) + 1;
    });

    // Booking status donut
    const statusMap: Record<string, number> = {};
    vendorBookings.forEach((b) => {
      const st = b.bookingStatus || "Confirmed";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });

    return {
      stats,
      vehicles: vendorVehicles,
      bookings: vendorBookings,
      dailyPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].trips,
      })),
      payoutAreaPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].payout,
      })),
      grossLinePoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].gross,
      })),
      categorySlices: Object.entries(catMap).map(([label, value]) => ({ label, value })),
      statusSegments: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
    };
  }, [activeVendor, vendorStatsMap, vehicles, periodBookings]);

  // Overall totals (All vendors)
  const totals = useMemo(() => {
    let attachedVehicles = 0;
    let totalTrips = 0;
    let totalGross = 0;
    let totalPayout = 0;
    let totalMargin = 0;

    Object.values(vendorStatsMap).forEach((s) => {
      attachedVehicles += s.vehiclesCount;
      totalTrips += s.totalTrips;
      totalGross += s.grossRevenue;
      totalPayout += s.estimatedPayout;
      totalMargin += s.agencyMargin;
    });

    return {
      totalVendors: vendors.length,
      attachedVehicles,
      totalTrips,
      totalGross,
      totalPayout,
      totalMargin,
    };
  }, [vendors, vendorStatsMap]);

  // All Vendors Graphs Data
  const topVendors = useMemo(() => {
    return vendors
      .map((v) => {
        const stats = vendorStatsMap[v.id] || { totalTrips: 0, grossRevenue: 0, vehiclesCount: 0 };
        return {
          id: v.id,
          label: v.name,
          subLabel: `${stats.vehiclesCount} cars • ${v.city || "Local"}`,
          value: stats.totalTrips,
          secondaryValue: `${formatCompactINR(stats.grossRevenue)} billed`,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [vendors, vendorStatsMap]);

  const vendorCategoryDonut = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      if (v.vendorId || v.vendorName) {
        const cat = v.category || "Sedan";
        map[cat] = (map[cat] || 0) + 1;
      }
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  const vendorFuelPieSlices = useMemo(() => {
    const map: Record<string, number> = {};
    vehicles.forEach((v) => {
      if (v.vendorId || v.vendorName) {
        const f = v.fuelType || "Diesel";
        map[f] = (map[f] || 0) + 1;
      }
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [vehicles]);

  const dailyVendorPoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const info = vehicleVendorMap[b.vehicleId || ""] || vehicleVendorMap[b.vehicleRegNumber || ""];
      if (info?.vendorId) {
        const key = b.startDate.slice(5);
        map[key] = (map[key] || 0) + 1;
      }
    });
    const sorted = Object.keys(map).sort();
    return sorted.slice(-10).map((d) => ({
      label: d,
      value: map[d],
    }));
  }, [periodBookings, vehicleVendorMap]);

  const payoutAreaPoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const info = vehicleVendorMap[b.vehicleId || ""] || vehicleVendorMap[b.vehicleRegNumber || ""];
      if (info?.vendorId) {
        const key = b.startDate.slice(5);
        const payout = Math.round(Number(b.grossAmount || 0) * 0.85);
        map[key] = (map[key] || 0) + payout;
      }
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [periodBookings, vehicleVendorMap]);

  const grossLinePoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const info = vehicleVendorMap[b.vehicleId || ""] || vehicleVendorMap[b.vehicleRegNumber || ""];
      if (info?.vendorId) {
        const key = b.startDate.slice(5);
        map[key] = (map[key] || 0) + Number(b.grossAmount || 0);
      }
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [periodBookings, vehicleVendorMap]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (cityFilter !== "all" && v.city !== cityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.name?.toLowerCase().includes(q) ||
          v.mobile?.includes(q) ||
          v.city?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vendors, cityFilter, searchQuery]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.city) set.add(v.city);
    });
    return Array.from(set);
  }, [vendors]);

  const handleExportCSV = () => {
    const headers = [
      "Vendor Name",
      "Mobile",
      "City",
      "Attached Cars",
      "Total Trips",
      "Gross Fare (INR)",
      "Vendor Payout (INR)",
      "Agency Margin (INR)",
    ];

    const dataRows = (selectedVendorId === "all" ? filteredVendors : activeVendor ? [activeVendor] : []).map((v) => {
      const stats = vendorStatsMap[v.id] || {
        vehiclesCount: 0,
        totalTrips: 0,
        grossRevenue: 0,
        estimatedPayout: 0,
        agencyMargin: 0,
      };
      return [
        `"${v.name || ""}"`,
        `"${v.mobile || ""}"`,
        `"${v.city || ""}"`,
        stats.vehiclesCount,
        stats.totalTrips,
        stats.grossRevenue,
        stats.estimatedPayout,
        stats.agencyMargin,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `car_vendors_report_${selectedVendorId}_${dateRange.startDate || "all"}.csv`);
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
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-none">
              Car Vendors (Attached Fleet) Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Network overview and individual vendor attached fleet payout analytics
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

      {/* Scope Selector: All Vendors vs Individual Vendor */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#f16623]" />
            Report Scope:
          </span>

          <button
            type="button"
            onClick={() => setSelectedVendorId("all")}
            className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              selectedVendorId === "all"
                ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Vendors ({vendors.length})
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">or</span>
            <select
              value={selectedVendorId === "all" ? "" : selectedVendorId}
              onChange={(e) => setSelectedVendorId(e.target.value || "all")}
              className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium cursor-pointer transition ${
                selectedVendorId !== "all"
                  ? "border-[#f16623] text-[#f16623] bg-orange-50/50"
                  : "border-slate-200 text-slate-700 bg-white"
              }`}
            >
              <option value="">Select Individual Car Vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.city ? `(${v.city})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeVendor && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-[4px] bg-blue-50 text-blue-700 font-semibold">
              {activeVendor.name}
            </span>
            <span className="text-slate-500 font-medium">
              {activeVendor.city || "Local"} • {activeVendor.mobile}
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

      {/* VIEW A: INDIVIDUAL CAR VENDOR DRILLDOWN */}
      {selectedVendorId !== "all" && activeVendor && individualVendorData && (
        <div className="space-y-4">
          {/* Individual Vendor KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Attached Fleet</div>
              <div className="text-xl font-bold text-blue-600 mt-1">
                {individualVendorData.vehicles.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Cars registered</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Trips Executed</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {individualVendorData.stats.totalTrips}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Trips in period</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Gross Fare Billed</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatINR(individualVendorData.stats.grossRevenue)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Customer bookings</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Vendor Share (85%)</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {formatINR(individualVendorData.stats.estimatedPayout)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Payable to vendor</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Agency Margin (15%)</div>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {formatINR(individualVendorData.stats.agencyMargin)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Retained margin</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Completed Trips</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {individualVendorData.stats.completedTrips}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Successfully closed</div>
            </div>
          </div>

          {/* Individual Graphs Row 1: Split Meter */}
          <SolidStackedMeter
            title={`Earnings Settlement: ${activeVendor.name}`}
            subtitle="Distribution of gross billing between vendor share and agency commission"
            unit="₹"
            segments={[
              {
                label: "Vendor Payout (85%)",
                value: individualVendorData.stats.estimatedPayout,
                color: "#d97706",
                subText: "Accrued payout payable",
              },
              {
                label: "Agency Margin (15%)",
                value: individualVendorData.stats.agencyMargin,
                color: "#059669",
                subText: "Net retained margin",
              },
            ]}
          />

          {/* Individual Graphs Row 2: Pie, Donut & Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidPieChart
              title="Attached Cars by Category (Pie Chart)"
              subtitle="Leased models segmentation"
              slices={individualVendorData.categorySlices}
              valueFormatter={(v) => `${v} cars`}
            />

            <SolidDonutChart
              title="Trip Statuses (Donut Chart)"
              subtitle="Completed vs active trips"
              segments={individualVendorData.statusSegments}
              centerLabel="Trips"
              centerValue={`${individualVendorData.stats.totalTrips}`}
            />

            <SolidBarChart
              title="Daily Trips Handled (Bar Chart)"
              subtitle="Daily volume executed by this vendor"
              points={individualVendorData.dailyPoints}
              primaryLabel="Trips"
              valueFormatter={(v) => `${v}`}
            />
          </div>

          {/* Individual Graphs Row 3: Area & Line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidAreaChart
              title="Daily Payout Accrual (Area Graph)"
              subtitle="Vendor earnings accumulation per day"
              data={individualVendorData.payoutAreaPoints}
              color="#d97706"
              valueFormatter={(v) => formatINR(v)}
            />

            <SolidLineChart
              title="Daily Gross Billing Velocity (Line Graph)"
              subtitle="Customer revenue curve for this vendor"
              data={individualVendorData.grossLinePoints}
              lineColor="#f16623"
              valueFormatter={(v) => formatINR(v)}
            />
          </div>

          {/* Individual Trips Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">
                Bookings Handled by {activeVendor.name} ({individualVendorData.bookings.length} trips)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Booking / Date</th>
                    <th className="px-3 py-2.5">Customer & Route</th>
                    <th className="px-3 py-2.5">Vehicle Reg</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Gross Fare</th>
                    <th className="px-3 py-2.5 text-right">Vendor Share (85%)</th>
                    <th className="px-3 py-2.5 text-right">Agency Margin (15%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {individualVendorData.bookings.map((b) => {
                    const gross = Number(b.grossAmount || 0);
                    const payout = Math.round(gross * 0.85);
                    const margin = gross - payout;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{b.bookingNumber}</div>
                          <div className="text-[11px] text-slate-400">{b.startDate}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{b.customerName}</div>
                          <div className="text-[11px] text-slate-400">
                            {b.fromLocation} → {b.toLocation || "Local"}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-blue-600">
                          {b.vehicleRegNumber || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                            {b.bookingStatus || "Confirmed"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {formatINR(gross)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-amber-600">
                          {formatINR(payout)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-purple-600">
                          {formatINR(margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: ALL VENDORS NETWORK OVERVIEW */}
      {selectedVendorId === "all" && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Vendors</span>
                <Building2 className="w-3.5 h-3.5 text-[#2563eb]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totals.totalVendors}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Partner agencies</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Attached Cars</span>
                <Car className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{totals.attachedVehicles}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vehicles on lease</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Vendor Trips</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totals.totalTrips}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Dispatched to vendor</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Gross Revenue</span>
                <IndianRupee className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(totals.totalGross)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total customer fare</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Vendor Payout</span>
                <IndianRupee className="w-3.5 h-3.5 text-[#d97706]" />
              </div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {formatCompactINR(totals.totalPayout)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Est. 85% share</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Agency Margin</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#7c3aed]" />
              </div>
              <div className="text-xl font-bold text-purple-600 mt-1">
                {formatCompactINR(totals.totalMargin)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Net profit commission</div>
            </div>
          </div>

          {/* Stacked Split Meter */}
          <SolidStackedMeter
            title="Revenue Settlement Split: Vendor Share vs Agency Margin"
            subtitle="Distribution of earnings from trips fulfilled by vendor fleet"
            unit="₹"
            segments={[
              {
                label: "Vendor Payout (85%)",
                value: totals.totalPayout,
                color: "#d97706",
                subText: "Payable to car vendors",
              },
              {
                label: "Agency Margin (15%)",
                value: totals.totalMargin,
                color: "#059669",
                subText: "Net retained commission",
              },
            ]}
          />

          {/* Row 2: Top Vendors Bar, Categories Donut, Fuel Pie Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidHorizontalBarChart
              title="Top Vendors by Trips (Bar Chart)"
              subtitle="Ranked by booking volume"
              items={topVendors}
              valueFormatter={(val) => `${val} trips`}
            />

            <SolidDonutChart
              title="Vendor Fleet by Category (Donut Chart)"
              subtitle="Attached vehicles mix"
              segments={vendorCategoryDonut}
              centerLabel="Attached"
              centerValue={`${totals.attachedVehicles}`}
            />

            <SolidPieChart
              title="Vendor Fleet Fuel Types (Pie Chart)"
              subtitle="True circular sector fuel mix"
              slices={vendorFuelPieSlices}
              valueFormatter={(val) => `${val} cars`}
            />
          </div>

          {/* Row 3: Daily Trips Bar, Payout Area Graph, Gross Line Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidBarChart
              title="Daily Vendor Trips (Bar Chart)"
              subtitle="Volume of rides operated per day"
              points={dailyVendorPoints}
              primaryLabel="Trips"
              valueFormatter={(val) => `${val}`}
            />

            <SolidAreaChart
              title="Vendor Payout Accrual (Area Graph)"
              subtitle="Daily payout liability curve"
              data={payoutAreaPoints}
              color="#d97706"
              valueFormatter={(val) => formatINR(val)}
            />

            <SolidLineChart
              title="Gross Billing Curve (Line Graph)"
              subtitle="Total fare generated across dates"
              data={grossLinePoints}
              lineColor="#f16623"
              valueFormatter={(val) => formatINR(val)}
            />
          </div>

          {/* All Vendors Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search vendor name, phone, city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 text-xs focus:outline-hidden focus:border-[#f16623]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Vendor Name</th>
                    <th className="px-3 py-2.5">Mobile / City</th>
                    <th className="px-3 py-2.5 text-center">Attached Cars</th>
                    <th className="px-3 py-2.5 text-center">Trips</th>
                    <th className="px-3 py-2.5 text-right">Gross Fare (₹)</th>
                    <th className="px-3 py-2.5 text-right">Vendor Share (₹)</th>
                    <th className="px-3 py-2.5 text-right">Agency Margin (₹)</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                        Loading vendor report...
                      </td>
                    </tr>
                  ) : filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No car vendors found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((v) => {
                      const stats = vendorStatsMap[v.id] || {
                        vehiclesCount: 0,
                        totalTrips: 0,
                        grossRevenue: 0,
                        estimatedPayout: 0,
                        agencyMargin: 0,
                      };

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{v.name}</td>
                          <td className="px-3 py-2.5">
                            <div className="text-slate-800 font-medium">{v.mobile}</div>
                            <div className="text-[10px] text-slate-400">{v.city || "—"}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                            {stats.vehiclesCount}
                          </td>
                          <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
                            {stats.totalTrips}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatINR(stats.grossRevenue)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-amber-600">
                            {formatINR(stats.estimatedPayout)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-purple-600">
                            {formatINR(stats.agencyMargin)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedVendorId(v.id)}
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
