"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  WalletCards,
  Search,
  IndianRupee,
  Clock,
  User,
  Building2,
  ArrowRight,
  PhoneCall,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
  QrCode,
  CreditCard,
  Layers,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileCheck,
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
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";

interface PaymentSplits {
  cash: number;
  upi: number;
  card: number;
}

interface BookingRecord {
  id: string;
  bookingNumber: string;
  fromLocation: string;
  toLocation: string;
  planId?: string;
  planName?: string;
  clientType: "customer" | "business_owner";
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientEmail?: string;
  companyName?: string;
  amount: number;
  discountType?: "rupees" | "percent";
  discountValue?: number;
  discount: number;
  netAmount: number;
  paymentMode: "cash" | "upi" | "card" | "split";
  paymentSplits?: PaymentSplits | null;
  receivedAmount: number;
  balanceAmount: number;
  status: string;
  createdAt?: Timestamp | null;
}

interface ClientSummary {
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientEmail?: string;
  companyName?: string;
  ordersCount: number;
  totalNetAmount: number;
  totalReceivedAmount: number;
  totalBalanceDue: number;
  orders: BookingRecord[];
}

export default function CreditPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"orders" | "customers" | "owners">(
    "orders"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Expanded client row in customer/owner views
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Partial Payment Settlement Off-Canvas state
  const [selectedBookingForPayment, setSelectedBookingForPayment] =
    useState<BookingRecord | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [collectMode, setCollectMode] = useState<"cash" | "upi" | "card">(
    "cash"
  );
  const [collectNote, setCollectNote] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Subscribe to real-time bookings from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: BookingRecord[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BookingRecord, "id">),
          }));
          setBookings(items);
          setLoading(false);
        },
        (err) => {
          console.error("Credit bookings listener error, falling back:", err);
          const fallback = query(collection(db, "bookings"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: BookingRecord[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<BookingRecord, "id">),
            }));
            setBookings(items);
            setLoading(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to initialize bookings in credit page:", err);
      setLoading(false);
    }
  }, []);

  // Filter ONLY partial payment bookings (where balanceAmount > 0)
  const creditBookings = useMemo(() => {
    return bookings.filter((b) => (b.balanceAmount || 0) > 0);
  }, [bookings]);

  // Aggregate Total Metrics
  const totalBalanceDue = useMemo(() => {
    return creditBookings.reduce((sum, b) => sum + (b.balanceAmount || 0), 0);
  }, [creditBookings]);

  const totalCreditNetAmount = useMemo(() => {
    return creditBookings.reduce((sum, b) => sum + (b.netAmount || 0), 0);
  }, [creditBookings]);

  const totalCreditReceivedAmount = useMemo(() => {
    return creditBookings.reduce(
      (sum, b) => sum + (b.receivedAmount || 0),
      0
    );
  }, [creditBookings]);

  // Group by Customer
  const customerSummaries = useMemo(() => {
    const map = new Map<string, ClientSummary>();

    creditBookings
      .filter((b) => b.clientType === "customer")
      .forEach((b) => {
        const key = b.clientId || b.clientMobile || b.clientName;
        const existing = map.get(key);
        if (existing) {
          existing.ordersCount += 1;
          existing.totalNetAmount += b.netAmount || 0;
          existing.totalReceivedAmount += b.receivedAmount || 0;
          existing.totalBalanceDue += b.balanceAmount || 0;
          existing.orders.push(b);
        } else {
          map.set(key, {
            clientId: key,
            clientName: b.clientName,
            clientMobile: b.clientMobile,
            clientEmail: b.clientEmail,
            ordersCount: 1,
            totalNetAmount: b.netAmount || 0,
            totalReceivedAmount: b.receivedAmount || 0,
            totalBalanceDue: b.balanceAmount || 0,
            orders: [b],
          });
        }
      });

    return Array.from(map.values()).sort(
      (a, b) => b.totalBalanceDue - a.totalBalanceDue
    );
  }, [creditBookings]);

  // Group by Business Owner
  const ownerSummaries = useMemo(() => {
    const map = new Map<string, ClientSummary>();

    creditBookings
      .filter((b) => b.clientType === "business_owner")
      .forEach((b) => {
        const key = b.clientId || b.clientMobile || b.clientName;
        const existing = map.get(key);
        if (existing) {
          existing.ordersCount += 1;
          existing.totalNetAmount += b.netAmount || 0;
          existing.totalReceivedAmount += b.receivedAmount || 0;
          existing.totalBalanceDue += b.balanceAmount || 0;
          existing.orders.push(b);
        } else {
          map.set(key, {
            clientId: key,
            clientName: b.clientName,
            clientMobile: b.clientMobile,
            clientEmail: b.clientEmail,
            companyName: b.companyName,
            ordersCount: 1,
            totalNetAmount: b.netAmount || 0,
            totalReceivedAmount: b.receivedAmount || 0,
            totalBalanceDue: b.balanceAmount || 0,
            orders: [b],
          });
        }
      });

    return Array.from(map.values()).sort(
      (a, b) => b.totalBalanceDue - a.totalBalanceDue
    );
  }, [creditBookings]);

  // Filtered views based on search query
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return creditBookings;
    return creditBookings.filter(
      (b) =>
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.clientName?.toLowerCase().includes(q) ||
        b.clientMobile?.toLowerCase().includes(q) ||
        b.fromLocation?.toLowerCase().includes(q) ||
        b.toLocation?.toLowerCase().includes(q) ||
        b.planName?.toLowerCase().includes(q) ||
        (b.companyName && b.companyName.toLowerCase().includes(q))
    );
  }, [creditBookings, searchQuery]);

  const filteredCustomerSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customerSummaries;
    return customerSummaries.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.clientMobile.toLowerCase().includes(q)
    );
  }, [customerSummaries, searchQuery]);

  const filteredOwnerSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ownerSummaries;
    return ownerSummaries.filter(
      (o) =>
        o.clientName.toLowerCase().includes(q) ||
        o.clientMobile.toLowerCase().includes(q) ||
        (o.companyName && o.companyName.toLowerCase().includes(q))
    );
  }, [ownerSummaries, searchQuery]);

  // Open Collect Payment Drawer
  const handleOpenCollectPayment = (b: BookingRecord) => {
    setSelectedBookingForPayment(b);
    setCollectAmount(String(b.balanceAmount));
    setCollectMode("cash");
    setCollectNote("");
  };

  // Submit Partial Payment Collection
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingForPayment) return;

    const paymentNum = Number(collectAmount);
    if (isNaN(paymentNum) || paymentNum <= 0) {
      alert("Please enter a valid payment amount greater than 0.");
      return;
    }

    if (paymentNum > selectedBookingForPayment.balanceAmount) {
      alert(
        `Amount cannot exceed the current balance due of ₹${selectedBookingForPayment.balanceAmount.toLocaleString(
          "en-IN"
        )}.`
      );
      return;
    }

    setIsSubmittingPayment(true);

    try {
      const newReceived =
        (selectedBookingForPayment.receivedAmount || 0) + paymentNum;
      const newBalance = Math.max(
        0,
        (selectedBookingForPayment.balanceAmount || 0) - paymentNum
      );

      // 1. Update booking in Firestore
      const bookingRef = doc(db, "bookings", selectedBookingForPayment.id);
      await updateDoc(bookingRef, {
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        status: newBalance === 0 ? "completed" : "confirmed",
        updatedAt: serverTimestamp(),
      });

      // 2. Record payment transaction in payments collection
      await addDoc(collection(db, "payments"), {
        bookingId: selectedBookingForPayment.id,
        bookingNumber: selectedBookingForPayment.bookingNumber,
        clientType: selectedBookingForPayment.clientType,
        clientId: selectedBookingForPayment.clientId,
        clientName: selectedBookingForPayment.clientName,
        clientMobile: selectedBookingForPayment.clientMobile,
        companyName: selectedBookingForPayment.companyName || null,
        amountCollected: paymentNum,
        paymentMode: collectMode,
        note: collectNote.trim() || null,
        createdAt: serverTimestamp(),
      });

      setFeedback({
        type: "success",
        message: `₹${paymentNum.toLocaleString(
          "en-IN"
        )} collected successfully for Booking #${
          selectedBookingForPayment.bookingNumber
        }!`,
      });

      setSelectedBookingForPayment(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error submitting credit settlement payment:", err);
      alert("Failed to record payment. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

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
        <span className="text-[#f16623] font-medium">Credit & Dues</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <WalletCards className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Credit & Partial Payment Ledgers
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {creditBookings.length} Pending Orders
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Track outstanding dues across orders, customers and business partners
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking, client, mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
          />
        </div>
      </div>

      {/* 4 Financial KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Outstanding Balance */}
        <div className="bg-white p-2.5 rounded-[6px] border border-amber-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Pending Dues
            </span>
            <span className="text-base font-medium text-amber-600 font-mono">
              ₹{totalBalanceDue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Total Billed Net Value */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Credit Orders Value
            </span>
            <span className="text-base font-medium text-slate-900 font-mono">
              ₹{totalCreditNetAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-slate-50 text-slate-600 flex items-center justify-center">
            <IndianRupee className="w-4 h-4" />
          </div>
        </div>

        {/* Total Already Collected */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Amount Recovered
            </span>
            <span className="text-base font-medium text-emerald-600 font-mono">
              ₹{totalCreditReceivedAmount.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Total Accounts Involved */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Accounts in Due
            </span>
            <span className="text-base font-medium text-slate-900 font-mono">
              {customerSummaries.length + ownerSummaries.length}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* View Switcher Tabs: Order Wise, Customer Wise, Business Owner Wise */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-1.5 rounded-[6px] shadow-xs">
        <div className="flex items-center gap-1.5">
          {/* Order Wise Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`h-[30px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "orders"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Order Wise</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "orders"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {creditBookings.length}
            </span>
          </button>

          {/* Customer Wise Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`h-[30px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "customers"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Customer Wise</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "customers"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {customerSummaries.length}
            </span>
          </button>

          {/* Business Owner Wise Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("owners")}
            className={`h-[30px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "owners"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Business Owner Wise</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === "owners"
                  ? "bg-white/20 text-white"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              {ownerSummaries.length}
            </span>
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
          Showing {activeTab === "orders" ? "Individual Orders" : activeTab === "customers" ? "Customer Accounts" : "Business Owner Accounts"}
        </span>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-xs font-normal border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* TAB 1: ORDER WISE VIEW */}
      {activeTab === "orders" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-[2px] bg-amber-500"></span>
              <h3 className="text-xs font-medium text-slate-900">
                Partial Payment Orders & Invoices
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">
              {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
              <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
              <span className="text-xs font-normal">
                Loading credit orders from Firestore...
              </span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-medium text-slate-800">
                {searchQuery ? "No matching credit orders" : "No pending credit dues!"}
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
                {searchQuery
                  ? "Try checking spelling or search for another client name/booking ID."
                  : "All bookings are currently fully paid. Any booking with partial payment will appear here automatically."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-medium">Booking #</th>
                    <th className="py-2 px-3 font-medium">Route (From ➔ To)</th>
                    <th className="py-2 px-3 font-medium">Client / Stakeholder</th>
                    <th className="py-2 px-3 font-medium">Plan</th>
                    <th className="py-2 px-3 font-medium">Net Fare</th>
                    <th className="py-2 px-3 font-medium">Paid</th>
                    <th className="py-2 px-3 font-medium text-amber-600">Balance Due</th>
                    <th className="py-2 px-3 font-medium">Date</th>
                    <th className="py-2 px-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((b) => {
                    let dateStr = "Just now";
                    if (b.createdAt && typeof b.createdAt.toDate === "function") {
                      dateStr = b.createdAt.toDate().toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                    }

                    const isCust = b.clientType === "customer";

                    return (
                      <tr
                        key={b.id}
                        className="hover:bg-orange-50/30 transition-colors group"
                      >
                        {/* Booking Number */}
                        <td className="py-2 px-3 font-mono font-medium text-slate-900 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-slate-100 border border-slate-200">
                            {b.bookingNumber}
                          </span>
                        </td>

                        {/* Route */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900">
                              {b.fromLocation}
                            </span>
                            <ArrowRight className="w-3 h-3 text-[#f16623] shrink-0" />
                            <span className="font-medium text-slate-900">
                              {b.toLocation}
                            </span>
                          </div>
                        </td>

                        {/* Client */}
                        <td className="py-2 px-3">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-900">
                                {b.clientName}
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
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                              <span className="flex items-center gap-0.5">
                                <PhoneCall className="w-2.5 h-2.5" />
                                {b.clientMobile}
                              </span>
                              {b.companyName && (
                                <span className="text-slate-500">
                                  • {b.companyName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1 max-w-[120px] truncate">
                            <Layers className="w-3 h-3 shrink-0" />
                            <span className="truncate">{b.planName}</span>
                          </span>
                        </td>

                        {/* Net Fare */}
                        <td className="py-2 px-3 font-mono text-slate-900 text-xs">
                          ₹{Number(b.netAmount).toLocaleString("en-IN")}
                        </td>

                        {/* Paid Amount */}
                        <td className="py-2 px-3 font-mono text-emerald-600 text-xs">
                          ₹{Number(b.receivedAmount).toLocaleString("en-IN")}
                        </td>

                        {/* Pending Balance Due */}
                        <td className="py-2 px-3 font-mono font-medium text-amber-600 text-xs">
                          ₹{Number(b.balanceAmount).toLocaleString("en-IN")}
                        </td>

                        {/* Date */}
                        <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                          {dateStr}
                        </td>

                        {/* Actions: Collect Payment Button */}
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenCollectPayment(b)}
                            className="h-[28px] max-h-[34px] px-2.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-[11px] font-medium transition inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <IndianRupee className="w-3 h-3" />
                            <span>Collect</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CUSTOMER WISE VIEW */}
      {activeTab === "customers" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-[2px] bg-blue-500"></span>
              <h3 className="text-xs font-medium text-slate-900">
                Customer Dues Summary
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">
              {filteredCustomerSummaries.length} customer{filteredCustomerSummaries.length === 1 ? "" : "s"} with dues
            </span>
          </div>

          {filteredCustomerSummaries.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-[6px] bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600 mb-2">
                <User className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-medium text-slate-800">
                No customer credit dues
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
                There are no retail customers with unpaid partial balances.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCustomerSummaries.map((c) => {
                const isExpanded = expandedClientId === c.clientId;

                return (
                  <div key={c.clientId} className="p-3 hover:bg-slate-50/50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-[32px] h-[32px] rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center font-medium text-xs">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-900">
                              {c.clientName}
                            </span>
                            <span className="px-1.5 py-0.2 rounded-[3px] bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-medium">
                              {c.ordersCount} Due Order{c.ordersCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                            <PhoneCall className="w-2.5 h-2.5" />
                            {c.clientMobile}
                          </span>
                        </div>
                      </div>

                      {/* Amounts Breakdown & Expand Toggle */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-normal">
                            Net: ₹{c.totalNetAmount.toLocaleString("en-IN")} • Paid: ₹{c.totalReceivedAmount.toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs font-mono font-medium text-amber-600">
                            Total Due: ₹{c.totalBalanceDue.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedClientId(isExpanded ? null : c.clientId)
                          }
                          className="h-[30px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 hover:bg-white text-slate-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{isExpanded ? "Hide Orders" : "View Orders"}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Individual Orders for Customer */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                          Pending Orders Manifest
                        </span>
                        <div className="space-y-1.5">
                          {c.orders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-2 rounded-[6px] bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-medium text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {ord.bookingNumber}
                                </span>
                                <span className="text-slate-700 font-medium">
                                  {ord.fromLocation} ➔ {ord.toLocation}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({ord.planName})
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 text-[11px]">
                                  Paid: ₹{ord.receivedAmount.toLocaleString("en-IN")}
                                </span>
                                <span className="font-mono font-medium text-amber-600 text-xs">
                                  Due: ₹{ord.balanceAmount.toLocaleString("en-IN")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCollectPayment(ord)}
                                  className="h-[26px] max-h-[34px] px-2 rounded-[4px] bg-[#f16623] hover:bg-[#d95318] text-white text-[10px] font-medium transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <IndianRupee className="w-2.5 h-2.5" />
                                  <span>Collect</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BUSINESS OWNER WISE VIEW */}
      {activeTab === "owners" && (
        <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-[2px] bg-purple-500"></span>
              <h3 className="text-xs font-medium text-slate-900">
                Business Owner & Partner Dues Summary
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">
              {filteredOwnerSummaries.length} business owner{filteredOwnerSummaries.length === 1 ? "" : "s"} with dues
            </span>
          </div>

          {filteredOwnerSummaries.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-[6px] bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto text-purple-600 mb-2">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-medium text-slate-800">
                No business owner credit dues
              </h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
                There are no corporate or partner accounts with outstanding credit balances.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOwnerSummaries.map((o) => {
                const isExpanded = expandedClientId === o.clientId;

                return (
                  <div key={o.clientId} className="p-3 hover:bg-slate-50/50 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-[32px] h-[32px] rounded-[6px] bg-purple-50 text-purple-600 flex items-center justify-center font-medium text-xs">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-900">
                              {o.clientName}
                            </span>
                            {o.companyName && (
                              <span className="text-[11px] text-slate-500 font-normal">
                                • {o.companyName}
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 rounded-[3px] bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-medium">
                              {o.ordersCount} Due Order{o.ordersCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-normal">
                            <PhoneCall className="w-2.5 h-2.5" />
                            {o.clientMobile}
                          </span>
                        </div>
                      </div>

                      {/* Amounts Breakdown & Expand Toggle */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-normal">
                            Net: ₹{o.totalNetAmount.toLocaleString("en-IN")} • Paid: ₹{o.totalReceivedAmount.toLocaleString("en-IN")}
                          </span>
                          <span className="text-xs font-mono font-medium text-amber-600">
                            Total Due: ₹{o.totalBalanceDue.toLocaleString("en-IN")}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedClientId(isExpanded ? null : o.clientId)
                          }
                          className="h-[30px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 hover:bg-white text-slate-600 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        >
                          <span>{isExpanded ? "Hide Orders" : "View Orders"}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Individual Orders for Business Owner */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                          Pending Corporate Orders Manifest
                        </span>
                        <div className="space-y-1.5">
                          {o.orders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-2 rounded-[6px] bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-medium text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                  {ord.bookingNumber}
                                </span>
                                <span className="text-slate-700 font-medium">
                                  {ord.fromLocation} ➔ {ord.toLocation}
                                </span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({ord.planName})
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-mono text-slate-500 text-[11px]">
                                  Paid: ₹{ord.receivedAmount.toLocaleString("en-IN")}
                                </span>
                                <span className="font-mono font-medium text-amber-600 text-xs">
                                  Due: ₹{ord.balanceAmount.toLocaleString("en-IN")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCollectPayment(ord)}
                                  className="h-[26px] max-h-[34px] px-2 rounded-[4px] bg-[#f16623] hover:bg-[#d95318] text-white text-[10px] font-medium transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <IndianRupee className="w-2.5 h-2.5" />
                                  <span>Collect</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Collect Partial Payment Off-Canvas Drawer */}
      <OffCanvas
        isOpen={Boolean(selectedBookingForPayment)}
        onClose={() => {
          if (!isSubmittingPayment) setSelectedBookingForPayment(null);
        }}
        title="Collect Credit Payment"
        subtitle={`Settle balance for Booking #${selectedBookingForPayment?.bookingNumber || ""}`}
      >
        {selectedBookingForPayment && (
          <form onSubmit={handleSubmitPayment} className="space-y-3.5">
            {/* Booking & Client Overview Card */}
            <div className="bg-slate-50/70 p-2.5 rounded-[6px] border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedBookingForPayment.bookingNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-[3px] text-[10px] font-medium border ${
                    selectedBookingForPayment.clientType === "customer"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-purple-50 text-purple-700 border-purple-200"
                  }`}
                >
                  {selectedBookingForPayment.clientType === "customer"
                    ? "Customer"
                    : "Business Owner"}
                </span>
              </div>

              <div className="text-xs text-slate-800">
                <span className="font-medium text-slate-900">
                  {selectedBookingForPayment.clientName}
                </span>
                {selectedBookingForPayment.companyName && (
                  <span className="text-slate-500 font-normal">
                    {" "}
                    ({selectedBookingForPayment.companyName})
                  </span>
                )}
                <span className="text-[11px] text-slate-400 block font-normal">
                  {selectedBookingForPayment.clientMobile}
                </span>
              </div>

              <div className="text-xs text-slate-600 flex items-center gap-1.5 pt-1 border-t border-slate-200/60">
                <span className="font-medium">
                  {selectedBookingForPayment.fromLocation}
                </span>
                <ArrowRight className="w-3 h-3 text-[#f16623]" />
                <span className="font-medium">
                  {selectedBookingForPayment.toLocation}
                </span>
              </div>
            </div>

            {/* Financial Status Summary */}
            <div className="bg-amber-50/50 p-2.5 rounded-[6px] border border-amber-200 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 block font-normal">
                  Net Fare
                </span>
                <span className="font-mono font-medium text-slate-900">
                  ₹{selectedBookingForPayment.netAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-normal">
                  Paid So Far
                </span>
                <span className="font-mono font-medium text-emerald-600">
                  ₹{selectedBookingForPayment.receivedAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-amber-700 block font-medium">
                  Current Due
                </span>
                <span className="font-mono font-medium text-amber-600 text-sm">
                  ₹{selectedBookingForPayment.balanceAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Payment Collection Amount Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="collect-amount"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  Amount to Collect (₹) <span className="text-[#f16623]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCollectAmount(String(selectedBookingForPayment.balanceAmount))
                  }
                  className="text-[10px] text-[#f16623] hover:underline font-medium cursor-pointer"
                >
                  Full Due (₹{selectedBookingForPayment.balanceAmount.toLocaleString("en-IN")})
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  ₹
                </span>
                <input
                  id="collect-amount"
                  type="number"
                  min="1"
                  max={selectedBookingForPayment.balanceAmount}
                  required
                  placeholder="e.g. 1500"
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-6 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                />
              </div>
            </div>

            {/* Payment Mode Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                Collection Payment Mode <span className="text-[#f16623]">*</span>
              </label>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCollectMode("cash")}
                  className={`h-[34px] max-h-[34px] rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                    collectMode === "cash"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectMode("upi")}
                  className={`h-[34px] max-h-[34px] rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                    collectMode === "upi"
                      ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollectMode("card")}
                  className={`h-[34px] max-h-[34px] rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                    collectMode === "card"
                      ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card</span>
                </button>
              </div>
            </div>

            {/* Note / Reference */}
            <div className="space-y-1">
              <label
                htmlFor="collect-note"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block"
              >
                Payment Note / Transaction ID (Optional)
              </label>
              <input
                id="collect-note"
                type="text"
                placeholder="e.g. Paid via GPay / Handed cash to office"
                value={collectNote}
                onChange={(e) => setCollectNote(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>

            {/* Live Remaining Preview */}
            <div className="bg-slate-50 p-2 rounded-[6px] border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-normal">
                Remaining Balance after collection:
              </span>
              <span className="font-mono font-medium text-slate-900">
                ₹
                {Math.max(
                  0,
                  selectedBookingForPayment.balanceAmount - (Number(collectAmount) || 0)
                ).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingPayment}
                onClick={() => setSelectedBookingForPayment(null)}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
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
    </div>
  );
}
