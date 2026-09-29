"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Plus,
  Search,
  MapPin,
  ArrowRight,
  User,
  Building2,
  Layers,
  IndianRupee,
  Percent,
  Wallet,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  UserPlus,
  X,
  Clock,
  Car,
  FileText,
} from "lucide-react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";

interface PlanItem {
  id: string;
  planName: string;
  amount: number;
  travelId?: string;
  travelName?: string;
  packageType?: string;
}

interface CustomerOption {
  id: string;
  name: string;
  mobile: string;
  email?: string;
}

interface BusinessOwnerOption {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  companyName: string;
  gstNumber?: string;
}

interface BookingRecord {
  id: string;
  bookingNumber: string;
  fromLocation: string;
  toLocation: string;
  planId: string;
  planName: string;
  clientType: "customer" | "business_owner";
  clientId: string;
  clientName: string;
  clientMobile: string;
  clientEmail?: string;
  companyName?: string;
  amount: number;
  discount: number;
  netAmount: number;
  receivedAmount: number;
  balanceAmount: number;
  status: "confirmed" | "completed" | "cancelled";
  createdAt?: Timestamp | null;
}

export default function BookingsPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Form Fields - Booking details
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedPlanName, setSelectedPlanName] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [discount, setDiscount] = useState<string>("0");
  const [receivedAmount, setReceivedAmount] = useState<string>("0");

  // Client Selection
  const [clientType, setClientType] = useState<"customer" | "business_owner">(
    "customer"
  );
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
    mobile: string;
    email?: string;
    companyName?: string;
  } | null>(null);

  // Inline "Add Customer" form state inside Drawer
  const [showAddCustomerInline, setShowAddCustomerInline] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustMobile, setNewCustMobile] = useState("");
  const [newCustEmail, setNewCustEmail] = useState("");
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Inline "Add Business Owner" form state inside Drawer
  const [showAddOwnerInline, setShowAddOwnerInline] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerMobile, setNewOwnerMobile] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerCompany, setNewOwnerCompany] = useState("");
  const [newOwnerGst, setNewOwnerGst] = useState("");
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  // Firestore collections data
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [businessOwners, setBusinessOwners] = useState<BusinessOwnerOption[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);

  // UI States
  const [loading, setLoading] = useState(true);
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Plans
  useEffect(() => {
    try {
      const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: PlanItem[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            planName: docSnap.data().planName || "Unnamed Plan",
            amount: Number(docSnap.data().amount) || 0,
            travelId: docSnap.data().travelId,
            travelName: docSnap.data().travelName,
            packageType: docSnap.data().packageType,
          }));
          setPlans(items);
        },
        (err) => {
          console.error("Plans listener fallback:", err);
          const fallback = query(collection(db, "plans"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: PlanItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              planName: docSnap.data().planName || "Unnamed Plan",
              amount: Number(docSnap.data().amount) || 0,
              travelId: docSnap.data().travelId,
              travelName: docSnap.data().travelName,
              packageType: docSnap.data().packageType,
            }));
            setPlans(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load plans:", err);
    }
  }, []);

  // 2. Subscribe to Customers
  useEffect(() => {
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: CustomerOption[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            name: docSnap.data().name || "",
            mobile: docSnap.data().mobile || "",
            email: docSnap.data().email || "",
          }));
          setCustomers(items);
        },
        (err) => {
          console.error("Customers fallback listener:", err);
          const fallback = query(collection(db, "customers"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: CustomerOption[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              name: docSnap.data().name || "",
              mobile: docSnap.data().mobile || "",
              email: docSnap.data().email || "",
            }));
            setCustomers(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  }, []);

  // 3. Subscribe to Business Owners
  useEffect(() => {
    try {
      const q = query(
        collection(db, "business_owners"),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items: BusinessOwnerOption[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            name: docSnap.data().name || "",
            mobile: docSnap.data().mobile || "",
            email: docSnap.data().email || "",
            companyName: docSnap.data().companyName || "",
            gstNumber: docSnap.data().gstNumber || "",
          }));
          setBusinessOwners(items);
        },
        (err) => {
          console.error("Business owners fallback listener:", err);
          const fallback = query(collection(db, "business_owners"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: BusinessOwnerOption[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              name: docSnap.data().name || "",
              mobile: docSnap.data().mobile || "",
              email: docSnap.data().email || "",
              companyName: docSnap.data().companyName || "",
              gstNumber: docSnap.data().gstNumber || "",
            }));
            setBusinessOwners(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load business owners:", err);
    }
  }, []);

  // 4. Subscribe to Bookings
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
          console.error("Bookings fallback listener:", err);
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
      console.error("Failed to initialize bookings listener:", err);
      setLoading(false);
    }
  }, []);

  // Filtered client options based on search query
  const filteredCustomers = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.mobile.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [customers, clientSearchQuery]);

  const filteredOwners = useMemo(() => {
    const q = clientSearchQuery.trim().toLowerCase();
    if (!q) return businessOwners.slice(0, 8);
    return businessOwners
      .filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.mobile.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [businessOwners, clientSearchQuery]);

  // Handle Plan selection -> Auto-populate amount
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      setSelectedPlanName(plan.planName);
      setAmount(String(plan.amount));
    } else {
      setSelectedPlanName("");
    }
  };

  // Financial calculations
  const parsedAmount = Math.max(0, Number(amount) || 0);
  const parsedDiscount = Math.max(0, Number(discount) || 0);
  const netPayable = Math.max(0, parsedAmount - parsedDiscount);
  const parsedReceived = Math.max(0, Number(receivedAmount) || 0);
  const balanceDue = Math.max(0, netPayable - parsedReceived);

  // Save new Customer inline
  const handleSaveCustomerInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const tName = newCustName.trim();
    const tMobile = newCustMobile.trim();
    const tEmail = newCustEmail.trim();

    if (!tName || !tMobile) {
      alert("Please provide customer name and mobile number.");
      return;
    }

    setIsSavingCustomer(true);
    try {
      const docRef = await addDoc(collection(db, "customers"), {
        name: tName,
        mobile: tMobile,
        email: tEmail || null,
        createdAt: serverTimestamp(),
      });

      // Auto-select newly created customer
      setSelectedClient({
        id: docRef.id,
        name: tName,
        mobile: tMobile,
        email: tEmail || undefined,
      });

      // Reset inline form
      setNewCustName("");
      setNewCustMobile("");
      setNewCustEmail("");
      setShowAddCustomerInline(false);
      setClientSearchQuery("");
    } catch (err) {
      console.error("Error saving customer inline:", err);
      alert("Failed to save customer. Please try again.");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Save new Business Owner inline
  const handleSaveOwnerInline = async (e: React.FormEvent) => {
    e.preventDefault();
    const tName = newOwnerName.trim();
    const tMobile = newOwnerMobile.trim();
    const tCompany = newOwnerCompany.trim();
    const tEmail = newOwnerEmail.trim();
    const tGst = newOwnerGst.trim().toUpperCase();

    if (!tName || !tMobile || !tCompany) {
      alert("Please provide owner name, mobile number, and company name.");
      return;
    }

    setIsSavingOwner(true);
    try {
      const docRef = await addDoc(collection(db, "business_owners"), {
        name: tName,
        mobile: tMobile,
        companyName: tCompany,
        email: tEmail || null,
        gstNumber: tGst || null,
        createdAt: serverTimestamp(),
      });

      // Auto-select newly created business owner
      setSelectedClient({
        id: docRef.id,
        name: tName,
        mobile: tMobile,
        email: tEmail || undefined,
        companyName: tCompany,
      });

      // Reset inline form
      setNewOwnerName("");
      setNewOwnerMobile("");
      setNewOwnerCompany("");
      setNewOwnerEmail("");
      setNewOwnerGst("");
      setShowAddOwnerInline(false);
      setClientSearchQuery("");
    } catch (err) {
      console.error("Error saving business owner inline:", err);
      alert("Failed to save business owner. Please try again.");
    } finally {
      setIsSavingOwner(false);
    }
  };

  // Submit Main Booking Form
  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const fromTrimmed = fromLocation.trim();
    const toTrimmed = toLocation.trim();

    if (!fromTrimmed) {
      setFeedback({ type: "error", message: "Please specify From location." });
      return;
    }
    if (!toTrimmed) {
      setFeedback({ type: "error", message: "Please specify To location." });
      return;
    }
    if (!selectedPlanId) {
      setFeedback({ type: "error", message: "Please select a Travel Plan." });
      return;
    }
    if (!selectedClient) {
      setFeedback({
        type: "error",
        message: `Please select or add a ${
          clientType === "customer" ? "Customer" : "Business Owner"
        }.`,
      });
      return;
    }
    if (parsedAmount <= 0) {
      setFeedback({
        type: "error",
        message: "Please enter a valid fare amount greater than 0.",
      });
      return;
    }

    setIsSubmittingBooking(true);

    try {
      // Generate clean Booking Reference
      const bookingNo = `RKB-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, "bookings"), {
        bookingNumber: bookingNo,
        fromLocation: fromTrimmed,
        toLocation: toTrimmed,
        planId: selectedPlanId,
        planName: selectedPlanName,
        clientType: clientType,
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientMobile: selectedClient.mobile,
        clientEmail: selectedClient.email || null,
        companyName: selectedClient.companyName || null,
        amount: parsedAmount,
        discount: parsedDiscount,
        netAmount: netPayable,
        receivedAmount: parsedReceived,
        balanceAmount: balanceDue,
        status: "confirmed",
        createdAt: serverTimestamp(),
      });

      // Reset form states
      setFromLocation("");
      setToLocation("");
      setSelectedPlanId("");
      setSelectedPlanName("");
      setAmount("");
      setDiscount("0");
      setReceivedAmount("0");
      setSelectedClient(null);
      setClientSearchQuery("");
      setShowAddCustomerInline(false);
      setShowAddOwnerInline(false);

      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Booking #${bookingNo} created successfully for ${selectedClient.name}!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error creating booking:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to create booking.";
      setFeedback({ type: "error", message: errMsg });
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Delete booking handler
  const handleDeleteBooking = async (id: string, bookingNo: string) => {
    if (!confirm(`Are you sure you want to delete Booking #${bookingNo}?`))
      return;
    try {
      await deleteDoc(doc(db, "bookings", id));
      setFeedback({
        type: "success",
        message: `Booking #${bookingNo} has been deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting booking:", err);
      setFeedback({ type: "error", message: "Failed to delete booking." });
    }
  };

  // Filtered Bookings for the main data table
  const filteredBookings = useMemo(() => {
    const q = tableSearchQuery.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.clientName?.toLowerCase().includes(q) ||
        b.clientMobile?.toLowerCase().includes(q) ||
        b.fromLocation?.toLowerCase().includes(q) ||
        b.toLocation?.toLowerCase().includes(q) ||
        b.planName?.toLowerCase().includes(q) ||
        (b.companyName && b.companyName.toLowerCase().includes(q))
    );
  }, [bookings, tableSearchQuery]);

  // Aggregate stats
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.netAmount || 0), 0);
  const totalReceived = bookings.reduce(
    (sum, b) => sum + (b.receivedAmount || 0),
    0
  );
  const totalBalance = bookings.reduce(
    (sum, b) => sum + (b.balanceAmount || 0),
    0
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">OPERATIONS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Bookings</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Trip Bookings & Dispatch
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {bookings.length} Bookings
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage routes, tariffs, customer/owner assignments & instant billing
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Booking Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search booking, client, route..."
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsOffCanvasOpen(true)}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Booking</span>
          </button>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Bookings
            </span>
            <span className="text-sm font-medium text-slate-900 font-mono">
              {bookings.length}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-slate-50 text-slate-600 flex items-center justify-center">
            <CalendarCheck className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Total Net Value
            </span>
            <span className="text-sm font-medium text-slate-900 font-mono">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <IndianRupee className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Amount Received
            </span>
            <span className="text-sm font-medium text-emerald-600 font-mono">
              ₹{totalReceived.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
              Pending Balance
            </span>
            <span
              className={`text-sm font-medium font-mono ${
                totalBalance > 0 ? "text-amber-600" : "text-slate-900"
              }`}
            >
              ₹{totalBalance.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="w-[30px] h-[30px] rounded-[6px] bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>
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

      {/* Bookings Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Trip Dispatch & Booking Manifest
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredBookings.length} booking{filteredBookings.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">
              Loading bookings from Firestore...
            </span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {tableSearchQuery ? "No matching bookings found" : "No bookings created yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {tableSearchQuery
                ? "Try searching with a different client name, booking ID, or route."
                : "Click on 'Add Booking' to select route locations, tariff plan, customer or business owner, and calculate fares."}
            </p>
            {!tableSearchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Booking</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-medium">Booking #</th>
                  <th className="py-2 px-3 font-medium">Route (From ➔ To)</th>
                  <th className="py-2 px-3 font-medium">Client / Stakeholder</th>
                  <th className="py-2 px-3 font-medium">Plan & Tariff</th>
                  <th className="py-2 px-3 font-medium">Net Amount</th>
                  <th className="py-2 px-3 font-medium">Received / Balance</th>
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
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
                      {/* Booking ID */}
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
                        <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1">
                          <Layers className="w-3 h-3 shrink-0" />
                          <span className="truncate max-w-[130px]">
                            {b.planName}
                          </span>
                        </span>
                      </td>

                      {/* Net Amount */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-mono font-medium text-slate-900 text-xs">
                            ₹{Number(b.netAmount).toLocaleString("en-IN")}
                          </span>
                          {b.discount > 0 && (
                            <span className="text-[10px] text-emerald-600 font-normal">
                              (₹{b.discount} off)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Received & Balance */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono text-emerald-600 font-medium">
                            Rec: ₹{Number(b.receivedAmount).toLocaleString("en-IN")}
                          </span>
                          <span
                            className={`text-[10px] font-mono ${
                              b.balanceAmount > 0
                                ? "text-amber-600 font-medium"
                                : "text-slate-400"
                            }`}
                          >
                            Bal: ₹{Number(b.balanceAmount).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteBooking(b.id, b.bookingNumber)
                          }
                          className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete booking"
                        >
                          <Trash2 className="w-3 h-3" />
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

      {/* Right Side Off-Canvas Drawer for Adding Booking */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmittingBooking) setIsOffCanvasOpen(false);
        }}
        title="Create New Booking"
        subtitle="Route dispatch, tariff plan selection, customer/business owner billing"
      >
        <form onSubmit={handleCreateBooking} className="space-y-3.5">
          {/* Section: Route Locations (From / To) */}
          <div className="bg-slate-50/70 p-2.5 rounded-[6px] border border-slate-200/80 space-y-2.5">
            <span className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#f16623]" />
              Trip Route Coordinates
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* From Location */}
              <div className="space-y-1">
                <label
                  htmlFor="from-location"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  From Location <span className="text-[#f16623]">*</span>
                </label>
                <input
                  id="from-location"
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Airport / Gachibowli"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                />
              </div>

              {/* To Location */}
              <div className="space-y-1">
                <label
                  htmlFor="to-location"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  To Location <span className="text-[#f16623]">*</span>
                </label>
                <input
                  id="to-location"
                  type="text"
                  required
                  placeholder="e.g. Srisailam / Vijayawada"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Select the Plan */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="plan-select"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Layers className="w-3 h-3 text-[#f16623]" />
                Select Travel Plan <span className="text-[#f16623]">*</span>
              </label>
              {plans.length > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">
                  {plans.length} plan{plans.length === 1 ? "" : "s"} available
                </span>
              )}
            </div>

            <select
              id="plan-select"
              required
              value={selectedPlanId}
              onChange={(e) => handleSelectPlan(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              <option value="">-- Choose Tariff Plan --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.planName} — ₹{p.amount.toLocaleString("en-IN")}{" "}
                  {p.travelName ? `(${p.travelName})` : ""}
                </option>
              ))}
            </select>

            {plans.length === 0 && (
              <p className="text-[10px] text-slate-400">
                No plans created yet. Create a plan in the{" "}
                <Link href="/plans" className="text-[#f16623] underline">
                  Plans page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Section: Client Selection (Customer vs Business Owner) */}
          <div className="bg-slate-50/70 p-2.5 rounded-[6px] border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-[#f16623]" />
                Client / Account Type <span className="text-[#f16623]">*</span>
              </span>

              {/* Toggle switch between Customer and Business Owner */}
              <div className="flex rounded-[6px] bg-slate-200/80 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setClientType("customer");
                    setSelectedClient(null);
                    setClientSearchQuery("");
                    setShowAddCustomerInline(false);
                    setShowAddOwnerInline(false);
                  }}
                  className={`h-[26px] max-h-[34px] px-2.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                    clientType === "customer"
                      ? "bg-white text-[#f16623] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClientType("business_owner");
                    setSelectedClient(null);
                    setClientSearchQuery("");
                    setShowAddCustomerInline(false);
                    setShowAddOwnerInline(false);
                  }}
                  className={`h-[26px] max-h-[34px] px-2.5 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                    clientType === "business_owner"
                      ? "bg-white text-[#f16623] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Business Owner
                </button>
              </div>
            </div>

            {/* Display Selected Client (if one is chosen) */}
            {selectedClient ? (
              <div className="bg-white p-2 rounded-[6px] border border-[#f16623]/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-[30px] h-[30px] rounded-[6px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    {clientType === "customer" ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-900">
                        {selectedClient.name}
                      </span>
                      {selectedClient.companyName && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({selectedClient.companyName})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {selectedClient.mobile}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="h-[26px] max-h-[34px] px-2 rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-medium transition cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              /* Search & Add Client Box */
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={`Search ${
                        clientType === "customer"
                          ? "customer by name or mobile..."
                          : "business owner by name, mobile, or company..."
                      }`}
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-7 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                    />
                  </div>

                  {/* Add Customer / Owner Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (clientType === "customer") {
                        setShowAddCustomerInline(!showAddCustomerInline);
                        setShowAddOwnerInline(false);
                      } else {
                        setShowAddOwnerInline(!showAddOwnerInline);
                        setShowAddCustomerInline(false);
                      }
                    }}
                    className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1 transition shrink-0 cursor-pointer"
                    title={`Add New ${
                      clientType === "customer" ? "Customer" : "Business Owner"
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Add{" "}
                      {clientType === "customer" ? "Customer" : "Owner"}
                    </span>
                  </button>
                </div>

                {/* Inline Add Customer Sub-Form */}
                {showAddCustomerInline && clientType === "customer" && (
                  <div className="bg-white p-2.5 rounded-[6px] border border-orange-200/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-medium text-slate-900 flex items-center gap-1">
                        <UserPlus className="w-3 h-3 text-[#f16623]" />
                        Quick Add New Customer
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddCustomerInline(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        placeholder="Customer Name *"
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Number *"
                        value={newCustMobile}
                        onChange={(e) => setNewCustMobile(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                      <input
                        type="email"
                        placeholder="Email (Optional)"
                        value={newCustEmail}
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isSavingCustomer}
                        onClick={handleSaveCustomerInline}
                        className="h-[30px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        {isSavingCustomer ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>Save & Select Customer</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Add Business Owner Sub-Form */}
                {showAddOwnerInline && clientType === "business_owner" && (
                  <div className="bg-white p-2.5 rounded-[6px] border border-orange-200/80 shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-[10px] font-medium text-slate-900 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#f16623]" />
                        Quick Add New Business Owner
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddOwnerInline(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="Owner Name *"
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                      <input
                        type="tel"
                        placeholder="Mobile Number *"
                        value={newOwnerMobile}
                        onChange={(e) => setNewOwnerMobile(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                      <input
                        type="text"
                        placeholder="Company Name *"
                        value={newOwnerCompany}
                        onChange={(e) => setNewOwnerCompany(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                      <input
                        type="text"
                        placeholder="GST Number (Optional)"
                        value={newOwnerGst}
                        onChange={(e) => setNewOwnerGst(e.target.value)}
                        className="h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={isSavingOwner}
                        onClick={handleSaveOwnerInline}
                        className="h-[30px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        {isSavingOwner ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        <span>Save & Select Business Owner</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Candidate Selection List */}
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 bg-white rounded-[6px] border border-slate-200">
                  {clientType === "customer" ? (
                    filteredCustomers.length === 0 ? (
                      <div className="py-2.5 px-3 text-center text-[11px] text-slate-400">
                        No customer found. Click &quot;Add Customer&quot; above to create one.
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedClient({
                              id: c.id,
                              name: c.name,
                              mobile: c.mobile,
                              email: c.email,
                            });
                            setClientSearchQuery("");
                          }}
                          className="py-1.5 px-2.5 hover:bg-orange-50/60 cursor-pointer flex items-center justify-between transition text-xs"
                        >
                          <div>
                            <span className="font-medium text-slate-800">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {c.mobile}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#f16623] font-medium">
                            Select
                          </span>
                        </div>
                      ))
                    )
                  ) : filteredOwners.length === 0 ? (
                    <div className="py-2.5 px-3 text-center text-[11px] text-slate-400">
                      No business owner found. Click &quot;Add Owner&quot; above to create one.
                    </div>
                  ) : (
                    filteredOwners.map((o) => (
                      <div
                        key={o.id}
                        onClick={() => {
                          setSelectedClient({
                            id: o.id,
                            name: o.name,
                            mobile: o.mobile,
                            email: o.email,
                            companyName: o.companyName,
                          });
                          setClientSearchQuery("");
                        }}
                        className="py-1.5 px-2.5 hover:bg-orange-50/60 cursor-pointer flex items-center justify-between transition text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">
                              {o.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({o.companyName})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {o.mobile}
                          </span>
                        </div>
                        <span className="text-[10px] text-[#f16623] font-medium">
                          Select
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section: Financials (Amount, Discount, Received, Balance) */}
          <div className="bg-slate-50/70 p-2.5 rounded-[6px] border border-slate-200/80 space-y-2.5">
            <span className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <IndianRupee className="w-3 h-3 text-[#f16623]" />
              Tariff & Payment Billing
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Fare / Amount */}
              <div className="space-y-1">
                <label
                  htmlFor="booking-amount"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  Amount (₹) <span className="text-[#f16623]">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    ₹
                  </span>
                  <input
                    id="booking-amount"
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] pl-6 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                  />
                </div>
              </div>

              {/* Discount */}
              <div className="space-y-1">
                <label
                  htmlFor="booking-discount"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  Discount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    ₹
                  </span>
                  <input
                    id="booking-discount"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] pl-6 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                  />
                </div>
              </div>

              {/* Received Amount */}
              <div className="space-y-1">
                <label
                  htmlFor="booking-received"
                  className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
                >
                  Received (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                    ₹
                  </span>
                  <input
                    id="booking-received"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] pl-6 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                  />
                </div>
              </div>
            </div>

            {/* Calculations Summary Card */}
            <div className="bg-white p-2.5 rounded-[6px] border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Gross Fare
                </span>
                <span className="font-mono font-medium text-slate-800">
                  ₹{parsedAmount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Discount
                </span>
                <span className="font-mono font-medium text-emerald-600">
                  -₹{parsedDiscount.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Net Payable
                </span>
                <span className="font-mono font-medium text-slate-900">
                  ₹{netPayable.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-normal">
                  Balance Due
                </span>
                <span
                  className={`font-mono font-medium ${
                    balanceDue > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  ₹{balanceDue.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmittingBooking}
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmittingBooking}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              {isSubmittingBooking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Booking...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Booking</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
