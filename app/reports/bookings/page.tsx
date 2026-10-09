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
  SolidBarChart,
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
  createdAt?: any;
}

export default function BookingsReportPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Filter bookings by selected date range and table filters
  const dateFilteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  const filteredBookings = useMemo(() => {
    return dateFilteredBookings.filter((b) => {
      if (statusFilter !== "all" && b.bookingStatus !== statusFilter) return false;
      if (clientTypeFilter !== "all" && b.clientType !== clientTypeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.fromLocation?.toLowerCase().includes(q) ||
          b.toLocation?.toLowerCase().includes(q) ||
          b.vehicleRegNumber?.toLowerCase().includes(q) ||
          b.driverName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [dateFilteredBookings, searchQuery, statusFilter, clientTypeFilter]);

  // Aggregate Metrics
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

  // 1. Status Segments for Donut Chart
  const statusSegments = useMemo(() => {
    return [
      { label: "Completed", value: metrics.completedCount, color: "#059669" },
      { label: "Confirmed / Active", value: metrics.confirmedCount, color: "#2563eb" },
      { label: "Pending", value: metrics.pendingCount, color: "#f59e0b" },
      { label: "Cancelled", value: metrics.cancelledCount, color: "#e11d48" },
    ].filter((s) => s.value > 0);
  }, [metrics]);

  // 2. Client Types Donut Chart
  const clientTypeSegments = useMemo(() => {
    const map: Record<string, number> = {};
    dateFilteredBookings.forEach((b) => {
      const type = b.clientType || "Retail";
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [dateFilteredBookings]);

  // 3. Daily Bookings Bar Chart
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
      secondaryValue: Math.round(map[d].rev / 1000), // in thousands
    }));
  }, [dateFilteredBookings]);

  // 4. Daily Revenue Line Trend
  const revenueTrendPoints = useMemo(() => {
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

  // 5. Top Routes / Pickups
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

  // Export CSV
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

    const rows = filteredBookings.map((b) => [
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

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookings_report_${dateRange.startDate || "all"}.csv`);
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
              Trip volumes, status fulfillment, revenue trends, and route analytics
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

      {/* Primary KPI Cards */}
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

      {/* Row 1: Payment Settlement Meter */}
      <SolidStackedMeter
        title="Revenue Settlement Ratio (Collected vs Outstanding Balance)"
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

      {/* Row 2: Status Donut, Client Donut, Top Routes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SolidDonutChart
          title="Trip Status Fulfillment"
          subtitle="Breakdown of scheduled bookings"
          segments={statusSegments}
          centerLabel="Bookings"
          centerValue={`${metrics.totalCount}`}
        />

        <SolidDonutChart
          title="Client Segments"
          subtitle="Corporate vs Retail bookings"
          segments={clientTypeSegments}
          centerLabel="Total"
          centerValue={`${metrics.totalCount}`}
        />

        <SolidHorizontalBarChart
          title="Top Routes Traveled"
          subtitle="Most frequent departure and arrival points"
          items={topRoutes}
          valueFormatter={(v) => `${v}`}
        />
      </div>

      {/* Row 3: Daily Activity Bar & Revenue Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SolidBarChart
          title="Daily Booking Volume"
          subtitle="Daily booked trips and approximate value (in thousands)"
          points={dailyBookingPoints}
          primaryLabel="Trips"
          secondaryLabel="Revenue (₹k)"
          valueFormatter={(val) => `${val}`}
        />

        <SolidLineChart
          title="Revenue Trend (₹)"
          subtitle="Daily gross billing velocity"
          data={revenueTrendPoints}
          lineColor="#f16623"
          valueFormatter={(val) => formatINR(val)}
        />
      </div>

      {/* Filter and Table Section */}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                    Loading bookings report...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
