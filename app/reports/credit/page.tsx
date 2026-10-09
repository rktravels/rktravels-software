"use client";

import { useState, useEffect, useMemo } from "react";
import {
  WalletCards,
  Search,
  Download,
  Printer,
  RefreshCw,
  IndianRupee,
  Clock,
  AlertCircle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
  Filter,
} from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
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

interface Booking {
  id: string;
  bookingNumber: string;
  startDate: string;
  customerName: string;
  clientType?: string;
  fromLocation?: string;
  toLocation?: string;
  vehicleRegNumber?: string;
  driverName?: string;
  grossAmount?: number;
  netAmount?: number;
  receivedAmount?: number;
  customerAdvance?: number;
  balanceAmount?: number;
  bookingStatus?: string;
  paymentStatus?: string;
}

export default function CreditReportPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Scope: "all" or specific customer/company name
  const [selectedCustomer, setSelectedCustomer] = useState<string>("all");

  // Date filters
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Table filters
  const [searchQuery, setSearchQuery] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const dateRange = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  useEffect(() => {
    const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setBookings(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading credit report:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const periodBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.startDate) return false;
      if (dateRange.startDate && b.startDate < dateRange.startDate) return false;
      if (dateRange.endDate && b.startDate > dateRange.endDate) return false;
      return true;
    });
  }, [bookings, dateRange]);

  // Aggregate credit and aging per customer
  const creditByCustomer = useMemo(() => {
    const map: Record<
      string,
      {
        customerName: string;
        clientType: string;
        totalBilled: number;
        totalReceived: number;
        totalPending: number;
        tripsCount: number;
        latestTripDate: string;
        daysOverdue: number;
      }
    > = {};

    const todayMs = new Date().getTime();

    periodBookings.forEach((b) => {
      const name = b.customerName?.trim() || "Walk-in Guest";
      if (!map[name]) {
        map[name] = {
          customerName: name,
          clientType: b.clientType || "Retail",
          totalBilled: 0,
          totalReceived: 0,
          totalPending: 0,
          tripsCount: 0,
          latestTripDate: b.startDate || "",
          daysOverdue: 0,
        };
      }

      const billed = Number(b.grossAmount || b.netAmount || 0);
      const received = Number(b.receivedAmount || b.customerAdvance || 0);
      const pending = Math.max(0, billed - received);

      map[name].totalBilled += billed;
      map[name].totalReceived += received;
      map[name].totalPending += pending;
      map[name].tripsCount += 1;

      if (b.startDate && b.startDate > map[name].latestTripDate) {
        map[name].latestTripDate = b.startDate;
      }

      if (pending > 0 && b.startDate) {
        const diffDays = Math.max(
          0,
          Math.floor((todayMs - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24))
        );
        map[name].daysOverdue = Math.max(map[name].daysOverdue, diffDays);
      }
    });

    return Object.values(map);
  }, [periodBookings]);

  // Unique customers list for selector
  const customerNamesList = useMemo(() => {
    return creditByCustomer.map((c) => c.customerName).sort();
  }, [creditByCustomer]);

  // Individual Customer Selected Data
  const individualCustomerData = useMemo(() => {
    if (selectedCustomer === "all") return null;
    const account = creditByCustomer.find((c) => c.customerName === selectedCustomer);
    if (!account) return null;

    const customerBookings = periodBookings.filter(
      (b) => (b.customerName?.trim() || "Walk-in Guest") === selectedCustomer
    );

    const dailyMap: Record<string, { billed: number; received: number; trips: number }> = {};
    customerBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!dailyMap[key]) dailyMap[key] = { billed: 0, received: 0, trips: 0 };
      dailyMap[key].billed += Number(b.grossAmount || 0);
      dailyMap[key].received += Number(b.receivedAmount || b.customerAdvance || 0);
      dailyMap[key].trips += 1;
    });

    const sortedDays = Object.keys(dailyMap).sort();

    const statusMap: Record<string, number> = {};
    customerBookings.forEach((b) => {
      const st = b.bookingStatus || "Confirmed";
      statusMap[st] = (statusMap[st] || 0) + 1;
    });

    return {
      account,
      bookings: customerBookings,
      dailyPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].trips,
      })),
      billedAreaPoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].billed,
      })),
      receivedLinePoints: sortedDays.map((d) => ({
        label: d,
        value: dailyMap[d].received,
      })),
      statusSlices: Object.entries(statusMap).map(([label, value]) => ({ label, value })),
    };
  }, [selectedCustomer, creditByCustomer, periodBookings]);

  // Overall Financial Totals (All accounts)
  const totals = useMemo(() => {
    let billed = 0;
    let received = 0;
    let pending = 0;
    let accountsWithBalance = 0;

    let aging0to15 = 0;
    let aging16to30 = 0;
    let aging31to60 = 0;
    let aging60Plus = 0;

    creditByCustomer.forEach((c) => {
      billed += c.totalBilled;
      received += c.totalReceived;
      pending += c.totalPending;
      if (c.totalPending > 0) {
        accountsWithBalance += 1;
        if (c.daysOverdue <= 15) aging0to15 += c.totalPending;
        else if (c.daysOverdue <= 30) aging16to30 += c.totalPending;
        else if (c.daysOverdue <= 60) aging31to60 += c.totalPending;
        else aging60Plus += c.totalPending;
      }
    });

    return {
      totalAccounts: creditByCustomer.length,
      accountsWithBalance,
      billed,
      received,
      pending,
      aging0to15,
      aging16to30,
      aging31to60,
      aging60Plus,
      collectionRate: billed > 0 ? Math.round((received / billed) * 100) : 0,
    };
  }, [creditByCustomer]);

  // All Accounts Graphs Data
  const topDebtors = useMemo(() => {
    return [...creditByCustomer]
      .filter((c) => c.totalPending > 0)
      .sort((a, b) => b.totalPending - a.totalPending)
      .slice(0, 5)
      .map((c) => ({
        id: c.customerName,
        label: c.customerName,
        subLabel: `${c.clientType} • ${c.tripsCount} trips`,
        value: c.totalPending,
        secondaryValue: `${formatINR(c.totalPending)} due`,
      }));
  }, [creditByCustomer]);

  const collectionDonutSegments = useMemo(() => {
    return [
      { label: "Cash Collected", value: totals.received, color: "#059669" },
      { label: "Pending Balance", value: totals.pending, color: "#e11d48" },
    ].filter((s) => s.value > 0);
  }, [totals]);

  const clientTypePieSlices = useMemo(() => {
    const map: Record<string, number> = {};
    creditByCustomer.forEach((c) => {
      if (c.totalPending > 0) {
        map[c.clientType] = (map[c.clientType] || 0) + c.totalPending;
      }
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [creditByCustomer]);

  const dailyBillingPoints = useMemo(() => {
    const map: Record<string, { billed: number; received: number }> = {};
    periodBookings.forEach((b) => {
      if (!b.startDate) return;
      const key = b.startDate.slice(5);
      if (!map[key]) map[key] = { billed: 0, received: 0 };
      map[key].billed += Number(b.grossAmount || 0);
      map[key].received += Number(b.receivedAmount || b.customerAdvance || 0);
    });
    const sorted = Object.keys(map).sort();
    return sorted.slice(-10).map((d) => ({
      label: d,
      value: Math.round(map[d].billed / 1000),
      secondaryValue: Math.round(map[d].received / 1000),
    }));
  }, [periodBookings]);

  const collectionsAreaPoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
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
  }, [periodBookings]);

  const invoicedLinePoints = useMemo(() => {
    const map: Record<string, number> = {};
    periodBookings.forEach((b) => {
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
  }, [periodBookings]);

  const filteredCustomers = useMemo(() => {
    return creditByCustomer.filter((c) => {
      if (clientTypeFilter !== "all" && c.clientType !== clientTypeFilter) return false;
      if (statusFilter === "pending" && c.totalPending <= 0) return false;
      if (statusFilter === "settled" && c.totalPending > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.customerName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [creditByCustomer, clientTypeFilter, statusFilter, searchQuery]);

  const handleExportCSV = () => {
    const headers = [
      "Client / Customer Name",
      "Client Type",
      "Trips Count",
      "Total Invoiced (INR)",
      "Received (INR)",
      "Pending Balance (INR)",
      "Aging Days",
      "Account Status",
    ];

    const dataRows = (selectedCustomer === "all" ? filteredCustomers : individualCustomerData ? [individualCustomerData.account] : []).map((c) => [
      `"${c.customerName}"`,
      `"${c.clientType}"`,
      c.tripsCount,
      c.totalBilled,
      c.totalReceived,
      c.totalPending,
      c.daysOverdue,
      c.totalPending > 0 ? "Pending Dues" : "Settled",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...dataRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `credit_report_${selectedCustomer}_${dateRange.startDate || "all"}.csv`);
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
            <WalletCards className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-none">
              Client Credit & Accounts Receivable Report
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer aging ledger, outstanding balances, and company credit drilldown
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

      {/* Scope Selector: All Accounts vs Individual Company / Customer */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#f16623]" />
            Report Scope:
          </span>

          <button
            type="button"
            onClick={() => setSelectedCustomer("all")}
            className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              selectedCustomer === "all"
                ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Accounts ({creditByCustomer.length})
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">or</span>
            <select
              value={selectedCustomer === "all" ? "" : selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value || "all")}
              className={`h-[34px] max-h-[34px] px-2.5 rounded-[6px] border text-xs font-medium cursor-pointer transition ${
                selectedCustomer !== "all"
                  ? "border-[#f16623] text-[#f16623] bg-orange-50/50"
                  : "border-slate-200 text-slate-700 bg-white"
              }`}
            >
              <option value="">Select Individual Company / Customer...</option>
              {customerNamesList.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {individualCustomerData && (
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-[4px] bg-blue-50 text-blue-700 font-semibold">
              {individualCustomerData.account.customerName}
            </span>
            <span className="text-slate-500 font-medium">
              {individualCustomerData.account.clientType} • {individualCustomerData.account.tripsCount} trips
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

      {/* VIEW A: INDIVIDUAL COMPANY / CUSTOMER DRILLDOWN */}
      {selectedCustomer !== "all" && individualCustomerData && (
        <div className="space-y-4">
          {/* Individual Customer KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Total Bookings</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {individualCustomerData.account.tripsCount}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Trips fulfilled</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Total Invoiced</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatINR(individualCustomerData.account.totalBilled)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Gross billing value</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Amount Paid / Received</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {formatINR(individualCustomerData.account.totalReceived)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Settled in bank/cash</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#e11d48] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Pending Due Balance</div>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatINR(individualCustomerData.account.totalPending)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Outstanding receivable</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="text-slate-400 text-xs">Aging Overdue</div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {individualCustomerData.account.daysOverdue} days
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {individualCustomerData.account.totalPending > 0 ? "Pending collection" : "Clear account"}
              </div>
            </div>
          </div>

          {/* Individual Graphs Row 1: Split Meter */}
          <SolidStackedMeter
            title={`Payment Settlement Ratio: ${individualCustomerData.account.customerName}`}
            subtitle="Cash settled vs uncollected balance for this client"
            unit="₹"
            segments={[
              {
                label: "Amount Paid",
                value: individualCustomerData.account.totalReceived,
                color: "#059669",
                subText: "Settled payments",
              },
              {
                label: "Pending Dues",
                value: individualCustomerData.account.totalPending,
                color: "#e11d48",
                subText: "Outstanding balance",
              },
            ]}
          />

          {/* Individual Graphs Row 2: Pie, Bar & Area */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidPieChart
              title="Booking Statuses (Pie Chart)"
              subtitle="Completed vs in transit trips"
              slices={individualCustomerData.statusSlices}
              valueFormatter={(v) => `${v} trips`}
            />

            <SolidBarChart
              title="Daily Trips Logged (Bar Chart)"
              subtitle="Bookings per day for this company"
              points={individualCustomerData.dailyPoints}
              primaryLabel="Trips"
              valueFormatter={(v) => `${v}`}
            />

            <SolidAreaChart
              title="Daily Billing Accrual (Area Graph)"
              subtitle="Gross fare generated per day"
              data={individualCustomerData.billedAreaPoints}
              color="#f16623"
              valueFormatter={(v) => formatINR(v)}
            />
          </div>

          {/* Individual Trips Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-900">
                Billing & Booking History: {individualCustomerData.account.customerName}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2.5">Booking / Date</th>
                    <th className="px-3 py-2.5">Route</th>
                    <th className="px-3 py-2.5">Vehicle & Driver</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-right">Invoiced (₹)</th>
                    <th className="px-3 py-2.5 text-right">Received (₹)</th>
                    <th className="px-3 py-2.5 text-right">Balance Due (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {individualCustomerData.bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">{b.bookingNumber}</div>
                        <div className="text-[11px] text-slate-400">{b.startDate}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div>{b.fromLocation}</div>
                        <div className="text-[11px] text-slate-400">→ {b.toLocation || "Local"}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-slate-900">{b.vehicleRegNumber || "—"}</div>
                        <div className="text-[10px] text-slate-400">{b.driverName || "—"}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                          {b.bookingStatus || "Confirmed"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {formatINR(Number(b.grossAmount || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-emerald-600">
                        {formatINR(Number(b.receivedAmount || b.customerAdvance || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-rose-600">
                        {formatINR(Number(b.balanceAmount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW B: ALL CLIENT ACCOUNTS OVERVIEW */}
      {selectedCustomer === "all" && (
        <div className="space-y-4">
          {/* Global KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border-l-4 border-l-[#2563eb] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Credit Accounts</span>
                <Building2 className="w-3.5 h-3.5 text-[#2563eb]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totals.totalAccounts}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{totals.accountsWithBalance} with dues</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#f16623] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Invoiced</span>
                <IndianRupee className="w-3.5 h-3.5 text-[#f16623]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatCompactINR(totals.billed)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Period billing</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Total Collected</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-1">
                {formatCompactINR(totals.received)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{totals.collectionRate}% collected</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#e11d48] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Outstanding Dues</span>
                <AlertCircle className="w-3.5 h-3.5 text-[#e11d48]" />
              </div>
              <div className="text-xl font-bold text-rose-600 mt-1">
                {formatCompactINR(totals.pending)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending collection</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#d97706] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>High Risk (&gt;30d)</span>
                <Clock className="w-3.5 h-3.5 text-[#d97706]" />
              </div>
              <div className="text-xl font-bold text-amber-600 mt-1">
                {formatCompactINR(totals.aging31to60 + totals.aging60Plus)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Overdue &gt;30 days</div>
            </div>

            <div className="bg-white border-l-4 border-l-[#059669] border border-slate-200/90 rounded-[6px] p-3 shadow-2xs">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Recovery Rate</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#059669]" />
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">{totals.collectionRate}%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Billing to cash ratio</div>
            </div>
          </div>

          {/* Aging Stacked Meter */}
          <SolidStackedMeter
            title="Outstanding Receivables Aging Analysis"
            subtitle="Distribution of pending customer balances by overdue duration"
            unit="₹"
            segments={[
              {
                label: "0–15 Days (Current)",
                value: totals.aging0to15,
                color: "#059669",
                subText: "Normal credit cycle",
              },
              {
                label: "16–30 Days (Follow-up)",
                value: totals.aging16to30,
                color: "#2563eb",
                subText: "Due for reminder",
              },
              {
                label: "31–60 Days (Warning)",
                value: totals.aging31to60,
                color: "#d97706",
                subText: "Escalation required",
              },
              {
                label: "60+ Days (Critical)",
                value: totals.aging60Plus,
                color: "#e11d48",
                subText: "High risk debt",
              },
            ]}
          />

          {/* Row 2: Top Debtors Bar, Collection Donut, Client Type Pie */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidHorizontalBarChart
              title="Top Debtors by Outstanding (Bar Chart)"
              subtitle="Highest pending balances"
              items={topDebtors}
              valueFormatter={(val) => formatCompactINR(val)}
            />

            <SolidDonutChart
              title="Cash Collection (Donut Chart)"
              subtitle="Collected vs pending proportion"
              segments={collectionDonutSegments}
              centerLabel="Billing"
              centerValue={formatCompactINR(totals.billed)}
              valueFormatter={(v) => formatCompactINR(v)}
            />

            <SolidPieChart
              title="Credit Exposure by Client Type (Pie Chart)"
              subtitle="Pending balance distribution"
              slices={clientTypePieSlices}
              valueFormatter={(v) => formatCompactINR(v)}
            />
          </div>

          {/* Row 3: Daily Invoiced vs Collected Bar, Cash Area Graph, Invoiced Line Graph */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SolidBarChart
              title="Daily Billing vs Collected (Bar Chart)"
              subtitle="Invoiced fare vs cash received (in ₹k)"
              points={dailyBillingPoints}
              primaryLabel="Invoiced (₹k)"
              secondaryLabel="Collected (₹k)"
              valueFormatter={(val) => `₹${val}k`}
            />

            <SolidAreaChart
              title="Cash Collection Velocity (Area Graph)"
              subtitle="Daily cash receipts inflow"
              data={collectionsAreaPoints}
              color="#059669"
              valueFormatter={(val) => formatINR(val)}
            />

            <SolidLineChart
              title="Invoiced Fare Curve (Line Graph)"
              subtitle="Daily gross billing volume"
              data={invoicedLinePoints}
              lineColor="#f16623"
              valueFormatter={(val) => formatINR(val)}
            />
          </div>

          {/* Accounts Table */}
          <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search client / company name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 text-xs focus:outline-hidden focus:border-[#f16623]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={clientTypeFilter}
                  onChange={(e) => setClientTypeFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Client Types</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Retail">Retail</option>
                  <option value="Hotel">Hotel</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 text-xs text-slate-700 bg-white cursor-pointer"
                >
                  <option value="all">All Balance Statuses</option>
                  <option value="pending">With Pending Dues</option>
                  <option value="settled">Fully Settled</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5">Client / Company Name</th>
                    <th className="px-3 py-2.5">Client Type</th>
                    <th className="px-3 py-2.5 text-center">Trips</th>
                    <th className="px-3 py-2.5 text-right">Invoiced (₹)</th>
                    <th className="px-3 py-2.5 text-right">Received (₹)</th>
                    <th className="px-3 py-2.5 text-right">Pending Balance (₹)</th>
                    <th className="px-3 py-2.5 text-center">Aging Days</th>
                    <th className="px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin inline mr-1 text-[#f16623]" />
                        Loading credit accounts...
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                        No customer accounts found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => {
                      const hasDue = c.totalPending > 0;
                      return (
                        <tr key={c.customerName} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3 py-2.5 font-semibold text-slate-900">{c.customerName}</td>
                          <td className="px-3 py-2.5">
                            <span className="text-slate-700 font-medium">{c.clientType}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-slate-900">
                            {c.tripsCount}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatINR(c.totalBilled)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-emerald-600">
                            {formatINR(c.totalReceived)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-600">
                            {formatINR(c.totalPending)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {hasDue ? (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-[3px] font-semibold text-[11px] ${
                                  c.daysOverdue > 30
                                    ? "bg-rose-100 text-rose-700"
                                    : c.daysOverdue > 15
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {c.daysOverdue}d overdue
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">0d (Clear)</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedCustomer(c.customerName)}
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
