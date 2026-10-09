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
  SolidBarChart,
  SolidStackedMeter,
  SolidLineChart,
} from "@/components/reports/ReportCharts";

interface Booking {
  id: string;
  bookingNumber: string;
  startDate: string;
  customerName: string;
  clientType?: string;
  grossAmount?: number;
  netAmount?: number;
  receivedAmount?: number;
  customerAdvance?: number;
  paymentStatus?: string;
}

export default function CreditReportPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Filter bookings in period
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

  // Overall Financial Totals
  const totals = useMemo(() => {
    let billed = 0;
    let received = 0;
    let pending = 0;
    let accountsWithBalance = 0;

    // Aging buckets
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

  // 1. Top Debtors / Highest Pending Clients (Horizontal Bar)
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

  // 2. Collection Split Donut (Received vs Pending)
  const collectionDonutSegments = useMemo(() => {
    return [
      { label: "Cash Collected", value: totals.received, color: "#059669" },
      { label: "Pending Receivables", value: totals.pending, color: "#e11d48" },
    ].filter((s) => s.value > 0);
  }, [totals]);

  // 3. Client Type Exposure Donut
  const clientTypeSegments = useMemo(() => {
    const map: Record<string, number> = {};
    creditByCustomer.forEach((c) => {
      if (c.totalPending > 0) {
        map[c.clientType] = (map[c.clientType] || 0) + c.totalPending;
      }
    });
    return Object.entries(map).map(([label, value]) => ({ label, value }));
  }, [creditByCustomer]);

  // 4. Daily Billing & Collections Bar Chart
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
      value: Math.round(map[d].billed / 1000), // in thousands
      secondaryValue: Math.round(map[d].received / 1000),
    }));
  }, [periodBookings]);

  // 5. Daily Collections Trend Line
  const collectionsTrend = useMemo(() => {
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

  // Filtered Table Data
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

  // Export CSV
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

    const rows = filteredCustomers.map((c) => [
      `"${c.customerName}"`,
      `"${c.clientType}"`,
      c.tripsCount,
      c.totalBilled,
      c.totalReceived,
      c.totalPending,
      c.daysOverdue,
      c.totalPending > 0 ? "Pending Dues" : "Settled",
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `credit_report_${dateRange.startDate || "all"}.csv`);
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
              Customer aging ledger, outstanding dues, payment collection efficiency, and high-risk accounts
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

      {/* Row 1: Aging Buckets Stacked Meter */}
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
            label: "60+ Days (High Risk)",
            value: totals.aging60Plus,
            color: "#e11d48",
            subText: "Critical debt action",
          },
        ]}
      />

      {/* Row 2: Top Debtors, Settlement Donut, Exposure Donut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SolidHorizontalBarChart
          title="Top Clients by Outstanding Balance"
          subtitle="Highest pending receivables accounts"
          items={topDebtors}
          valueFormatter={(val) => formatCompactINR(val)}
        />

        <SolidDonutChart
          title="Cash Collection Proportion"
          subtitle="Received revenue vs uncollected receivables"
          segments={collectionDonutSegments}
          centerLabel="Billing"
          centerValue={formatCompactINR(totals.billed)}
          valueFormatter={(v) => formatCompactINR(v)}
        />

        <SolidDonutChart
          title="Credit Exposure by Client Type"
          subtitle="Pending balance distribution"
          segments={clientTypeSegments}
          centerLabel="Due"
          centerValue={formatCompactINR(totals.pending)}
          valueFormatter={(v) => formatCompactINR(v)}
        />
      </div>

      {/* Row 3: Daily Activity Bar & Cash Receipts Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SolidBarChart
          title="Daily Invoiced vs Collected (₹ in thousands)"
          subtitle="Comparison of daily bookings fare vs payments received"
          points={dailyBillingPoints}
          primaryLabel="Invoiced (₹k)"
          secondaryLabel="Collected (₹k)"
          valueFormatter={(val) => `₹${val}k`}
        />

        <SolidLineChart
          title="Cash Inflow Velocity Trend (₹)"
          subtitle="Daily collections received from customers"
          data={collectionsTrend}
          lineColor="#059669"
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
                <th className="px-3 py-2.5 text-right">Total Invoiced (₹)</th>
                <th className="px-3 py-2.5 text-right">Received (₹)</th>
                <th className="px-3 py-2.5 text-right">Pending Balance (₹)</th>
                <th className="px-3 py-2.5 text-center">Aging Days</th>
                <th className="px-3 py-2.5 text-center">Status</th>
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-[3px] text-[10px] font-medium ${
                            hasDue
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          }`}
                        >
                          {hasDue ? "Pending Due" : "Settled"}
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
