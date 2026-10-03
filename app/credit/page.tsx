"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  WalletCards,
  Search,
  IndianRupee,
  Clock,
  Building2,
  PhoneCall,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Banknote,
  QrCode,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileCheck,
  History,
  Car,
  MapPin,
  Calendar,
  X,
  ExternalLink,
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

export interface CreditBookingRecord {
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

export interface CompanyCreditSummary {
  companyName: string;
  pendingTripsCount: number;
  totalGrossAmount: number;
  totalReceivedAmount: number;
  totalBalanceDue: number;
  bookings: CreditBookingRecord[];
  primaryContactPhone?: string;
}

export default function CreditPage() {
  const [bookings, setBookings] = useState<CreditBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"companies" | "all_bookings">("companies");
  const [searchQuery, setSearchQuery] = useState("");

  // Accordion state for expanded company in companies view
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Collect Payment Modal state
  const [collectingBooking, setCollectingBooking] = useState<CreditBookingRecord | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMode, setCollectMode] = useState<"Cash" | "Card" | "UPI">("Cash");
  const [collectRefNumber, setCollectRefNumber] = useState("");
  const [collectNotes, setCollectNotes] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Payment History Drawer state
  const [historyBooking, setHistoryBooking] = useState<CreditBookingRecord | null>(null);

