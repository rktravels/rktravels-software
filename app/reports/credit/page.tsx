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
} from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [clientTypeFilter, setClientTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  // Aggregate credit per customer/company
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
      }
    > = {};

    bookings.forEach((b) => {
      const name = b.customerName?.trim() || "Unspecified Customer";
      const gross = Number(b.grossAmount || b.netAmount || 0);
      const received = Number(b.receivedAmount || b.customerAdvance || 0);
      const pending = Math.max(0, gross - received);

      if (!map[name]) {
        map[name] = {
          customerName: name,
          clientType: b.clientType || "Company",
          totalBilled: 0,
          totalReceived: 0,
          totalPending: 0,
          tripsCount: 0,
          latestTripDate: b.startDate || "",
        };
      }

      map[name].totalBilled += gross;
      map[name].totalReceived += received;
      map[name].totalPending += pending;
      map[name].tripsCount++;
      if (b.startDate && b.startDate > map[name].latestTripDate) {
        map[name].latestTripDate = b.startDate;
      }
    });

    return Object.values(map);
  }, [bookings]);

  const filteredData = useMemo(() => {
    return creditByCustomer.filter((item) => {
      if (clientTypeFilter !== "all" && item.clientType !== clientTypeFilter) return false;
      if (statusFilter === "pendingOnly" && item.totalPending <= 0) return false;
      if (statusFilter === "clearedOnly" && item.totalPending > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.customerName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [creditByCustomer, clientTypeFilter, statusFilter, searchQuery]);

  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let accountsWithDue = 0;

    filteredData.forEach((item) => {
      totalBilled += item.totalBilled;
      totalReceived += item.totalReceived;
      totalPending += item.totalPending;
      if (item.totalPending > 0) accountsWithDue++;
    });

    return { totalBilled, totalReceived, totalPending, accountsWithDue };
  }, [filteredData]);

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = [
      "Customer / Company",
      "Client Type",
      "Trips Count",
      "Total Billed (₹)",
      "Total Received (₹)",
      "Outstanding Balance (₹)",
      "Status",
    ];

    const rows = filteredData.map((item) => [
      `"${item.customerName.replace(/"/g, '""')}"`,
      `"${item.clientType}"`,
      item.tripsCount,
      item.totalBilled,
      item.totalReceived,
      item.totalPending,
      item.totalPending > 0 ? "Pending Due" : "Settled",
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Credit_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[6px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                <WalletCards className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Credit Report
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Accounts receivable ledger, corporate client credit balances, and collections reconciliation
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredData.length === 0}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Invoiced
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1 font-mono">
              ₹{metrics.totalBilled.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Lifetime trip bookings</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Collected
            </span>
            <div className="text-lg font-semibold text-emerald-600 mt-1 font-mono">
              ₹{metrics.totalReceived.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Reconciled receipts</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Outstanding
            </span>
            <div className="text-lg font-semibold text-amber-600 mt-1 font-mono">
              ₹{metrics.totalPending.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Unpaid client balances</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Accounts with Dues
            </span>
            <div className="text-lg font-semibold text-rose-600 mt-1">
              {metrics.accountsWithDue}
            </div>
            <span className="text-[10px] text-slate-400">Pending recovery</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-[6px] border border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company or customer name..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
            />
          </div>

          <div className="w-full sm:w-44">
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

          <div className="w-full sm:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
            >
              <option value="all">All Balances</option>
              <option value="pendingOnly">Pending Due Only</option>
              <option value="clearedOnly">Fully Settled Only</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setClientTypeFilter("all");
              setStatusFilter("all");
            }}
            className="w-full sm:w-auto h-[34px] max-h-[34px] px-3 text-xs font-normal border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Client / Company Name</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-center">Trips</th>
                  <th className="py-2.5 px-3">Latest Trip</th>
                  <th className="py-2.5 px-3 text-right">Total Billed (₹)</th>
                  <th className="py-2.5 px-3 text-right">Collected (₹)</th>
                  <th className="py-2.5 px-3 text-right">Outstanding (₹)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading credit report...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {item.customerName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="inline-block px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-[10px] text-slate-700 font-medium">
                          {item.clientType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                        {item.tripsCount}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        {item.latestTripDate || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                        ₹{item.totalBilled.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-medium">
                        ₹{item.totalReceived.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-600">
                        ₹{item.totalPending.toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-medium ${
                            item.totalPending > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {item.totalPending > 0 ? "Pending" : "Settled"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredData.length} client ledgers</span>
            <span className="font-mono">Total Outstanding: ₹{metrics.totalPending.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
  );
}
