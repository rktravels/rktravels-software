"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CreditCard,
  Banknote,
  QrCode,
  Coins,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowRight,
  TrendingUp,
  Receipt,
  Download,
  RefreshCw,
  Loader2,
  Building2,
  User,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface PaymentRecord {
  id: string;
  bookingId?: string;
  bookingNumber?: string;
  clientType?: string;
  clientName?: string;
  clientMobile?: string;
  companyName?: string;
  fromLocation?: string;
  toLocation?: string;
  amountCollected?: number;
  amount?: number;
  paymentMode: string;
  date?: string;
  splits?: {
    upi?: number;
    cash?: number;
    card?: number;
  };
  referenceNumber?: string;
  note?: string;
  createdAt?: Timestamp | null;
}

export default function PaymentsPage() {
  // 1. Single Date Filter (default today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState<"all" | "upi" | "cash" | "card" | "split">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Real-time Firestore Subscription
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: PaymentRecord[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          let itemDate = d.date;
          if (!itemDate && d.createdAt) {
            try {
              const jsDate = d.createdAt.toDate();
              itemDate = jsDate.toISOString().split("T")[0];
            } catch {
              // fallback
            }
          }
          list.push({
            id: docSnap.id,
            bookingId: d.bookingId,
            bookingNumber: d.bookingNumber,
            clientType: d.clientType,
            clientName: d.clientName || d.companyName || "Direct Customer",
            clientMobile: d.clientMobile,
            companyName: d.companyName,
            fromLocation: d.fromLocation,
            toLocation: d.toLocation,
            amountCollected: Number(d.amountCollected ?? d.amount ?? 0),
            amount: Number(d.amount ?? d.amountCollected ?? 0),
            paymentMode: d.paymentMode || "cash",
            date: itemDate,
            splits: d.splits,
            referenceNumber: d.referenceNumber,
            note: d.note,
            createdAt: d.createdAt,
          });
        });
        setPayments(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching payments collection:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Filter payments strictly by the selected Date
  const datePayments = useMemo(() => {
    return payments.filter((p) => {
      if (p.date) {
        return p.date === selectedDate;
      }
      if (p.createdAt) {
        try {
          const dStr = p.createdAt.toDate().toISOString().split("T")[0];
          return dStr === selectedDate;
        } catch {
          return false;
        }
      }
      return false;
    });
  }, [payments, selectedDate]);

  // Analytics Computation for the Selected Date
  const analytics = useMemo(() => {
    let totalReceived = 0;
    let upiAmount = 0;
    let cashAmount = 0;
    let cardAmount = 0;

    let upiCount = 0;
    let cashCount = 0;
    let cardCount = 0;
    let splitCount = 0;

    datePayments.forEach((p) => {
      const amt = Number(p.amountCollected || p.amount || 0);
      totalReceived += amt;
      const mode = (p.paymentMode || "").toLowerCase();

      if (mode === "split" && p.splits) {
        splitCount++;
        const u = Number(p.splits.upi || 0);
        const c = Number(p.splits.cash || 0);
        const cd = Number(p.splits.card || 0);
        upiAmount += u;
        cashAmount += c;
        cardAmount += cd;
        if (u > 0) upiCount++;
        if (c > 0) cashCount++;
        if (cd > 0) cardCount++;
      } else if (mode === "upi") {
        upiAmount += amt;
        upiCount++;
      } else if (mode === "card") {
        cardAmount += amt;
        cardCount++;
      } else {
        // default to Cash (including "cash", "advance", etc.)
        cashAmount += amt;
        cashCount++;
      }
    });

    const upiShare = totalReceived > 0 ? Math.round((upiAmount / totalReceived) * 100) : 0;
    const cashShare = totalReceived > 0 ? Math.round((cashAmount / totalReceived) * 100) : 0;
    const cardShare = totalReceived > 0 ? Math.round((cardAmount / totalReceived) * 100) : 0;

    return {
      totalReceived,
      totalCount: datePayments.length,
      upiAmount,
      cashAmount,
      cardAmount,
      upiCount,
      cashCount,
      cardCount,
      splitCount,
      upiShare,
      cashShare,
      cardShare,
      averageTicket: datePayments.length > 0 ? Math.round(totalReceived / datePayments.length) : 0,
    };
  }, [datePayments]);

  // Secondary Filter for Table View
  const filteredList = useMemo(() => {
    return datePayments.filter((p) => {
      const mode = (p.paymentMode || "").toLowerCase();
      if (methodFilter !== "all" && mode !== methodFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const client = (p.clientName || "").toLowerCase();
        const bNo = (p.bookingNumber || "").toLowerCase();
        const ref = (p.referenceNumber || "").toLowerCase();
        const mob = (p.clientMobile || "").toLowerCase();
        const note = (p.note || "").toLowerCase();
        if (
          !client.includes(q) &&
          !bNo.includes(q) &&
          !ref.includes(q) &&
          !mob.includes(q) &&
          !note.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [datePayments, methodFilter, searchQuery]);

  // Date Navigation Helpers
  const shiftDate = (days: number) => {
    const cur = new Date(selectedDate);
    if (isNaN(cur.getTime())) return;
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  const formattedDateTitle = useMemo(() => {
    try {
      const d = new Date(selectedDate + "T00:00:00");
      return d.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // CSV Export for the day's collection
  const handleExportCSV = () => {
    if (datePayments.length === 0) return;
    const headers = [
      "Date",
      "Booking Number",
      "Client / Customer",
      "Mobile",
      "Payment Mode",
      "Total Amount",
      "UPI Component",
      "Cash Component",
      "Card Component",
      "Reference / UTR",
      "Notes",
    ];
    const rows = datePayments.map((p) => [
      `"${p.date || selectedDate}"`,
      `"${p.bookingNumber || ""}"`,
      `"${p.clientName || ""}"`,
      `"${p.clientMobile || ""}"`,
      `"${p.paymentMode}"`,
      `"${p.amountCollected || p.amount || 0}"`,
      `"${p.splits?.upi || (p.paymentMode.toLowerCase() === "upi" ? p.amount : 0)}"`,
      `"${p.splits?.cash || (p.paymentMode.toLowerCase() === "cash" ? p.amount : 0)}"`,
      `"${p.splits?.card || (p.paymentMode.toLowerCase() === "card" ? p.amount : 0)}"`,
      `"${p.referenceNumber || ""}"`,
      `"${(p.note || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Payments_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-3 font-normal text-slate-800">
      {/* 1. Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Link href="/dashboard" className="hover:text-slate-800 transition">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Payments</span>
          </div>
          <h1 className="text-base font-semibold text-slate-900 mt-0.5">
            Payments &amp; Collections
          </h1>
          <p className="text-[11px] text-slate-400">
            Daily settlement analytics by payment method: UPI, Cash, Card, and Split breakdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={datePayments.length === 0}
            className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Download CSV report for this date"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Day CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Date Filter (Default: Today) */}
      <div className="bg-white border border-slate-200 rounded-[6px] p-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Date Selector & Quick Steps */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 h-[34px] rounded-[6px] bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
              <Calendar className="w-3.5 h-3.5 text-[#f16623]" />
              <span>Select Date:</span>
            </div>

            {/* Quick Step Previous Day */}
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="h-[34px] w-[34px] rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Native Date Input */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-[#f16623] cursor-pointer"
            />

            {/* Quick Step Next Day */}
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="h-[34px] w-[34px] rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Today Preset Button */}
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
              className={`h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
                isToday
                  ? "bg-[#f16623] text-white shadow-xs"
                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              Today
            </button>

            {/* Yesterday Preset Button */}
            <button
              type="button"
              onClick={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                setSelectedDate(y.toISOString().split("T")[0]);
              }}
              className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              Yesterday
            </button>
          </div>

          {/* Right: Active Date Pill Display */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-[6px] bg-orange-50 border border-[#f16623]/25 text-xs text-orange-950 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#f16623] animate-pulse" />
              <span>{formattedDateTitle}</span>
              {isToday && (
                <span className="px-1.5 py-0.2 rounded bg-[#f16623] text-white text-[10px] font-semibold">
                  Today
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Analytics KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Total Received */}
        <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 shadow-2xs hover:border-[#f16623]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Amount Received
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-orange-50 text-[#f16623] flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ₹{analytics.totalReceived.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{analytics.totalCount}</span>
            <span>settlements recorded</span>
            <span>•</span>
            <span>Avg ₹{analytics.averageTicket.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Metric 2: UPI Collections */}
        <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 shadow-2xs hover:border-purple-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              UPI Received
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-purple-50 text-purple-600 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-purple-700">
              ₹{analytics.upiAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] font-semibold text-purple-600">
              {analytics.upiShare}% share
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <span>{analytics.upiCount} UPI transactions</span>
          </div>
        </div>

        {/* Metric 3: Cash Collections */}
        <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 shadow-2xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Cash Received
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-700">
              ₹{analytics.cashAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] font-semibold text-emerald-600">
              {analytics.cashShare}% share
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <span>{analytics.cashCount} Cash transactions</span>
          </div>
        </div>

        {/* Metric 4: Card Collections */}
        <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 shadow-2xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Card Received
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-700">
              ₹{analytics.cardAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] font-semibold text-blue-600">
              {analytics.cardShare}% share
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <span>{analytics.cardCount} Card transactions</span>
          </div>
        </div>
      </div>

      {/* 4. Visual Payment Method Ratio Progress Bar */}
      {analytics.totalReceived > 0 && (
        <div className="p-3 bg-white border border-slate-200 rounded-[6px] shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#f16623]" />
              Payment Method Distribution Ratio
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Total ₹{analytics.totalReceived.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-100 flex overflow-hidden">
            <div
              style={{ width: `${analytics.upiShare}%` }}
              className="bg-purple-500 h-full transition-all"
              title={`UPI: ₹${analytics.upiAmount.toLocaleString("en-IN")} (${analytics.upiShare}%)`}
            />
            <div
              style={{ width: `${analytics.cashShare}%` }}
              className="bg-emerald-500 h-full transition-all"
              title={`Cash: ₹${analytics.cashAmount.toLocaleString("en-IN")} (${analytics.cashShare}%)`}
            />
            <div
              style={{ width: `${analytics.cardShare}%` }}
              className="bg-blue-500 h-full transition-all"
              title={`Card: ₹${analytics.cardAmount.toLocaleString("en-IN")} (${analytics.cardShare}%)`}
            />
          </div>

          <div className="flex items-center gap-4 text-[11px] pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-600">UPI:</span>
              <span className="font-mono font-semibold text-purple-700">
                ₹{analytics.upiAmount.toLocaleString("en-IN")} ({analytics.upiShare}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600">Cash:</span>
              <span className="font-mono font-semibold text-emerald-700">
                ₹{analytics.cashAmount.toLocaleString("en-IN")} ({analytics.cashShare}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600">Card:</span>
              <span className="font-mono font-semibold text-blue-700">
                ₹{analytics.cardAmount.toLocaleString("en-IN")} ({analytics.cardShare}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Transactions Table Filter & Search Controls */}
      <div className="bg-white border border-slate-200 rounded-[6px] p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Method Filter Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {(
              [
                { id: "all", label: "All Methods", count: datePayments.length },
                { id: "upi", label: "UPI", count: analytics.upiCount },
                { id: "cash", label: "Cash", count: analytics.cashCount },
                { id: "card", label: "Card", count: analytics.cardCount },
                { id: "split", label: "Split", count: analytics.splitCount },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMethodFilter(tab.id)}
                className={`h-[30px] px-2.5 rounded-[5px] text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  methodFilter === tab.id
                    ? "bg-[#f16623] text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1 rounded text-[10px] font-mono ${
                    methodFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, UTR, ref..."
              className="w-full h-[32px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
            />
          </div>
        </div>

        {/* 6. Transactions Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading payments data...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-1">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-xs font-medium text-slate-600">
              No payments recorded for {selectedDate}
            </p>
            <p className="text-[11px] text-slate-400">
              Select another date or collect payment in the Credit or Bookings page.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-[6px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Customer / Company</th>
                  <th className="py-2.5 px-3">Trip Ref</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">UTR / Ref Number</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((p) => {
                  const mode = (p.paymentMode || "").toUpperCase();
                  const timeStr = p.createdAt
                    ? p.createdAt.toDate().toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition">
                      {/* Time */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {timeStr}
                        </span>
                      </td>

                      {/* Customer / Company */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {p.clientType === "company" ? (
                            <Building2 className="w-3 h-3 text-purple-600 shrink-0" />
                          ) : (
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <span>{p.clientName}</span>
                        </div>
                        {p.clientMobile && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {p.clientMobile}
                          </span>
                        )}
                      </td>

                      {/* Trip Ref */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                        {p.bookingNumber || "—"}
                        {p.fromLocation && p.toLocation && (
                          <span className="text-[10px] text-slate-400 font-sans block truncate max-w-[150px]">
                            {p.fromLocation} ➔ {p.toLocation}
                          </span>
                        )}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border w-fit ${
                              mode === "UPI"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : mode === "CASH"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : mode === "CARD"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : mode === "SPLIT"
                                ? "bg-orange-50 text-[#f16623] border-orange-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {mode === "UPI" && <QrCode className="w-2.5 h-2.5" />}
                            {mode === "CASH" && <Banknote className="w-2.5 h-2.5" />}
                            {mode === "CARD" && <CreditCard className="w-2.5 h-2.5" />}
                            {mode === "SPLIT" && <Coins className="w-2.5 h-2.5" />}
                            <span>{mode}</span>
                          </span>

                          {/* Split Breakdown */}
                          {mode === "SPLIT" && p.splits && (
                            <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono mt-0.5">
                              {Number(p.splits.upi) > 0 && (
                                <span className="px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                  UPI: ₹{Number(p.splits.upi).toLocaleString("en-IN")}
                                </span>
                              )}
                              {Number(p.splits.cash) > 0 && (
                                <span className="px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                  Cash: ₹{Number(p.splits.cash).toLocaleString("en-IN")}
                                </span>
                              )}
                              {Number(p.splits.card) > 0 && (
                                <span className="px-1 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                  Card: ₹{Number(p.splits.card).toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Reference / UTR */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {p.referenceNumber ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {p.referenceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-[200px] truncate">
                        {p.note || "—"}
                      </td>

                      {/* Amount Collected */}
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-mono font-semibold text-emerald-700 text-xs">
                          ₹{(p.amountCollected || p.amount || 0).toLocaleString("en-IN")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold text-xs text-slate-900">
                  <td colSpan={6} className="py-2.5 px-3 text-right text-slate-600 font-medium">
                    Total Collected on {selectedDate}:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                    ₹{analytics.totalReceived.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