  // Feedback banner
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
          const items: CreditBookingRecord[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CreditBookingRecord, "id">),
          }));
          setBookings(items);
          setLoading(false);
        },
        (err) => {
          console.error("Credit bookings listener error, falling back:", err);
          const fallback = query(collection(db, "bookings"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: CreditBookingRecord[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<CreditBookingRecord, "id">),
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

  // Filter ONLY bookings with pending payments (Unpaid or Partial, or balance > 0)
  const pendingBookings = useMemo(() => {
    return bookings.filter((b) => {
      const balance = Number(b.balanceAmount) || 0;
      const status = b.paymentStatus;
      if (status === "Paid") return false;
      return balance > 0 || status === "Unpaid" || status === "Partial";
    });
  }, [bookings]);

  // Aggregate Key Financial Metrics
  const totalBalanceDue = useMemo(() => {
    return pendingBookings.reduce((sum, b) => sum + (Number(b.balanceAmount) || 0), 0);
  }, [pendingBookings]);

  const totalGrossValue = useMemo(() => {
    return pendingBookings.reduce(
      (sum, b) => sum + (Number(b.grossAmount) || Number(b.netAmount) || 0),
      0
    );
  }, [pendingBookings]);

  const totalReceivedValue = useMemo(() => {
    return pendingBookings.reduce(
      (sum, b) => sum + (Number(b.receivedAmount) || 0),
      0
    );
  }, [pendingBookings]);

  // Group bookings Company-wise (customer means company)
  const companySummaries = useMemo(() => {
    const map = new Map<string, CompanyCreditSummary>();

    pendingBookings.forEach((b) => {
      const compName =
        (b.customerName || b.companyName || "Direct Customer").trim();
      const existing = map.get(compName);
      const gross = Number(b.grossAmount) || Number(b.netAmount) || 0;
      const received = Number(b.receivedAmount) || 0;
      const balance = Number(b.balanceAmount) || Math.max(0, gross - received);

      if (existing) {
        existing.pendingTripsCount += 1;
        existing.totalGrossAmount += gross;
        existing.totalReceivedAmount += received;
        existing.totalBalanceDue += balance;
        existing.bookings.push(b);
        if (!existing.primaryContactPhone && b.travelerMobile) {
          existing.primaryContactPhone = b.travelerMobile;
        }
      } else {
        map.set(compName, {
          companyName: compName,
          pendingTripsCount: 1,
          totalGrossAmount: gross,
          totalReceivedAmount: received,
          totalBalanceDue: balance,
          bookings: [b],
          primaryContactPhone: b.travelerMobile || "",
        });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.totalBalanceDue - a.totalBalanceDue
    );
  }, [pendingBookings]);

  // Filtered Company Summaries based on search
  const filteredCompanySummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return companySummaries;
    return companySummaries.filter(
      (comp) =>
        comp.companyName.toLowerCase().includes(q) ||
        comp.bookings.some(
          (b) =>
            b.bookingNumber?.toLowerCase().includes(q) ||
            b.travelerName?.toLowerCase().includes(q) ||
            b.travelerMobile?.includes(q) ||
            b.fromLocation?.toLowerCase().includes(q) ||
            b.toLocation?.toLowerCase().includes(q)
        )
    );
  }, [companySummaries, searchQuery]);

  // Filtered flat pending bookings list based on search
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pendingBookings;
    return pendingBookings.filter(
      (b) =>
        b.bookingNumber?.toLowerCase().includes(q) ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.companyName && b.companyName.toLowerCase().includes(q)) ||
        b.travelerName?.toLowerCase().includes(q) ||
        b.travelerMobile?.includes(q) ||
        b.fromLocation?.toLowerCase().includes(q) ||
        b.toLocation?.toLowerCase().includes(q) ||
        b.vehicleNumber?.toLowerCase().includes(q) ||
        b.driverName?.toLowerCase().includes(q)
    );
  }, [pendingBookings, searchQuery]);

  // Toggle company accordion
  const toggleCompanyAccordion = (compName: string) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [compName]: !prev[compName],
    }));
  };

  // Open Collect Payment Modal
  const handleOpenCollectModal = (b: CreditBookingRecord) => {
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
      alert("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (collectMode === "UPI" && !collectRefNumber.trim()) {
      alert("Please enter the UPI Reference Number (UTR / Ref ID).");
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
        `Amount cannot exceed the remaining balance due of ₹${currentBalance.toLocaleString("en-IN")}.`
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

      // 1. Update booking in Firestore
      await updateDoc(doc(db, "bookings", collectingBooking.id), {
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        paymentStatus: newPayStatus,
        paymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // 2. Add ledger record in payments collection
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
      console.error("Error collecting payment in credit page:", err);
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
        <span className="text-[#f16623] font-medium">Credit & Dues</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <WalletCards className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Credit & Outstanding Receivables
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {pendingBookings.length} Trips with Dues
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage unpaid & partial payment bookings grouped customer-wise (companies) with quick collection
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search company, traveler, trip #..."
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
              ₹{totalBalanceDue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Total Companies with Dues */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Companies with Dues
            </span>
            <span className="text-base font-medium text-slate-900 font-mono">
              {companySummaries.length}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        {/* Total Billed Trip Amount */}
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Billed Amount
            </span>
            <span className="text-base font-medium text-slate-700 font-mono">
              ₹{totalGrossValue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-slate-50 text-slate-600 flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        {/* Total Advances Collected */}
        <div className="bg-white p-2.5 rounded-[6px] border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Advances / Collected
            </span>
            <span className="text-base font-medium text-emerald-600 font-mono">
              ₹{totalReceivedValue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
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

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("companies")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "companies"
                ? "border-[#f16623] text-[#f16623]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Customer / Company Wise</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {companySummaries.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all_bookings")}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "all_bookings"
                ? "border-[#f16623] text-[#f16623]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>All Pending Bookings List</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
              {pendingBookings.length}
            </span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-8 text-center bg-white rounded-[6px] border border-slate-200">
          <Loader2 className="w-6 h-6 animate-spin text-[#f16623] mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading credit and outstanding ledgers...</p>
        </div>
      )}

      {/* Tab 1: Customer / Company Wise */}
      {!loading && activeTab === "companies" && (
        <div className="space-y-2.5">
          {filteredCompanySummaries.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-[6px] border border-slate-200 text-slate-500 text-xs">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-medium text-slate-700">No outstanding company credits found</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All trips for registered companies are completely settled and marked as Paid.
              </p>
            </div>
          ) : (
            filteredCompanySummaries.map((comp) => {
              const isExpanded = !!expandedCompanies[comp.companyName];

              return (
                <div
                  key={comp.companyName}
                  className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs transition hover:border-slate-300"
                >
                  {/* Company Summary Card Header */}
                  <div
                    onClick={() => toggleCompanyAccordion(comp.companyName)}
                    className="p-3 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white hover:bg-slate-50/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[36px] h-[36px] rounded-[6px] bg-orange-50 border border-orange-200 text-[#f16623] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs sm:text-sm font-medium text-slate-900">
                            {comp.companyName}
                          </h3>
                          <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {comp.pendingTripsCount} {comp.pendingTripsCount === 1 ? "Trip Due" : "Trips Due"}
                          </span>
                        </div>
                        {comp.primaryContactPhone && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                            <PhoneCall className="w-3 h-3 text-slate-400" />
                            <span>{comp.primaryContactPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Figures Pill Row */}
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Billed
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-700">
                          ₹{comp.totalGrossAmount.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Collected
                        </span>
                        <span className="text-xs font-mono font-medium text-emerald-600">
                          ₹{comp.totalReceivedAmount.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="text-right pl-2 border-l border-slate-200">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                          Balance Due
                        </span>
                        <span className="text-sm font-mono font-medium text-amber-600">
                          ₹{comp.totalBalanceDue.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="p-1 rounded-[4px] text-slate-400 hover:text-slate-600 transition"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Accordion Content: All Unpaid & Partial Bookings for this Company */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/40 p-3 space-y-2">
                      <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between pb-1">
                        <span>Pending Trips for {comp.companyName}:</span>
                        <span className="text-[10px] text-slate-400">
                          Click Collect Payment on any trip to record payment
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-[6px] bg-white">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-medium">
                              <th className="py-2 px-3">Trip # / Date</th>
                              <th className="py-2 px-3">Passenger & Route</th>
                              <th className="py-2 px-3">Vehicle & Driver</th>
                              <th className="py-2 px-3 text-right">Total Bill</th>
                              <th className="py-2 px-3 text-right">Paid / Advance</th>
                              <th className="py-2 px-3 text-right">Balance Due</th>
                              <th className="py-2 px-3 text-center">Status</th>
                              <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {comp.bookings.map((b) => {
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
                                      <span>
                                        {b.startDate || "N/A"} {b.startTime || ""}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Passenger & Route */}
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-slate-800">
                                      {b.travelerName || "Direct Passenger"}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate max-w-[160px]">
                                        {b.fromLocation || "Pickup"} → {b.toLocation || "Drop"}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Vehicle & Driver */}
                                  <td className="py-2.5 px-3">
                                    <div className="text-slate-800 flex items-center gap-1">
                                      <Car className="w-3 h-3 text-slate-400" />
                                      <span>
                                        {b.vehicleNumber || b.vehicleCategoryName || "Unassigned"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {b.driverName ? `Driver: ${b.driverName}` : "No driver assigned"}
                                    </div>
                                  </td>

                                  {/* Total Bill */}
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
                                          : b.paymentStatus === "Partial"
                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      }`}
                                    >
                                      {b.paymentStatus || "Unpaid"}
                                    </span>
                                  </td>

                                  {/* Actions */}
                                  <td className="py-2.5 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* History button */}
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
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: All Pending Bookings Flat List */}
      {!loading && activeTab === "all_bookings" && (
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-medium">
                  <th className="py-2 px-3">Trip # / Date</th>
                  <th className="py-2 px-3">Customer (Company)</th>
                  <th className="py-2 px-3">Traveler & Route</th>
                  <th className="py-2 px-3">Vehicle & Driver</th>
                  <th className="py-2 px-3 text-right">Total Bill</th>
                  <th className="py-2 px-3 text-right">Paid / Advance</th>
                  <th className="py-2 px-3 text-right">Balance Due</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No pending payment trips found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => {
                    const totalBill =
                      Number(b.grossAmount) || Number(b.netAmount) || 0;
                    const paid = Number(b.receivedAmount) || 0;
                    const balance =
                      b.balanceAmount ?? Math.max(0, totalBill - paid);

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-medium text-[#f16623]">
                            {b.bookingNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {b.startDate || "N/A"}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">
                            {b.customerName || b.companyName || "Direct"}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="text-slate-800">{b.travelerName || "Traveler"}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {b.fromLocation} → {b.toLocation}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="text-slate-800">
                            {b.vehicleNumber || b.vehicleCategoryName || "Unassigned"}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {b.driverName || "No driver"}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          ₹{totalBill.toLocaleString("en-IN")}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                          ₹{paid.toLocaleString("en-IN")}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-600">
                          ₹{balance.toLocaleString("en-IN")}
                        </td>

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

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setHistoryBooking(b)}
                              title="Payment History"
                              className="h-[30px] px-2 rounded-[6px] border border-slate-200 bg-white text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1 transition"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
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
        </div>
      )}

      {/* ===================================================================== */}
      {/* COLLECT PAYMENT MODAL                                                  */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={!!collectingBooking}
        onClose={() => setCollectingBooking(null)}
        title="Collect Payment"
        subtitle={`Recording receipt for trip #${collectingBooking?.bookingNumber || ""}`}
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
      {/* PAYMENT HISTORY DRAWER                                                 */}
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
                <span className="text-slate-500">Passenger:</span>
                <span className="text-slate-800">{historyBooking.travelerName || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Total Bill:</span>
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
                <span className="text-amber-700">Balance Due:</span>
                <span className="font-mono font-medium text-amber-600">
                  ₹{(Number(historyBooking.balanceAmount) || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Chronological List of Payments */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-600 uppercase tracking-wider">
                PAYMENT TRANSACTIONS ({(historyBooking.paymentHistory || []).length})
              </div>

              {(!historyBooking.paymentHistory || historyBooking.paymentHistory.length === 0) ? (
                <div className="p-6 text-center bg-slate-50 rounded-[6px] border border-dashed border-slate-200 text-slate-400">
                  <Banknote className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p>No payments recorded yet.</p>
                  <p className="text-[10px] mt-0.5">This trip is currently marked as Unpaid.</p>
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

            {/* Quick Action in History Drawer */}
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
