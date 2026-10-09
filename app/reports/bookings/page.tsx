"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CalendarCheck,
  Search,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  IndianRupee,
  FileSpreadsheet,
  AlertCircle,
  XCircle,
  Filter,
  Car,
  User,
  MapPin,
} from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
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

interface BookingRecord {
  id: string;
  bookingNumber: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  fromLocation: string;
  toLocation: string;
  customerName: string;
  clientType?: string;
  vehicleCategory?: string;
  vehicleRegNumber?: string;
  driverName?: string;
  bookingStatus?: string;
  grossAmount?: number;
  netAmount?: number;
  receivedAmount?: number;
  balanceAmount?: number;
  customerAdvance?: number;
  totalKm?: number;
  driverBata?: number;
  createdAt?: any;
}

export default function BookingsReportPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Scope: "all" or specific booking number
  const [selectedBookingId, setSelectedBookingId] = useState<string>("all");

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");

  const dateRange = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: BookingRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setBookings(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading bookings report:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const dateFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  const activeBooking = useMemo(() => {
    if (selectedBookingId === "all") return null;
    return bookings.find((b) => b.id === selectedBookingId || b.bookingNumber === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // Individual Booking Detailed Analytics
  const individualBookingData = useMemo(() => {
    if (!activeBooking) return null;
    const gross = Number(activeBooking.grossAmount || 0);
    const received = Number(activeBooking.receivedAmount || activeBooking.customerAdvance || 0);
    const balance = Math.max(0, Number(activeBooking.balanceAmount || gross - received));
    const bata = Number(activeBooking.driverBata || 400);
    const baseFare = Math.max(0, gross - bata);

    // Fare composition pie
    const fareCompositionSlices = [
      { label: "Base Vehicle Tariff", value: baseFare, color: "#2563eb" },
      { label: "Driver Bata Allowance", value: bata, color: "#d97706" },
      { label: "Tolls / Taxes Margin", value: Math.max(0, Math.round(gross * 0.05)), color: "#7c3aed" },
    ].filter((s) => s.value > 0);

    // Payment stage donut
    const paymentStageSegments = [
      { label: "Advance / Collected", value: received, color: "#059669" },
      { label: "Pending Due", value: balance, color: "#e11d48" },
    ].filter((s) => s.value > 0);

    // Benchmark comparison bar points
    const avgFare =
      dateFilteredBookings.length > 0
        ? Math.round(
            dateFilteredBookings.reduce((sum, b) => sum + Number(b.grossAmount || 0), 0) /
              dateFilteredBookings.length
          )
        : gross;

    const benchmarkPoints = [
      { label: "This Booking", value: gross, color: "#f16623" },
      { label: "Fleet Avg Fare", value: avgFare, color: "#2563eb" },
      { label: "Received Cash", value: received, color: "#059669" },
      { label: "Balance Due", value: balance, color: "#e11d48" },
    ];

    // Simulated milestone progression area
    const milestoneArea = [
      { label: "Booking Start", value: Math.round(gross * 0.2) },
      { label: "Dispatch", value: Math.round(gross * 0.4) },
      { label: "On Duty", value: Math.round(gross * 0.7) },
      { label: "Destination", value: gross },
    ];

    const milestoneLine = [
      { label: "Start", value: 0 },
      { label: "50% Route", value: Math.round(Number(activeBooking.totalKm || 100) / 2) },
      { label: "Completed", value: Number(activeBooking.totalKm || 100) },
    ];

    return {
      booking: activeBooking,
      gross,
      received,
      balance,
      fareCompositionSlices,
      paymentStageSegments,
      benchmarkPoints,
      milestoneArea,
      milestoneLine,
    };
  }, [activeBooking, dateFilteredBookings]);

  // Aggregate Metrics (All Bookings)
  const metrics = useMemo(() => {
    let totalGross = 0;
    let totalReceived = 0;
    let totalBalance = 0;
    let completedCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    dateFilteredBookings.forEach((b) => {
      totalGross += Number(b.grossAmount || 0);
      totalReceived += Number(b.receivedAmount || b.customerAdvance || 0);
      totalBalance += Number(b.balanceAmount || 0);

      const st = (b.bookingStatus || "").toLowerCase();
      if (st.includes("complete")) {
        completedCount++;
      } else if (st.includes("cancel")) {
        cancelledCount++;
      } else if (st.includes("confirm") || st.includes("dispatch")) {
        confirmedCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalCount: dateFilteredBookings.length,
      totalGross,
      totalReceived,
      totalBalance,
      completedCount,
      confirmedCount,
      cancelledCount,
      pendingCount,
    };
  }, [dateFilteredBookings]);

  // All Bookings Graphs Data
  const statusPieSlices = useMemo(() => {
    return [
      { label: "Trip Completed", value: metrics.completedCount, color: "#059669" },
      { label: "Active / Confirmed", value: metrics.confirmedCount, color: "#2563eb" },
      { label: "Pending", value: metrics.pendingCount, color: "#f59e0b" },
      { label: "Cancelled", value: metrics.cancelledCount, color: "#e11d48" },
    ].filter((s) => s.value > 0);
  }, [metrics]);

  const clientTypeDonut = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredBookings.forEach((b) => {
      const type = b.clientType || "Retail";
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [dateFilteredBookings]);

  const topRoutes = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredBookings.forEach((b) => {
      const route = `${b.fromLocation || "City"} → ${b.toLocation || "Local"}`;
      map[route] = (map[route] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({
        id: label,
        label,
        value,
        secondaryValue: `${value} trips`,
      }));
  }, [dateFilteredBookings]);

  const dailyBookingPoints = useMemo(() => {
    const map: Record<string, { count: number; rev: number }> = {};
    dateFilteredBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!map[key]) map[key] = { count: 0, rev: 0 };
      map[key].count += 1;
      map[key].rev += Number(b.grossAmount || 0);
    });
    const sorted = Object.keys(map).sort();
    return sorted.slice(-10).map((d) => ({
      label: d,
      value: map[d].count,
      secondaryValue: Math.round(map[d].rev / 1000),
    }));
  }, [dateFilteredBookings]);

  const revenueAreaPoints = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      map[key] = (map[key] || 0) + Number(b.receivedAmount || b.customerAdvance || 0);
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [dateFilteredBookings]);

  const invoicedLinePoints = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      map[key] = (map[key] || 0) + Number(b.grossAmount || 0);
    });
    const sorted = Object.keys(map).sort();
    if (sorted.length === 0) return [{ label: "Start", value: 0 }, { label: "End", value: 0 }];
    return sorted.slice(-12).map((k) => ({
      label: k,
      value: map[k],
    }));
  }, [dateFilteredBookings]);

  const filteredBookings = useMemo(() => {
    return dateFilteredBookings.filter((b) => {
      if (statusFilter !== "all" && b.bookingStatus !== statusFilter) return false;
      if (clientTypeFilter !== "all" && b.clientType !== clientTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.fromLocation?.toLowerCase().includes(q) ||
          b.toLocation?.toLowerCase().includes(q) ||
          b.vehicleRegNumber?.toLowerCase().includes(q) ||
          b.driverName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dateFilteredBookings, searchQuery, statusFilter, clientTypeFilter]);

  const handleExportCSV = () => {
    const headers = [
      "Booking No",
      "Date",
      "Client Type",
      "Customer",
      "From Location",
      "To Location",
      "Vehicle Reg",
      "Driver",
      "Status",
      "Gross Fare",
      "Received",
      "Balance",
    ];

    const dataRows = (selectedBookingId === "all" ? filteredBookings : activeBooking ? [activeBooking] : []).map((b) => [
      `"${b.bookingNumber || ""}"`,
      `"${b.startDate || ""}"`,
      `"${b.clientType || ""}"`,
      `"${b.customerName || ""}"`,
      `"${b.fromLocation || ""}"`,
      `"${b.toLocation || ""}"`,
      `"${b.vehicleRegNumber || ""}"`,
      `"${b.driverName || ""}"`,
      `"${b.bookingStatus || ""}"`,
      b.grossAmount || 0,
      b.receivedAmount || b.customerAdvance || 0,
      b.balanceAmount || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_report_${selectedBookingId}_${dateRange.startDate || "all"}.csv`);
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
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-none">
              Bookings & Revenue Performance Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Trip volumes, status fulfillment, and single booking drilldown analysis
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

      {/* Scope Selector: All Bookings vs Individual Booking */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#f16623]" />
            Report Scope:
          </span>

          <button
            type="button"
            onClick={() => setSelectedBookingId("all")}
            className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              selectedBookingId === "all"
                ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Bookings ({dateFilteredBookings.length})
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">or</span>
            <select
              value={selectedBookingId === "all" ? "" : selectedBookingId}
              onChange={(e) => setSelectedBookingId(e.target.value || "all")}
              className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium cursor-pointer transition ${
                selectedBookingId !== "all"
                  ? "border-[#f16623] text-[#f16623] bg-orange-50/50"
                  : "border-slate-200 text-slate-700 bg-white"
              }`}
            >
              <option value="">Select Individual Booking...</option>
              {dateFilteredBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bookingNumber} — {b.customerName} ({b.startDate})
                </option>
              ))}
            </select>
          </div>
        </div>

        {activeBooking && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-[4px] bg-blue-50 text-blue-700 font-semibold">
              {activeBooking.bookingNumber}
            </span>
            <span className="text-slate-500 font-medium">
              {activeBooking.customerName} • {activeBooking.fromLocation} → {activeBooking.toLocation || "Local"}
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

      {/* VIEW A: INDIVIDUAL BOOKING DRILLDOWN */}
      {selectedBookingId !== "all" && activeBooking && individualBookingData && (
        <div className="space-y-4">
          {/* Individual Booking KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Gross Fare</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatINR(individualBookingData.gross)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total booked fare</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Collected Cash</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {formatINR(individualBookingData.received)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Advance & received</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#e11d48] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Balance Pending</div>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatINR(individualBookingData.balance)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending collection</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Vehicle Assigned</div>
              <div className="text-sm font-bold text-blue-600 mt-1 truncate">
                {activeBooking.vehicleRegNumber || "Unassigned"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{activeBooking.vehicleCategory || "Sedan"}</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#7c3aed] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Driver Assigned</div>
              <div className="text-sm font-bold text-purple-600 mt-1 truncate">
                {activeBooking.driverName || "No Driver"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bata: {formatINR(activeBooking.driverBata || 400)}</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Trip Status</div>
              <div className="text-sm font-bold text-emerald-600 mt-1 truncate">
                {activeBooking.bookingStatus || "Confirmed"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{activeBooking.startDate}</div>
            </div>
          </div>

          {/* Split Settlement Meter */}
          <SolidStackedMeter
            title={`Fare Settlement Ratio: ${activeBooking.bookingNumber}`}
            subtitle="Amount collected vs remaining balance"
            unit="₹"
            segments={[
              {
                label: "Received / Advance Collected",
                value: individualBookingData.received,
                color: "#059669",
                subText: "Settled in account",
              },
              {
                label: "Balance Due",
                value: individualBookingData.balance,
                color: "#e11d48",
                subText: "Pending collection",
              },
            ]}
          />

          {/* Individual Graphs Row 2: Pie, Donut & Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidPieChart
              title="Fare Composition (Pie Chart)"
              subtitle="Base tariff vs driver bata vs taxes"
              slices={individualBookingData.fareCompositionSlices}
              valueFormatter={(v) => formatINR(v)}
            />

            <SolidDonutChart
              title="Payment Stage (Donut Chart)"
              subtitle="Collected vs pending proportion"
              segments={individualBookingData.paymentStageSegments}
              centerLabel="Fare"
              centerValue={formatINR(individualBookingData.gross)}
              valueFormatter={(v) => formatINR(v)}
            />

            <SolidBarChart
              title="Booking Fare Benchmarks (Bar Chart)"
              subtitle="Comparison against fleet average fare"
              points={individualBookingData.benchmarkPoints}
              primaryLabel="Amount"
              valueFormatter={(v) => formatINR(v)}
            />
          </div>

          {/* Individual Graphs Row 3: Area & Line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SolidAreaChart
              title="Trip Milestone Billing Progression (Area Graph)"
              subtitle="Cumulative tariff milestone progression"
              data={individualBookingData.milestoneArea}
              color="#f16623"
              valueFormatter={(v) => formatINR(v)}
            />

            <SolidLineChart
              title="Distance Progression (Line Graph)"
              subtitle="Kilometers covered along travel route"
              data={individualBookingData.milestoneLine}
              lineColor="#2563eb"
              valueFormatter={(v) => `${v} km`}
            />
          </div>

          {/* Detailed Booking Summary Panel */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs p-4">
            <h3 className="text-xs font-semibold text-slate-900 mb-3">
              Booking Dispatch Details: {activeBooking.bookingNumber}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Customer:</span>
                <p className="font-semibold text-slate-900 mt-0.5">{activeBooking.customerName}</p>
                <p className="text-[11px] text-slate-500">{activeBooking.clientType || "Retail"}</p>
              </div>
              <div>
                <span className="text-slate-400">Route:</span>
                <p className="font-semibold text-slate-900 mt-0.5">{activeBooking.fromLocation}</p>
                <p className="text-[11px] text-slate-500">→ {activeBooking.toLocation || "Local"}</p>
              </div>
              <div>
                <span className="text-slate-400">Vehicle / Driver:</span>
                <p className="font-semibold text-blue-600 mt-0.5">{activeBooking.vehicleRegNumber || "Unassigned"}</p>
                <p className="text-[11px] text-slate-500">{activeBooking.driverName || "No Driver"}</p>
              </div>
              <div>
                <span className="text-slate-400">Schedule:</span>
                <p className="font-semibold text-slate-900 mt-0.5">{activeBooking.startDate} {activeBooking.startTime || ""}</p>
                <p className="text-[11px] text-emerald-600 font-medium">{activeBooking.bookingStatus || "Confirmed"}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: ALL BOOKINGS OPERATIONS OVERVIEW */}
      {selectedBookingId === "all" && (
        <div className="space-y-4">
          {/* Primary Operations KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Bookings</span>
                <CalendarCheck className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{metrics.totalCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">In selected period</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Completed</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{metrics.completedCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Trips fulfilled</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Active / Confirmed</span>
                <Clock className="w-3.5 h-3.5 text-[#2563eb]" />
              </div>
              <div className="text-xl font-bold text-blue-600 mt-1">{metrics.confirmedCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">In transit or scheduled</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Gross Revenue</span>
                <IndianRupee className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(metrics.totalGross)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total booked fare</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Collected</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(metrics.totalReceived)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Advance & settlements</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#e11d48] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Balance Due</span>
                <AlertCircle className="w-3.5 h-3.5 text-[#e11d48]" />
              </div>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatCompactINR(metrics.totalBalance)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending collection</div>
            </div>
          </div>

          {/* Payment Settlement Stacked Meter */}
          <SolidStackedMeter
            title="Revenue Settlement Ratio: Collected vs Outstanding Balance"
            subtitle="Current cash collection progress for trips booked in this period"
            unit="₹"
            segments={[
              {
                label: "Received / Advance Collected",
                value: metrics.totalReceived,
                color: "#059669",
                subText: "Settled in bank / cash",
              },
              {
                label: "Pending Receivables",
                value: metrics.totalBalance,
                color: "#e11d48",
                subText: "Outstanding payment balance",
              },
            ]}
          />

          {/* Row 2: Status Pie Chart, Client Donut, Top Routes Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidPieChart
              title="Trip Status Fulfillment (Pie Chart)"
              subtitle="True circular sector completion"
              slices={statusPieSlices}
              valueFormatter={(v) => `${v} trips`}
            />

            <SolidDonutChart
              title="Client Segments (Donut Chart)"
              subtitle="Corporate vs Retail bookings"
              segments={clientTypeDonut}
              centerLabel="Total"
              centerValue={`${metrics.totalCount}`}
            />

            <SolidHorizontalBarChart
              title="Top Routes Traveled (Bar Chart)"
              subtitle="Most frequent departure and arrivals"
              items={topRoutes}
              valueFormatter={(v) => `${v}`}
            />
          </div>

          {/* Row 3: Daily Volume Bar, Cash Receipts Area Graph, Revenue Line Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidBarChart
              title="Daily Booking Volume (Bar Chart)"
              subtitle="Bookings and fare (in ₹k)"
              points={dailyBookingPoints}
              primaryLabel="Trips"
              secondaryLabel="Revenue (₹k)"
              valueFormatter={(val) => `${val}`}
            />

            <SolidAreaChart
              title="Cash Collection Velocity (Area Graph)"
              subtitle="Payments received per day"
              data={revenueAreaPoints}
              color="#059669"
              valueFormatter={(val) => formatINR(val)}
            />

            <SolidLineChart
              title="Gross Fare Curve (Line Graph)"
              subtitle="Daily billing progression"
              data={invoicedLinePoints}
              lineColor="#f16623"
              valueFormatter={(val) => formatINR(val)}
            />
          </div>

          {/* All Bookings Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search booking no, customer, route, vehicle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 text-xs focus:outline-hidden focus:border-[#f16623]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Trip Completed">Trip Completed</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

                <select
                  value={clientTypeFilter}
                  onChange={(e) => setClientTypeFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Clients</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Retail">Retail</option>
                  <option value="Hotel">Hotel</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Booking / Date</th>
                    <th className="px-3 py-2.5">Customer & Type</th>
                    <th className="px-3 py-2.5">Route</th>
                    <th className="px-3 py-2.5">Vehicle & Driver</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Gross Fare</th>
                    <th className="px-3 py-2.5 text-right">Received</th>
                    <th className="px-3 py-2.5 text-right">Balance</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                        Loading bookings report...
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No bookings found matching selected filters
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">{b.bookingNumber}</div>
                          <div className="text-[11px] text-slate-400">{b.startDate}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">{b.customerName}</div>
                          <div className="text-[10px] text-slate-400">{b.clientType || "Retail"}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-slate-800">{b.fromLocation}</div>
                          <div className="text-[11px] text-slate-400">→ {b.toLocation || "Local"}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-slate-900">
                            {b.vehicleRegNumber || "Unassigned"}
                          </div>
                          <div className="text-[10px] text-slate-400">{b.driverName || "No Driver"}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-medium ${
                              b.bookingStatus === "Trip Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : b.bookingStatus === "Cancelled"
                                ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                                : "bg-blue-50 text-blue-700 border border-blue-200/60"
                            }`}
                          >
                            {b.bookingStatus || "Confirmed"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                          {formatINR(Number(b.grossAmount || 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-emerald-600">
                          {formatINR(Number(b.receivedAmount || b.customerAdvance || 0))}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-rose-600">
                          {formatINR(Number(b.balanceAmount || 0))}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedBookingId(b.id)}
                            className="px-2 py-1 rounded-[4px] bg-orange-50 hover:bg-orange-100 text-[#f16623] font-medium text-[11px] cursor-pointer"
                          >
                            View Individual
                          </button>
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
    </div>
  );
}
