"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CalendarCheck,
  Search,
  Download,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  IndianRupee,
  FileSpreadsheet,
} from "lucide-react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CustomDatePicker } from "@/components/CustomDatePicker";

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

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

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

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.bookingStatus !== statusFilter) return false;
      if (clientTypeFilter !== "all" && b.clientType !== clientTypeFilter) return false;
      if (startDateFilter && b.startDate && b.startDate < startDateFilter) return false;
      if (endDateFilter && b.startDate && b.startDate > endDateFilter) return false;

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
  }, [bookings, searchQuery, statusFilter, clientTypeFilter, startDateFilter, endDateFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalGross = 0;
    let totalReceived = 0;
    let totalBalance = 0;
    let completedCount = 0;

    filteredBookings.forEach((b) => {
      const gross = Number(b.grossAmount || b.netAmount || 0);
      const received = Number(b.receivedAmount || b.customerAdvance || 0);
      const balance = Math.max(0, gross - received);

      totalGross += gross;
      totalReceived += received;
      totalBalance += balance;

      if (b.bookingStatus === "Trip Completed") {
        completedCount++;
      }
    });

    return {
      totalBookings: filteredBookings.length,
      completedCount,
      totalGross,
      totalReceived,
      totalBalance,
    };
  }, [filteredBookings]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) return;
    const headers = [
      "Booking Number",
      "Start Date",
      "Customer",
      "Client Type",
      "From Location",
      "To Location",
      "Vehicle",
      "Driver",
      "Status",
      "Gross Amount (₹)",
      "Received (₹)",
      "Balance (₹)",
    ];

    const rows = filteredBookings.map((b) => {
      const gross = Number(b.grossAmount || b.netAmount || 0);
      const received = Number(b.receivedAmount || b.customerAdvance || 0);
      const balance = Math.max(0, gross - received);

      return [
        `"${b.bookingNumber || ""}"`,
        `"${b.startDate || ""}"`,
        `"${(b.customerName || "").replace(/"/g, '""')}"`,
        `"${b.clientType || ""}"`,
        `"${(b.fromLocation || "").replace(/"/g, '""')}"`,
        `"${(b.toLocation || "").replace(/"/g, '""')}"`,
        `"${b.vehicleRegNumber || "Unassigned"}"`,
        `"${b.driverName || "Unassigned"}"`,
        `"${b.bookingStatus || "New"}"`,
        gross,
        received,
        balance,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bookings_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[6px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Bookings Report
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive report of trip bookings, client billing breakdown, and assignment records
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredBookings.length === 0}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Total Bookings
              </span>
              <FileSpreadsheet className="w-4 h-4 text-[#f16623]" />
            </div>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalBookings}
            </div>
            <span className="text-[10px] text-slate-400">Across selected filters</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Completed Trips
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-semibold text-emerald-600 mt-1">
              {metrics.completedCount}
            </div>
            <span className="text-[10px] text-slate-400">
              {metrics.totalBookings > 0
                ? `${Math.round((metrics.completedCount / metrics.totalBookings) * 100)}% completion rate`
                : "0% completion"}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Total Billed
              </span>
              <TrendingUp className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              ₹{metrics.totalGross.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Gross trip revenue</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Received / Advance
              </span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg font-semibold text-emerald-600 mt-1">
              ₹{metrics.totalReceived.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Cash / Online collections</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Pending Balance
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-lg font-semibold text-amber-600 mt-1">
              ₹{metrics.totalBalance.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Outstanding to be settled</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white p-3 rounded-[6px] border border-slate-200 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search booking #, customer, location, vehicle..."
                className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Trip Completed">Trip Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Client Type Filter */}
            <div>
              <select
                value={clientTypeFilter}
                onChange={(e) => setClientTypeFilter(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
              >
                <option value="all">All Client Types</option>
                <option value="Company">Company (Corporate)</option>
                <option value="Individual Customer">Individual Customer</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setClientTypeFilter("all");
                  setStartDateFilter("");
                  setEndDateFilter("");
                }}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs font-normal border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>

          {/* Date Range Sub-Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">From Date:</span>
              <div className="flex-1">
                <CustomDatePicker
                  value={startDateFilter}
                  onChange={setStartDateFilter}
                  placeholder="Filter by start date..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">To Date:</span>
              <div className="flex-1">
                <CustomDatePicker
                  value={endDateFilter}
                  onChange={setEndDateFilter}
                  placeholder="Filter by end date..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Booking #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Vehicle & Driver</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Gross (₹)</th>
                  <th className="py-2.5 px-3 text-right">Received (₹)</th>
                  <th className="py-2.5 px-3 text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading bookings report...
                    </td>
                  </tr>
                ) : filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No bookings found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const gross = Number(b.grossAmount || b.netAmount || 0);
                    const received = Number(b.receivedAmount || b.customerAdvance || 0);
                    const balance = Math.max(0, gross - received);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-900 font-mono">
                          {b.bookingNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {b.startDate} {b.startTime || ""}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">{b.customerName}</div>
                          <span className="text-[10px] text-slate-400">{b.clientType || "Retail"}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-slate-800">{b.fromLocation}</span>
                          {b.toLocation && (
                            <span className="text-slate-400"> → {b.toLocation}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-800">
                            {b.vehicleRegNumber || <span className="text-slate-400">Unassigned</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {b.driverName || "No driver"}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-medium ${
                              b.bookingStatus === "Trip Completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : b.bookingStatus === "Confirmed"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : b.bookingStatus === "In Progress"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : b.bookingStatus === "Cancelled"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {b.bookingStatus || "New"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900 font-mono">
                          ₹{gross.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-600 font-mono">
                          ₹{received.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-amber-600 font-mono">
                          ₹{balance.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredBookings.length} bookings</span>
            <span className="font-mono">Total Value: ₹{metrics.totalGross.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
  );
}
