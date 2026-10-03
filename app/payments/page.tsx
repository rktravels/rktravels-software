"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CreditCard,
  Banknote,
  QrCode,
  Search,
  IndianRupee,
  Calendar,
  PhoneCall,
  Loader2,
  Receipt,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Car,
  MapPin,
  X,
  Filter,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";

export interface PaymentHistoryItem {
  id: string;
  date: string;
  time: string;
  amount: number;
  paymentMode: "Cash" | "Card" | "UPI";
  referenceNumber?: string;
  notes?: string;
  recordedAt: string;
}

export interface BookingPaymentItem {
  id: string;
  bookingNumber: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  fromLocation?: string;
  toLocation?: string;
  entityName?: string;
  customerName?: string;
  companyName?: string;
  travelerName?: string;
  travelerMobile?: string;
  vehicleCategoryName?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverMobile?: string;
  tariffType?: string;
  packageName?: string;
  bookingStatus?: string;
  paymentStatus?: "Unpaid" | "Partial" | "Paid";
  grossAmount?: number;
  netAmount?: number;
  receivedAmount?: number;
  balanceAmount?: number;
  paymentHistory?: PaymentHistoryItem[];
  createdAt?: any;
  updatedAt?: any;
}

export interface LedgerTransaction {
  id: string;
  bookingId?: string;
  bookingNumber?: string;
  clientType?: string;
  clientName?: string;
  clientMobile?: string;
  companyName?: string;
  fromLocation?: string;
  toLocation?: string;
  amountCollected: number;
  paymentMode: string;
  referenceNumber?: string | null;
  note?: string | null;
  createdAt?: any;
}

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "ledger">("pending");
  const [bookings, setBookings] = useState<BookingPaymentItem[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<LedgerTransaction[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Unpaid" | "Partial">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "this_month">("all");
  const [modeFilter, setModeFilter] = useState<string>("all");

  // Collect Payment Modal
  const [collectingBooking, setCollectingBooking] = useState<BookingPaymentItem | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMode, setCollectMode] = useState<"Cash" | "Card" | "UPI">("Cash");
  const [collectRefNumber, setCollectRefNumber] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Payment History Drawer
  const [historyBooking, setHistoryBooking] = useState<BookingPaymentItem | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to real-time Bookings for pending unpaid & partial trips
  useEffect(() => {
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: BookingPaymentItem[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BookingPaymentItem, "id">),
          }));
          setBookings(items);
          setLoadingBookings(false);
        },
        (err) => {
          console.error("Bookings listener error, fallback query:", err);
          const fallback = query(collection(db, "bookings"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: BookingPaymentItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<BookingPaymentItem, "id">),
            }));
            setBookings(items);
            setLoadingBookings(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load bookings in payments page:", err);
      setLoadingBookings(false);
    }
  }, []);

  // 2. Subscribe to real-time Ledger Transactions from payments collection
  useEffect(() => {
    try {
      const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: LedgerTransaction[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<LedgerTransaction, "id">),
            amountCollected:
              Number(
                docSnap.data().amountCollected || docSnap.data().amount || 0
              ) || 0,
          }));
          setLedgerPayments(items);
          setLoadingLedger(false);
        },
        (err) => {
          console.error("Payments ledger listener error, fallback query:", err);
          const fallback = query(collection(db, "payments"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: LedgerTransaction[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<LedgerTransaction, "id">),
              amountCollected:
                Number(
                  docSnap.data().amountCollected || docSnap.data().amount || 0
                ) || 0,
            }));
            setLedgerPayments(items);
            setLoadingLedger(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load payments ledger:", err);
      setLoadingLedger(false);
    }
  }, []);

  // Filter ONLY pending bookings (Unpaid & Partial, balance > 0)
  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => {
      const balance = Number(b.balanceAmount) || 0;
      const status = b.paymentStatus;
      if (status === "Paid") return false;
      return balance > 0 || status === "Unpaid" || status === "Partial";
    });
  }, [bookings]);

  // Aggregate Metrics for Header
  const totalPendingDues = useMemo(() => {
    return pendingBookings.reduce(
      (sum, b) => sum + (Number(b.balanceAmount) || 0),
      0
    );
  }, [pendingBookings]);

  const totalAllTimeCollected = useMemo(() => {
    return ledgerPayments.reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [ledgerPayments]);

  const isToday = (timestamp?: any) => {
    if (!timestamp || typeof timestamp.toDate !== "function") return false;
    const d = timestamp.toDate();
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isYesterday = (timestamp?: any) => {
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

  const isThisMonth = (timestamp?: any) => {
    if (!timestamp || typeof timestamp.toDate !== "function") return false;
    const d = timestamp.toDate();
    const today = new Date();
    return (
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const todayCollected = useMemo(() => {
    return ledgerPayments
      .filter((p) => isToday(p.createdAt))
      .reduce((sum, p) => sum + (p.amountCollected || 0), 0);
  }, [ledgerPayments]);

  // Filtered Pending Bookings
  const filteredPendingBookings = useMemo(() => {
    let result = pendingBookings;

    if (statusFilter !== "all") {
      result = result.filter((b) => b.paymentStatus === statusFilter);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (b) =>
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.companyName?.toLowerCase().includes(q) ||
          b.travelerName?.toLowerCase().includes(q) ||
          b.travelerMobile?.includes(q) ||
          b.fromLocation?.toLowerCase().includes(q) ||
          b.toLocation?.toLowerCase().includes(q) ||
          b.vehicleNumber?.toLowerCase().includes(q) ||
          b.driverName?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [pendingBookings, statusFilter, searchQuery]);

  // Filtered Ledger Transactions
  const filteredLedger = useMemo(() => {
    let result = ledgerPayments;

    // Date filter
    if (dateFilter === "today") {
      result = result.filter((p) => isToday(p.createdAt));
    } else if (dateFilter === "yesterday") {
      result = result.filter((p) => isYesterday(p.createdAt));
    } else if (dateFilter === "this_month") {
      result = result.filter((p) => isThisMonth(p.createdAt));
    }

    // Payment Mode filter
    if (modeFilter !== "all") {
      result = result.filter(
        (p) => (p.paymentMode || "").toLowerCase() === modeFilter.toLowerCase()
      );
    }

    // Search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (p) =>
          p.bookingNumber?.toLowerCase().includes(q) ||
          p.clientName?.toLowerCase().includes(q) ||
          p.companyName?.toLowerCase().includes(q) ||
          p.clientMobile?.includes(q) ||
          p.referenceNumber?.toLowerCase().includes(q) ||
          p.note?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [ledgerPayments, dateFilter, modeFilter, searchQuery]);

  // Open Collect Payment Modal
  const handleOpenCollectModal = (b: BookingPaymentItem) => {
    setCollectingBooking(b);
    const balance =
      b.balanceAmount ??
      Math.max(
        0,
        (Number(b.grossAmount) || Number(b.netAmount) || 0) -
          (Number(b.receivedAmount) || 0)
      );
    setCollectAmount(String(balance));
    setCollectMode("Cash");
    setCollectRefNumber("");
    setCollectNotes("");
  };

  // Submit Collect Payment
  const handleSubmitCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingBooking) return;

    const amountNum = Number(collectAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount greater than ₹0.");
      return;
    }

    if (collectMode === "UPI" && !collectRefNumber.trim()) {
      alert("Please enter the UPI Reference Number (UTR / Ref #).");
      return;
    }

    const currentBalance =
      collectingBooking.balanceAmount ??
      Math.max(
        0,
        (Number(collectingBooking.grossAmount) || Number(collectingBooking.netAmount) || 0) -
          (Number(collectingBooking.receivedAmount) || 0)
      );

    if (amountNum > currentBalance) {
      alert(
        `Amount cannot exceed current balance due of ₹${currentBalance.toLocaleString("en-IN")}.`
      );
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const now = new Date();
      const currentReceived = Number(collectingBooking.receivedAmount) || 0;
      const newReceived = currentReceived + amountNum;
      const totalPayable =
        Number(collectingBooking.grossAmount) ||
        Number(collectingBooking.netAmount) ||
        0;
      const newBalance = Math.max(0, totalPayable - newReceived);

      let newPayStatus: "Unpaid" | "Partial" | "Paid" = "Partial";
      if (newBalance <= 0) newPayStatus = "Paid";
      else if (newReceived <= 0) newPayStatus = "Unpaid";

      const newHistoryItem: PaymentHistoryItem = {
        id: `pay-${Date.now()}`,
        date: now.toISOString().split("T")[0],
        time: `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`,
        amount: amountNum,
        paymentMode: collectMode,
        referenceNumber: collectRefNumber.trim() || undefined,
        notes: collectNotes.trim() || undefined,
        recordedAt: now.toISOString(),
      };

      const updatedHistory = [
        ...(collectingBooking.paymentHistory || []),
        newHistoryItem,
      ];

      // 1. Update Booking record in Firestore
      await updateDoc(doc(db, "bookings", collectingBooking.id), {
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        paymentStatus: newPayStatus,
        paymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // 2. Add entry to Payments Ledger
      await addDoc(collection(db, "payments"), {
        bookingId: collectingBooking.id,
        bookingNumber: collectingBooking.bookingNumber,
        clientType: "customer",
        clientName: collectingBooking.customerName || collectingBooking.companyName || "Direct",
        clientMobile: collectingBooking.travelerMobile || "",
        companyName: collectingBooking.customerName || collectingBooking.companyName || "Direct",
        fromLocation: collectingBooking.fromLocation || "",
        toLocation: collectingBooking.toLocation || "",
        amountCollected: amountNum,
        paymentMode: collectMode.toLowerCase(),
        referenceNumber: collectRefNumber.trim() || null,
        note: collectNotes.trim() || null,
        createdAt: serverTimestamp(),
      });

      setFeedback({
        type: "success",
        message: `₹${amountNum.toLocaleString("en-IN")} collected via ${collectMode.toUpperCase()} for Booking #${collectingBooking.bookingNumber}!`,
      });

      setCollectingBooking(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error submitting collected payment:", err);
      alert("Failed to record payment. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <div className="w-full space-y-3 font-normal text-slate-800">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">FINANCIALS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Payments & Collections</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Payments & Collections
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {pendingBookings.length} Trips with Dues
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Collect unpaid & partial amounts (Cash, Card, UPI with Ref #) and track chronological payment history
            </p>
          </div>
        </div>

        {/* Global Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking #, company, passenger..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
          />
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Outstanding Dues */}
        <div className="bg-white p-2.5 rounded-[6px] border border-amber-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Outstanding Due
            </span>
            <span className="text-base font-medium text-amber-600 font-mono">
              ₹{totalPendingDues.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Total Collected Today */}
        <div className="bg-white p-2.5 rounded-[6px] border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Collected Today
            </span>
            <span className="text-base font-medium text-emerald-600 font-mono">
              ₹{todayCollected.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>

        {/* Total All-Time Collected */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Ledger Collected
            </span>
            <span className="text-base font-medium text-slate-900 font-mono">
              ₹{totalAllTimeCollected.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        {/* Pending Trips Count */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Pending Trips Count
            </span>
            <span className="text-base font-medium text-slate-700 font-mono">
              {pendingBookings.length}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-slate-50 text-slate-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 rounded-[6px] text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Tab Navigation & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "pending"
                ? "border-[#f16623] text-[#f16623]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Unpaid & Partial Bookings</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {pendingBookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "ledger"
                ? "border-[#f16623] text-[#f16623]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Transactions Ledger</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {ledgerPayments.length}
            </span>
          </button>
        </div>

        {/* Tab-specific Filters */}
        {activeTab === "pending" ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623] cursor-pointer"
            >
              <option value="all">All Pending ({pendingBookings.length})</option>
              <option value="Unpaid">Unpaid Only</option>
              <option value="Partial">Partial Only</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623] cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
            </select>

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              className="h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623] cursor-pointer"
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: UNPAID & PARTIAL BOOKINGS TABLE                                 */}
      {/* ===================================================================== */}
      {activeTab === "pending" && (
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs">
          {loadingBookings ? (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#f16623] mx-auto mb-2" />
              <p className="text-xs">Loading pending bookings...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-medium">
                    <th className="py-2.5 px-3">Trip # / Date</th>
                    <th className="py-2.5 px-3">Company (Customer)</th>
                    <th className="py-2.5 px-3">Traveler & Route</th>
                    <th className="py-2.5 px-3">Vehicle & Driver</th>
                    <th className="py-2.5 px-3 text-right">Total Fare</th>
                    <th className="py-2.5 px-3 text-right">Paid / Advance</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPendingBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No unpaid or partial bookings found. All trips are settled!
                      </td>
                    </tr>
                  ) : (
                    filteredPendingBookings.map((b) => {
                      const totalBill =
                        Number(b.grossAmount) || Number(b.netAmount) || 0;
                      const paid = Number(b.receivedAmount) || 0;
                      const balance =
                        b.balanceAmount ?? Math.max(0, totalBill - paid);

                      return (
                        <tr
                          key={b.id}
                          className="hover:bg-slate-50/70 transition"
                        >
                          {/* Trip # & Date */}
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-medium text-[#f16623]">
                              {b.bookingNumber}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{b.startDate || "N/A"}</span>
                            </div>
                          </td>

                          {/* Company / Customer */}
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">
                              {b.customerName || b.companyName || "Direct"}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {b.entityName || "RK Travels"}
                            </div>
                          </td>

                          {/* Traveler & Route */}
                          <td className="py-2.5 px-3">
                            <div className="text-slate-800">{b.travelerName || "Passenger"}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{b.fromLocation} → {b.toLocation}</span>
                            </div>
                          </td>

                          {/* Vehicle & Driver */}
                          <td className="py-2.5 px-3">
                            <div className="text-slate-800 flex items-center gap-1">
                              <Car className="w-3 h-3 text-slate-400" />
                              <span>{b.vehicleNumber || b.vehicleCategoryName || "Unassigned"}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {b.driverName ? `Driver: ${b.driverName}` : "No driver"}
                            </div>
                          </td>

                          {/* Total Fare */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            ₹{totalBill.toLocaleString("en-IN")}
                          </td>

                          {/* Paid / Advance */}
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                            ₹{paid.toLocaleString("en-IN")}
                          </td>

                          {/* Balance Due */}
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-600">
                            ₹{balance.toLocaleString("en-IN")}
                          </td>

                          {/* Payment Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                                b.paymentStatus === "Unpaid"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {b.paymentStatus || "Unpaid"}
                            </span>
                          </td>

                          {/* Actions: Collect Payment & Payment History */}
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Payment History Button */}
                              <button
                                onClick={() => setHistoryBooking(b)}
                                title="View Payment History"
                                className="h-[30px] px-2 rounded-[6px] border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 text-xs flex items-center gap-1 transition"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">History</span>
                              </button>

                              {/* Collect Payment Button */}
                              <button
                                onClick={() => handleOpenCollectModal(b)}
                                className="h-[30px] px-2.5 rounded-[6px] bg-[#f16623] hover:bg-[#d9551a] text-white text-xs font-medium flex items-center gap-1 transition shadow-xs"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Collect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: TRANSACTIONS LEDGER TABLE                                       */}
      {/* ===================================================================== */}
      {activeTab === "ledger" && (
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs">
          {loadingLedger ? (
            <div className="p-8 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#f16623] mx-auto mb-2" />
              <p className="text-xs">Loading payment transactions...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-medium">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Trip #</th>
                    <th className="py-2.5 px-3">Customer / Company</th>
                    <th className="py-2.5 px-3">Route</th>
                    <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Reference / UTR</th>
                    <th className="py-2.5 px-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No transactions recorded matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((tx) => {
                      const dt =
                        tx.createdAt && typeof tx.createdAt.toDate === "function"
                          ? tx.createdAt.toDate()
                          : null;
                      const dateStr = dt
                        ? dt.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "N/A";
                      const timeStr = dt
                        ? dt.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                      const modeLower = (tx.paymentMode || "").toLowerCase();

                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-slate-50/70 transition"
                        >
                          <td className="py-2.5 px-3">
                            <div className="text-slate-800">{dateStr}</div>
                            <div className="text-[10px] text-slate-400">{timeStr}</div>
                          </td>

                          <td className="py-2.5 px-3 font-mono font-medium text-[#f16623]">
                            {tx.bookingNumber || "N/A"}
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-800">
                              {tx.companyName || tx.clientName || "Direct"}
                            </div>
                            {tx.clientMobile && (
                              <div className="text-[10px] text-slate-400">{tx.clientMobile}</div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600">
                            {tx.fromLocation && tx.toLocation ? (
                              <span className="truncate max-w-[150px] block">
                                {tx.fromLocation} → {tx.toLocation}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-medium text-emerald-600">
                            +₹{(tx.amountCollected || 0).toLocaleString("en-IN")}
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                                modeLower === "cash"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : modeLower === "upi"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {modeLower === "cash" && <Banknote className="w-3 h-3" />}
                              {modeLower === "upi" && <QrCode className="w-3 h-3" />}
                              {modeLower === "card" && <CreditCard className="w-3 h-3" />}
                              <span className="uppercase">{tx.paymentMode || "Cash"}</span>
                            </span>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {tx.referenceNumber || "-"}
                          </td>

                          <td className="py-2.5 px-3 text-slate-500 italic text-[11px]">
                            {tx.note || "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* COLLECT PAYMENT MODAL                                                  */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={!!collectingBooking}
        onClose={() => setCollectingBooking(null)}
        title="Collect Payment"
        subtitle={`Recording receipt for Trip #${collectingBooking?.bookingNumber || ""}`}
        size="md"
        widthClassName="max-w-md"
      >
        {collectingBooking && (
          <form onSubmit={handleSubmitCollectPayment} className="space-y-3.5 text-xs font-normal">
            {/* Bill & Balance Breakdown Card */}
            <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer (Company):</span>
                <span className="font-medium text-slate-900">
                  {collectingBooking.customerName || collectingBooking.companyName || "Direct"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-mono text-slate-800">
                  ₹{(Number(collectingBooking.grossAmount) || Number(collectingBooking.netAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Received:</span>
                <span className="font-mono text-emerald-600">
                  ₹{(Number(collectingBooking.receivedAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 font-medium">
                <span className="text-amber-700">Remaining Balance Due:</span>
                <span className="font-mono text-amber-700">
                  ₹{(collectingBooking.balanceAmount ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Amount Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                AMOUNT TO COLLECT (₹) *
              </label>
              <input
                type="number"
                step="any"
                min="1"
                max={collectingBooking.balanceAmount || undefined}
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full h-[34px] max-h-[34px] px-2.5 text-sm font-mono font-medium bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623]"
              />
            </div>

            {/* Payment Mode Selection: Cash, Card, UPI */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                PAYMENT MODE *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: "Cash" as const, icon: Banknote },
                  { mode: "Card" as const, icon: CreditCard },
                  { mode: "UPI" as const, icon: QrCode },
                ].map(({ mode, icon: Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCollectMode(mode)}
                    className={`h-[34px] max-h-[34px] rounded-[6px] text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
                      collectMode === mode
                        ? "border-[#f16623] bg-orange-50/50 text-[#f16623]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* If UPI, Reference Number is mandatory */}
            {collectMode === "UPI" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[#f16623] uppercase tracking-wider block">
                  UPI REFERENCE NUMBER / UTR *
                </label>
                <input
                  type="text"
                  value={collectRefNumber}
                  onChange={(e) => setCollectRefNumber(e.target.value)}
                  placeholder="e.g. UPI/409218291039"
                  required
                  className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-[#f16623]/60 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623]"
                />
              </div>
            )}

            {/* If Card, optional Transaction Ref */}
            {collectMode === "Card" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  CARD TRANSACTION / APPROVAL CODE
                </label>
                <input
                  type="text"
                  value={collectRefNumber}
                  onChange={(e) => setCollectRefNumber(e.target.value)}
                  placeholder="e.g. APPR-893012"
                  className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623]"
                />
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                PAYMENT NOTES / REMARKS
              </label>
              <input
                type="text"
                value={collectNotes}
                onChange={(e) => setCollectNotes(e.target.value)}
                placeholder="e.g. Cleared by accounts dept / RTGS"
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623]"
              />
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollectingBooking(null)}
                className="h-[34px] max-h-[34px] px-3 text-xs text-slate-600 border border-slate-200 rounded-[6px] hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="h-[34px] max-h-[34px] px-4 text-xs font-medium text-white bg-[#f16623] hover:bg-[#d9551a] rounded-[6px] flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Record Payment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </OffCanvas>

      {/* ===================================================================== */}
      {/* DEDICATED PAYMENT HISTORY DRAWER / SECTION FOR EACH BOOKING           */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={!!historyBooking}
        onClose={() => setHistoryBooking(null)}
        title="Payment History Trail"
        subtitle={`Chronological receipts for Trip #${historyBooking?.bookingNumber || ""}`}
        size="md"
        widthClassName="max-w-md"
      >
        {historyBooking && (
          <div className="space-y-4 text-xs font-normal">
            {/* Quick Trip Header Info */}
            <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Customer (Company):</span>
                <span className="font-medium text-slate-900">
                  {historyBooking.customerName || historyBooking.companyName || "Direct"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Passenger / Traveler:</span>
                <span className="text-slate-800">{historyBooking.travelerName || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-mono font-medium text-slate-900">
                  ₹{(Number(historyBooking.grossAmount) || Number(historyBooking.netAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-emerald-700">Total Collected:</span>
                <span className="font-mono font-medium text-emerald-600">
                  ₹{(Number(historyBooking.receivedAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-amber-700">Remaining Balance:</span>
                <span className="font-mono font-medium text-amber-600">
                  ₹{(Number(historyBooking.balanceAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Chronological Payment Trail Section */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>Payment History Events</span>
                <span className="font-mono text-slate-400">
                  {(historyBooking.paymentHistory || []).length} Recorded
                </span>
              </div>

              {(!historyBooking.paymentHistory || historyBooking.paymentHistory.length === 0) ? (
                <div className="p-6 text-center bg-slate-50 rounded-[6px] border border-dashed border-slate-200 text-slate-400">
                  <Banknote className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p>No payments recorded yet for this booking.</p>
                  <p className="text-[10px] mt-0.5">This trip is currently Unpaid.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyBooking.paymentHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-[6px] border border-slate-200 bg-white space-y-1 hover:border-slate-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          {item.paymentMode === "Cash" && (
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          {item.paymentMode === "Card" && (
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          {item.paymentMode === "UPI" && (
                            <QrCode className="w-3.5 h-3.5 text-purple-600" />
                          )}
                          <span>{item.paymentMode}</span>
                        </div>
                        <span className="font-mono font-medium text-emerald-600">
                          +₹{(Number(item.amount) || 0).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-400 flex items-center justify-between">
                        <span>
                          {item.date} {item.time}
                        </span>
                        {item.referenceNumber && (
                          <span className="font-mono text-slate-600">
                            Ref: {item.referenceNumber}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <div className="text-[10px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded-[4px]">
                          &ldquo;{item.notes}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action from History Drawer */}
            {(historyBooking.balanceAmount ?? 0) > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const b = historyBooking;
                    setHistoryBooking(null);
                    handleOpenCollectModal(b);
                  }}
                  className="w-full h-[34px] max-h-[34px] rounded-[6px] bg-[#f16623] hover:bg-[#d9551a] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Collect Remaining ₹{(historyBooking.balanceAmount ?? 0).toLocaleString("en-IN")}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </OffCanvas>
    </div>
  );
}
