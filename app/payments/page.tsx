"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CreditCard,
  Banknote,
  QrCode,
  Coins,
  Search,
  IndianRupee,
  Calendar,
  ArrowRight,
  PhoneCall,
  Loader2,
  Receipt,
  User,
  Building2,
  FileCheck,
  TrendingUp,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PaymentSplits {
  cash?: number;
  upi?: number;
  card?: number;
}

interface PaymentRecord {
  id: string;
  bookingId?: string;
  bookingNumber?: string;
  clientType?: "customer" | "business_owner";
  clientName?: string;
  clientMobile?: string;
  companyName?: string;
  fromLocation?: string;
  toLocation?: string;
  amountCollected: number;
  paymentMode: "cash" | "upi" | "card" | "split";
  splits?: PaymentSplits | null;
  note?: string;
  createdAt?: Timestamp | null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "today" | "yesterday" | "this_month" | "all"
  >("today");
  const [modeFilter, setModeFilter] = useState<string>("all");

  // Subscribe to real-time payments collection
  useEffect(() => {
    try {
      const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: PaymentRecord[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<PaymentRecord, "id">),
            amountCollected:
              Number(
                docSnap.data().amountCollected || docSnap.data().amount || 0
              ) || 0,
          }));
          setPayments(items);
          setLoading(false);
        },
        (err) => {
          console.error("Payments listener error, falling back:", err);
          const fallback = query(collection(db, "payments"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: PaymentRecord[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<PaymentRecord, "id">),
              amountCollected:
                Number(
                  docSnap.data().amountCollected || docSnap.data().amount || 0
                ) || 0,
            }));
            setPayments(items);
            setLoading(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load payments:", err);
      setLoading(false);
    }
  }, []);

  // Helper to check if a date is today
  const isToday = (timestamp?: Timestamp | null) => {
    if (!timestamp || typeof timestamp.toDate !== "function") return false;
    const d = timestamp.toDate();
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Helper to check if a date is yesterday
  const isYesterday = (timestamp?: Timestamp | null) => {
    if (!timestamp || typeof timestamp.toDate !== "function") return false;
    const d = timestamp.toDate();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  };

  // Helper to check if a date is this month
  const isThisMonth = (timestamp?: Timestamp | null) => {
    if (!timestamp || typeof timestamp.toDate !== "function") return false;
    const d = timestamp.toDate();
    const today = new Date();
    return (
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // 1. TODAY'S COLLECTIONS & MODE BREAKDOWN
  const todayPayments = useMemo(() => {
    return payments.filter((p) => isToday(p.createdAt));
  }, [payments]);

  const todayTotal = useMemo(() => {
    return todayPayments.reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [todayPayments]);

  const todayCash = useMemo(() => {
    return todayPayments
      .filter((p) => p.paymentMode === "cash")
      .reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [todayPayments]);

  const todayUpi = useMemo(() => {
    return todayPayments
      .filter((p) => p.paymentMode === "upi")
      .reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [todayPayments]);

  const todayCard = useMemo(() => {
    return todayPayments
      .filter((p) => p.paymentMode === "card")
      .reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [todayPayments]);

  const todaySplit = useMemo(() => {
    return todayPayments
      .filter((p) => p.paymentMode === "split")
      .reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [todayPayments]);

  // All-time total collection
  const allTimeTotal = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [payments]);

  // Filtered Payments List
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Date filter
      if (dateFilter === "today" && !isToday(p.createdAt)) return false;
      if (dateFilter === "yesterday" && !isYesterday(p.createdAt)) return false;
      if (dateFilter === "this_month" && !isThisMonth(p.createdAt)) return false;

      // Mode filter
      if (modeFilter !== "all" && p.paymentMode !== modeFilter) return false;

      // Text search
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        p.bookingNumber?.toLowerCase().includes(q) ||
        p.clientName?.toLowerCase().includes(q) ||
        p.clientMobile?.toLowerCase().includes(q) ||
        p.fromLocation?.toLowerCase().includes(q) ||
        p.toLocation?.toLowerCase().includes(q) ||
        p.paymentMode?.toLowerCase().includes(q) ||
        (p.companyName && p.companyName.toLowerCase().includes(q)) ||
        (p.note && p.note.toLowerCase().includes(q))
      );
    });
  }, [payments, dateFilter, modeFilter, searchQuery]);

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">FINANCIALS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Payments</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Daily Collections & Payment Register
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Today&apos;s collections breakdown by payment mode & complete receipts log
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search receipt, client, booking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
          />
        </div>
      </div>

      {/* REQUIREMENT 1: TODAY'S TOTAL & IN WHAT PAYMENT MODE HOW MUCH */}
      <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-[2px] bg-[#f16623]"></span>
            <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
              Today&apos;s Collections Summary ({new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-normal text-slate-500">
            <span>All-time Collections:</span>
            <span className="font-mono font-medium text-slate-900">
              ₹{allTimeTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Big Today Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {/* Total Collected Today */}
          <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-orange-50 to-amber-50/40 p-3 rounded-[6px] border border-[#f16623]/30 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-[#f16623]">
                Total Today
              </span>
              <TrendingUp className="w-4 h-4 text-[#f16623]" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-mono font-medium text-slate-900 block leading-tight">
                ₹{todayTotal.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                {todayPayments.length} receipt{todayPayments.length === 1 ? "" : "s"} today
              </span>
            </div>
          </div>

          {/* Cash Today */}
          <div className="bg-emerald-50/50 p-2.5 rounded-[6px] border border-emerald-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <Banknote className="w-3 h-3" />
                Cash
              </span>
              <span className="text-[9px] font-mono text-emerald-600 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                Mode
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-mono font-medium text-emerald-700 block">
                ₹{todayCash.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Cash in hand
              </span>
            </div>
          </div>

          {/* UPI Today */}
          <div className="bg-blue-50/50 p-2.5 rounded-[6px] border border-blue-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-blue-700 flex items-center gap-1">
                <QrCode className="w-3 h-3" />
                UPI / QR
              </span>
              <span className="text-[9px] font-mono text-blue-600 bg-white px-1.5 py-0.2 rounded border border-blue-200">
                Mode
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-mono font-medium text-blue-700 block">
                ₹{todayUpi.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Direct bank UPI
              </span>
            </div>
          </div>

          {/* Card Today */}
          <div className="bg-purple-50/50 p-2.5 rounded-[6px] border border-purple-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-purple-700 flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Card / POS
              </span>
              <span className="text-[9px] font-mono text-purple-600 bg-white px-1.5 py-0.2 rounded border border-purple-200">
                Mode
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-mono font-medium text-purple-700 block">
                ₹{todayCard.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Card terminal
              </span>
            </div>
          </div>

          {/* Split / Mixed Today */}
          <div className="bg-slate-50 p-2.5 rounded-[6px] border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <Coins className="w-3 h-3 text-[#f16623]" />
                Split
              </span>
              <span className="text-[9px] font-mono text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                Mixed
              </span>
            </div>
            <div className="mt-2">
              <span className="text-base font-mono font-medium text-slate-800 block">
                ₹{todaySplit.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Mixed payments
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* REQUIREMENT 1 (BELOW): LIST OF RECEIVED PAYMENTS WITH FILTERS */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            {/* Date Filters */}
            <div className="flex rounded-[6px] bg-slate-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setDateFilter("today")}
                className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] transition cursor-pointer ${
                  dateFilter === "today"
                    ? "bg-white text-[#f16623] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("yesterday")}
                className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] transition cursor-pointer ${
                  dateFilter === "yesterday"
                    ? "bg-white text-[#f16623] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("this_month")}
                className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] transition cursor-pointer ${
                  dateFilter === "this_month"
                    ? "bg-white text-[#f16623] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("all")}
                className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] transition cursor-pointer ${
                  dateFilter === "all"
                    ? "bg-white text-[#f16623] shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Time
              </button>
            </div>

            {/* Mode Filter Dropdown */}
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="h-[28px] max-h-[34px] px-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623] font-normal"
            >
              <option value="all">All Modes</option>
              <option value="cash">Cash Only</option>
              <option value="upi">UPI Only</option>
              <option value="card">Card Only</option>
              <option value="split">Split Only</option>
            </select>
          </div>

          <span className="text-[11px] text-slate-400 font-normal">
            {filteredPayments.length} receipt{filteredPayments.length === 1 ? "" : "s"} found
          </span>
        </div>

        {/* Payments Table */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">
              Loading payment receipts from Firestore...
            </span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Receipt className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              No payments recorded for this filter
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {dateFilter === "today"
                ? "No payments recorded yet today. When payments are received on bookings or credit settlements, they appear here instantly."
                : "Try selecting 'All Time' or clearing your search query."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-medium">Receipt #</th>
                  <th className="py-2 px-3 font-medium">Booking / Route</th>
                  <th className="py-2 px-3 font-medium">Client / Stakeholder</th>
                  <th className="py-2 px-3 font-medium">Amount Received</th>
                  <th className="py-2 px-3 font-medium">Payment Mode</th>
                  <th className="py-2 px-3 font-medium">Date & Time</th>
                  <th className="py-2 px-3 font-medium">Note / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p, idx) => {
                  let dateStr = "Just now";
                  let timeStr = "";
                  if (p.createdAt && typeof p.createdAt.toDate === "function") {
                    const d = p.createdAt.toDate();
                    dateStr = d.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                    timeStr = d.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    });
                  }

                  const isCust = p.clientType !== "business_owner";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-orange-50/30 transition-colors"
                    >
                      {/* Receipt ID */}
                      <td className="py-2 px-3 font-mono font-medium text-slate-900 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded-[4px] bg-slate-100 border border-slate-200">
                          RCP-{p.id.slice(-5).toUpperCase()}
                        </span>
                      </td>

                      {/* Booking / Route */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] font-medium text-slate-800">
                            {p.bookingNumber || "Direct Settlement"}
                          </span>
                          {p.fromLocation && p.toLocation && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                              {p.fromLocation} ➔ {p.toLocation}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Client */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">
                              {p.clientName || "Walk-in Passenger"}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded-[3px] text-[9px] font-medium border ${
                                isCust
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {isCust ? "Customer" : "Business Owner"}
                            </span>
                          </div>
                          {p.clientMobile && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              {p.clientMobile}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount Collected */}
                      <td className="py-2 px-3 font-mono font-medium text-emerald-700 text-xs">
                        ₹{Number(p.amountCollected).toLocaleString("en-IN")}
                      </td>

                      {/* Payment Mode Badge */}
                      <td className="py-2 px-3">
                        {p.paymentMode === "cash" && (
                          <span className="px-2 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-[10px] inline-flex items-center gap-1">
                            <Banknote className="w-3 h-3" />
                            Cash
                          </span>
                        )}
                        {p.paymentMode === "upi" && (
                          <span className="px-2 py-0.5 rounded-[4px] bg-blue-50 text-blue-700 border border-blue-200 font-medium text-[10px] inline-flex items-center gap-1">
                            <QrCode className="w-3 h-3" />
                            UPI
                          </span>
                        )}
                        {p.paymentMode === "card" && (
                          <span className="px-2 py-0.5 rounded-[4px] bg-purple-50 text-purple-700 border border-purple-200 font-medium text-[10px] inline-flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            Card
                          </span>
                        )}
                        {p.paymentMode === "split" && (
                          <div className="flex flex-col gap-0.5">
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/25 font-medium text-[10px] inline-flex items-center gap-1 w-fit">
                              <Coins className="w-3 h-3" />
                              Split Payment
                            </span>
                            {p.splits && (
                              <span className="text-[9px] text-slate-500 font-mono">
                                {(p.splits.cash || 0) > 0 && `Cash: ₹${p.splits.cash} `}
                                {(p.splits.upi || 0) > 0 && `UPI: ₹${p.splits.upi} `}
                                {(p.splits.card || 0) > 0 && `Card: ₹${p.splits.card}`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Date & Time */}
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        <div>{dateStr}</div>
                        {timeStr && (
                          <div className="text-[10px] text-slate-400">
                            {timeStr}
                          </div>
                        )}
                      </td>

                      {/* Note / Reference */}
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal italic">
                        {p.note || "Standard receipt"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
