"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Compass,
  Clock,
  Calendar,
  MapPin,
  ArrowRight,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  IndianRupee,
  Banknote,
  QrCode,
  CreditCard,
  Coins,
  Loader2,
  Search,
  Filter,
  Car,
  Layers,
  ChevronRight,
  Check,
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
import { SearchableSelect } from "@/components/SearchableSelect";

interface PaymentSplits {
  cash: number;
  upi: number;
  card: number;
}

interface DriverOption {
  id: string;
  name: string;
  mobile: string;
  vehicleName?: string;
  vehicleRegNumber?: string;
  licenseNumber?: string;
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
  driverId?: string | null;
  driverName?: string | null;
  driverMobile?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  tripStatus?: "unassigned" | "assigned" | "in_progress" | "completed";
  amount: number;
  discountType?: "rupees" | "percent";
  discountValue?: number;
  discount: number;
  netAmount: number;
  paymentMode: "cash" | "upi" | "card" | "split";
  paymentSplits?: PaymentSplits | null;
  receivedAmount: number;
  balanceAmount: number;
  status: "confirmed" | "completed" | "cancelled";
  createdAt?: Timestamp | null;
  completedAt?: Timestamp | null;
}

export default function DriverTripPlanPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Trip Completion Dialog State
  const [completingBooking, setCompletingBooking] = useState<BookingRecord | null>(null);
  const [hasPaymentReceived, setHasPaymentReceived] = useState<boolean>(true);
  const [receivedAmountInput, setReceivedAmountInput] = useState<string>("");
  const [receivedMode, setReceivedMode] = useState<"cash" | "upi" | "card" | "split">("cash");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitUpi, setSplitUpi] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Drivers
  useEffect(() => {
    try {
      const q = query(collection(db, "drivers"), orderBy("name", "asc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: DriverOption[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            name: docSnap.data().name || "Unnamed Driver",
            mobile: docSnap.data().mobile || "",
            vehicleName: docSnap.data().vehicleName || "",
            vehicleRegNumber: docSnap.data().vehicleRegNumber || "",
            licenseNumber: docSnap.data().licenseNumber || "",
          }));
          setDrivers(items);
        },
        (err) => {
          console.error("Drivers listener error:", err);
          const fallback = query(collection(db, "drivers"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: DriverOption[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              name: docSnap.data().name || "Unnamed Driver",
              mobile: docSnap.data().mobile || "",
              vehicleName: docSnap.data().vehicleName || "",
              vehicleRegNumber: docSnap.data().vehicleRegNumber || "",
              licenseNumber: docSnap.data().licenseNumber || "",
            }));
            setDrivers(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load drivers:", err);
    }
  }, []);

  // 2. Subscribe to Bookings
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
          console.error("Bookings listener fallback:", err);
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
      console.error("Failed to load bookings in trip plan:", err);
      setLoading(false);
    }
  }, []);

  // REQUIREMENT 3: TIMING-WISE SORTED CHRONOLOGICALLY (EARLIEST TIME FIRST)
  const sortedAndFilteredTrips = useMemo(() => {
    return bookings
      // Must be an assigned trip
      .filter((b) => Boolean(b.driverId || b.driverName))
      // Filter by selected Driver
      .filter((b) => {
        if (selectedDriverId === "all") return true;
        return b.driverId === selectedDriverId;
      })
      // Filter by trip status
      .filter((b) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "pending") return b.tripStatus !== "completed";
        if (statusFilter === "completed") return b.tripStatus === "completed";
        return true;
      })
      // Search query
      .filter((b) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.driverName?.toLowerCase().includes(q) ||
          b.clientName?.toLowerCase().includes(q) ||
          b.clientMobile?.toLowerCase().includes(q) ||
          b.fromLocation?.toLowerCase().includes(q) ||
          b.toLocation?.toLowerCase().includes(q)
        );
      })
      // CHRONOLOGICAL TIMING SORT (Earliest time at first)
      .sort((a, b) => {
        const dateA = a.pickupDate || "9999-99-99";
        const dateB = b.pickupDate || "9999-99-99";
        if (dateA !== dateB) {
          return dateA.localeCompare(dateB);
        }
        const timeA = a.pickupTime || "00:00";
        const timeB = b.pickupTime || "00:00";
        return timeA.localeCompare(timeB);
      });
  }, [bookings, selectedDriverId, statusFilter, searchQuery]);

  // Aggregate Metrics for currently viewed driver
  const totalAssignedTrips = sortedAndFilteredTrips.length;
  const completedTripsCount = sortedAndFilteredTrips.filter(
    (t) => t.tripStatus === "completed"
  ).length;
  const pendingTripsCount = totalAssignedTrips - completedTripsCount;
  const totalPendingBalance = sortedAndFilteredTrips
    .filter((t) => t.tripStatus !== "completed")
    .reduce((sum, t) => sum + (t.balanceAmount || 0), 0);

  // Active selected driver details
  const activeDriver = useMemo(() => {
    return drivers.find((d) => d.id === selectedDriverId) || null;
  }, [drivers, selectedDriverId]);

  // Open Trip Completion Dialog
  const handleOpenCompleteTrip = (trip: BookingRecord) => {
    setCompletingBooking(trip);
    // If balance is due, default to yes with remaining balance
    if (trip.balanceAmount > 0) {
      setHasPaymentReceived(true);
      setReceivedAmountInput(String(trip.balanceAmount));
    } else {
      setHasPaymentReceived(false);
      setReceivedAmountInput("0");
    }
    setReceivedMode("cash");
    setSplitCash("");
    setSplitUpi("");
    setSplitCard("");
  };

  // Submit Trip Completion & Payment
  const handleSubmitTripCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingBooking) return;

    let paymentToRecord = 0;

    if (hasPaymentReceived) {
      if (receivedMode === "split") {
        const c = Math.max(0, Number(splitCash) || 0);
        const u = Math.max(0, Number(splitUpi) || 0);
        const cd = Math.max(0, Number(splitCard) || 0);
        paymentToRecord = c + u + cd;
      } else {
        paymentToRecord = Math.max(0, Number(receivedAmountInput) || 0);
      }

      if (paymentToRecord <= 0) {
        alert("Please enter the amount received from customer, or choose 'No'.");
        return;
      }
    }

    setIsSubmittingCompletion(true);

    try {
      const currentReceived = completingBooking.receivedAmount || 0;
      const currentBalance = completingBooking.balanceAmount || 0;

      const newReceived = currentReceived + paymentToRecord;
      const newBalance = Math.max(0, currentBalance - paymentToRecord);

      // 1. Update Booking Document
      const bookingRef = doc(db, "bookings", completingBooking.id);
      await updateDoc(bookingRef, {
        status: "completed",
        tripStatus: "completed",
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        completedAt: serverTimestamp(),
      });

      // 2. If payment was received, add to payments collection
      if (hasPaymentReceived && paymentToRecord > 0) {
        const splitsData: PaymentSplits | null =
          receivedMode === "split"
            ? {
                cash: Number(splitCash) || 0,
                upi: Number(splitUpi) || 0,
                card: Number(splitCard) || 0,
              }
            : null;

        await addDoc(collection(db, "payments"), {
          bookingId: completingBooking.id,
          bookingNumber: completingBooking.bookingNumber,
          clientType: completingBooking.clientType,
          clientId: completingBooking.clientId,
          clientName: completingBooking.clientName,
          clientMobile: completingBooking.clientMobile,
          companyName: completingBooking.companyName || null,
          fromLocation: completingBooking.fromLocation,
          toLocation: completingBooking.toLocation,
          amountCollected: paymentToRecord,
          paymentMode: receivedMode,
          splits: splitsData,
          note: `Collected by driver (${completingBooking.driverName || "Driver"}) on trip completion`,
          createdAt: serverTimestamp(),
        });
      }

      setFeedback({
        type: "success",
        message: `Trip for Booking #${completingBooking.bookingNumber} marked as completed! ${
          paymentToRecord > 0
            ? `₹${paymentToRecord.toLocaleString("en-IN")} received and added to payments register.`
            : ""
        }`,
      });

      setCompletingBooking(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error completing trip:", err);
      alert("Failed to complete trip. Please try again.");
    } finally {
      setIsSubmittingCompletion(false);
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
        <span className="text-slate-500">FLEET & CREW</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Driver Trip Plan</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Driver Trip Plan & Dispatch Schedule
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                Timing Ordered
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Chronological trip manifest (earliest first), passenger call & on-trip fare settlement
            </p>
          </div>
        </div>

        {/* Driver Selector & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Driver Switcher Dropdown */}
          <div className="flex items-center gap-1.5 w-60">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Driver:
            </span>
            <SearchableSelect
              options={[
                { value: "all", label: "-- All Assigned Drivers --" },
                ...drivers.map((d) => ({
                  value: d.id,
                  label: d.name,
                  subLabel: d.vehicleName ? `Vehicle: ${d.vehicleName}` : undefined,
                })),
              ]}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              placeholder="Select Driver..."
            />
          </div>

          {/* Search */}
          <div className="relative sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search route, passenger..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
            />
          </div>
        </div>
      </div>

      {/* Driver Overview Card (if specific driver selected) */}
      {activeDriver && (
        <div className="bg-white p-2.5 rounded-[6px] border border-orange-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-[32px] h-[32px] rounded-[6px] bg-orange-50 text-[#f16623] flex items-center justify-center font-medium text-xs">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-900">
                  {activeDriver.name}
                </span>
                {activeDriver.vehicleName && (
                  <span className="px-1.5 py-0.2 rounded-[3px] bg-slate-100 text-slate-700 text-[10px] font-normal flex items-center gap-1">
                    <Car className="w-2.5 h-2.5" />
                    {activeDriver.vehicleName}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-normal">
                {activeDriver.mobile} • DL: {activeDriver.licenseNumber || "Verified"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-[10px] text-slate-400 block font-normal">
                Scheduled Runs
              </span>
              <span className="font-medium text-slate-800">
                {totalAssignedTrips} Trips
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-normal">
                Completed
              </span>
              <span className="font-medium text-emerald-600">
                {completedTripsCount} Done
              </span>
            </div>
            <div>
              <span className="text-[10px] text-amber-600 block font-normal">
                Pending Balance
              </span>
              <span className="font-medium text-amber-600">
                ₹{totalPendingBalance.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 rounded-[6px] shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`h-[28px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              statusFilter === "all"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Scheduled ({totalAssignedTrips})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={`h-[28px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              statusFilter === "pending"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pending Trips ({pendingTripsCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={`h-[28px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium transition cursor-pointer ${
              statusFilter === "completed"
                ? "bg-[#f16623] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Completed ({completedTripsCount})
          </button>
        </div>

        <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
          Ordered earliest pickup time first
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

      {/* TIMING-WISE TRIP MANIFEST CARDS */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-white rounded-[6px] border border-slate-200">
          <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
          <span className="text-xs font-normal">
            Loading driver trip plan...
          </span>
        </div>
      ) : sortedAndFilteredTrips.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-[6px] border border-slate-200 shadow-xs">
          <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
            <Compass className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-medium text-slate-800">
            {searchQuery
              ? "No matching trips found"
              : selectedDriverId !== "all"
              ? `No trips assigned to ${activeDriver?.name || "this driver"}`
              : "No assigned trips found"}
          </h4>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
            Assign drivers to bookings in the{" "}
            <Link href="/bookings" className="text-[#f16623] underline font-medium">
              Bookings Page
            </Link>{" "}
            to schedule upcoming runs here.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sortedAndFilteredTrips.map((trip, idx) => {
            const isDone = trip.tripStatus === "completed";

            return (
              <div
                key={trip.id}
                className={`bg-white rounded-[6px] border transition-all p-3 shadow-xs ${
                  isDone
                    ? "border-slate-200 bg-slate-50/40 opacity-90"
                    : "border-slate-200/90 hover:border-[#f16623]/40"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left Side: Order Sequence & Chronological Timing Badge */}
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Sequence Badge */}
                    <div className="w-8 h-8 rounded-[6px] bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[9px] text-slate-400 font-medium uppercase leading-none">
                        Run
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-900 leading-none mt-0.5">
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Prominent Timing Pill (First time at first) */}
                    <div className="bg-orange-50/80 border border-[#f16623]/25 px-2.5 py-1 rounded-[6px] flex flex-col shrink-0">
                      <span className="text-xs font-mono font-medium text-[#f16623] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {trip.pickupTime || "09:00"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {trip.pickupDate || "Today"}
                      </span>
                    </div>

                    {/* Route & Booking Info */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-medium text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {trip.bookingNumber}
                        </span>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-900">
                          <span>{trip.fromLocation}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#f16623] shrink-0" />
                          <span>{trip.toLocation}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-normal">
                        <span>Plan: {trip.planName || "Standard Tariff"}</span>
                        {trip.driverName && (
                          <span className="text-emerald-700 font-medium">
                            • Driver: {trip.driverName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Passenger Contact, Fares & "Trip Completed" Action */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Passenger Info with Call Button */}
                    <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-[6px] border border-slate-200/60">
                      <div className="text-left">
                        <span className="text-xs font-medium text-slate-900 block leading-tight">
                          {trip.clientName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {trip.clientMobile}
                        </span>
                      </div>
                      <a
                        href={`tel:${trip.clientMobile}`}
                        className="w-[28px] h-[28px] rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shadow-xs"
                        title="Call Passenger"
                      >
                        <PhoneCall className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Fare / Balance Info */}
                    <div className="text-left sm:text-right font-mono text-xs">
                      <span className="text-[10px] text-slate-400 block font-normal">
                        Fare: ₹{Number(trip.netAmount).toLocaleString("en-IN")} • Paid: ₹{Number(trip.receivedAmount).toLocaleString("en-IN")}
                      </span>
                      {trip.balanceAmount > 0 ? (
                        <span className="font-medium text-amber-600">
                          Collect: ₹{Number(trip.balanceAmount).toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-600">
                          Fully Paid
                        </span>
                      )}
                    </div>

                    {/* REQUIREMENT 3: "TRIP COMPLETED" ACTION BUTTON */}
                    <div>
                      {isDone ? (
                        <div className="h-[34px] px-3 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Trip Completed</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteTrip(trip)}
                          className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Trip Completed</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REQUIREMENT 3: TRIP COMPLETED & PAYMENT RECEIVED DIALOG / DRAWER */}
      <OffCanvas
        isOpen={Boolean(completingBooking)}
        onClose={() => {
          if (!isSubmittingCompletion) setCompletingBooking(null);
        }}
        title="Complete Trip & Record Payment"
        subtitle={`Booking #${completingBooking?.bookingNumber || ""} • ${completingBooking?.fromLocation || ""} ➔ ${completingBooking?.toLocation || ""}`}
      >
        {completingBooking && (
          <form onSubmit={handleSubmitTripCompletion} className="space-y-3.5">
            {/* Trip Details Card */}
            <div className="bg-slate-50 p-2.5 rounded-[6px] border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-normal">Passenger:</span>
                <span className="font-medium text-slate-900">
                  {completingBooking.clientName} ({completingBooking.clientMobile})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-normal">Driver:</span>
                <span className="font-medium text-emerald-700">
                  {completingBooking.driverName || "Fleet Driver"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-mono">
                <span className="text-slate-500 font-normal">Total Net Fare:</span>
                <span className="font-medium text-slate-900">
                  ₹{completingBooking.netAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-slate-500 font-normal">Remaining Due:</span>
                <span className="font-medium text-amber-600 text-sm">
                  ₹{completingBooking.balanceAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Question: Any Payment Received? */}
            <div className="space-y-2 pt-1">
              <label className="text-[10px] font-medium text-slate-700 uppercase tracking-wider block">
                Any Payment Received from Customer? <span className="text-[#f16623]">*</span>
              </label>

              {/* Yes / No Toggle Switch */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHasPaymentReceived(true);
                    if (completingBooking.balanceAmount > 0) {
                      setReceivedAmountInput(String(completingBooking.balanceAmount));
                    }
                  }}
                  className={`h-[34px] max-h-[34px] rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    hasPaymentReceived
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Yes, Payment Received</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHasPaymentReceived(false);
                    setReceivedAmountInput("0");
                  }}
                  className={`h-[34px] max-h-[34px] rounded-[6px] border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    !hasPaymentReceived
                      ? "bg-slate-800 border-slate-800 text-white shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>No (Keep as Credit)</span>
                </button>
              </div>
            </div>

            {/* If Yes: Amount & Payment Method */}
            {hasPaymentReceived && (
              <div className="bg-slate-50 p-2.5 rounded-[6px] border border-orange-200 space-y-2.5">
                {/* Amount Input */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="trip-amount-received"
                      className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                    >
                      Amount Received (₹) <span className="text-[#f16623]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setReceivedAmountInput(String(completingBooking.balanceAmount))
                      }
                      className="text-[10px] text-[#f16623] hover:underline font-medium"
                    >
                      Fill Full (₹{completingBooking.balanceAmount})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      ₹
                    </span>
                    <input
                      id="trip-amount-received"
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 1500"
                      value={receivedAmountInput}
                      onChange={(e) => setReceivedAmountInput(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] font-normal"
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    Payment Method <span className="text-[#f16623]">*</span>
                  </label>

                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setReceivedMode("cash")}
                      className={`h-[32px] rounded-[6px] border text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                        receivedMode === "cash"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Banknote className="w-3 h-3" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceivedMode("upi")}
                      className={`h-[32px] rounded-[6px] border text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                        receivedMode === "upi"
                          ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <QrCode className="w-3 h-3" />
                      <span>UPI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceivedMode("card")}
                      className={`h-[32px] rounded-[6px] border text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                        receivedMode === "card"
                          ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <CreditCard className="w-3 h-3" />
                      <span>Card</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReceivedMode("split")}
                      className={`h-[32px] rounded-[6px] border text-[11px] font-medium flex items-center justify-center gap-1 transition cursor-pointer ${
                        receivedMode === "split"
                          ? "bg-orange-50 border-[#f16623] text-[#f16623] shadow-xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Coins className="w-3 h-3" />
                      <span>Split</span>
                    </button>
                  </div>
                </div>

                {/* Split Breakdown */}
                {receivedMode === "split" && (
                  <div className="pt-1 grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-medium text-slate-600 flex items-center gap-1">
                        <Banknote className="w-2.5 h-2.5 text-emerald-600" />
                        Cash (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[9px] font-medium text-slate-600 flex items-center gap-1">
                        <QrCode className="w-2.5 h-2.5 text-blue-600" />
                        UPI (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={splitUpi}
                        onChange={(e) => setSplitUpi(e.target.value)}
                        className="w-full h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[9px] font-medium text-slate-600 flex items-center gap-1">
                        <CreditCard className="w-2.5 h-2.5 text-purple-600" />
                        Card (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={splitCard}
                        onChange={(e) => setSplitCard(e.target.value)}
                        className="w-full h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmittingCompletion}
                onClick={() => setCompletingBooking(null)}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmittingCompletion}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                {isSubmittingCompletion ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Complete Trip & Save</span>
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
