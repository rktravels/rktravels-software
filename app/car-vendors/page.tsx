"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Car,
  Check,
  Copy,
  PhoneCall,
  UserCheck,
  MessageSquare,
  IndianRupee,
  Calendar,
  CalendarDays,
  Receipt,
  CreditCard,
  TrendingUp,
  Wallet,
  Clock,
  ArrowRight,
  Layers,
  FileText,
} from "lucide-react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  getDocs,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";

export interface CarVendorItem {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  vendorType?: "Car Vendor" | "Lease Member" | "Both" | string;
  paymentMode?: "Trip wise" | "Daily" | "Monthly" | string;
  amount?: number | string | null;
  isActive: boolean;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

export interface AttachedVehicleItem {
  id: string;
  regNumber: string;
  vehicleName: string;
  category: string;
  seatingCapacity?: string;
  fuelType?: string;
  ownershipType?: string;
  isActive?: boolean;
}

export default function CarVendorsPage() {
  const [vendors, setVendors] = useState<CarVendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination states (User requested: limit to 2 per page with pagination)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(2);

  // OffCanvas Drawer states
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [vendorType, setVendorType] = useState<"Car Vendor" | "Lease Member" | "Both">("Car Vendor");
  const [paymentMode, setPaymentMode] = useState<"Trip wise" | "Daily" | "Monthly">("Trip wise");
  const [amount, setAmount] = useState("");
  const [isActive, setIsActive] = useState(true);

  // View Details Drawer states (Tabs: General | Vehicles | Financial)
  const [viewingVendor, setViewingVendor] = useState<CarVendorItem | null>(null);
  const [viewTab, setViewTab] = useState<"general" | "vehicles" | "financial">("general");
  const [attachedVehicles, setAttachedVehicles] = useState<AttachedVehicleItem[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vendorBookings, setVendorBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Delete modal state
  const [deletingVendor, setDeletingVendor] = useState<CarVendorItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Real-time Firestore Listener with requested limit
  useEffect(() => {
    try {
      // Query limit dynamically scales with requested page size
      const fetchLimit = Math.max(pageSize, currentPage * pageSize * 2);
      const q = query(
        collection(db, "car_vendors"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: CarVendorItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CarVendorItem, "id">),
          }));
          setVendors(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore car_vendors query error:", error);
          // Fallback query without orderBy in case index is pending
          const fallbackQ = query(collection(db, "car_vendors"), limit(fetchLimit));
          const subFallback = onSnapshot(fallbackQ, (snapshot) => {
            const items: CarVendorItem[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<CarVendorItem, "id">),
            }));
            setVendors(items);
            setLoading(false);
          });
          return () => subFallback();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize car_vendors listener:", err);
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  // Load attached fleet vehicles and bookings when viewing vendor
  useEffect(() => {
    if (!viewingVendor) {
      setAttachedVehicles([]);
      setVendorBookings([]);
      return;
    }

    const fetchVendorFleetAndBookings = async () => {
      setLoadingVehicles(true);
      setLoadingBookings(true);
      try {
        // 1. Fetch all vehicles belonging to this vendor
        const vehSnap = await getDocs(collection(db, "vehicles"));
        const vList: AttachedVehicleItem[] = [];
        const vendorVehicleIds = new Set<string>();
        const vendorVehicleRegs = new Set<string>();

        vehSnap.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const matchesId = d.vendorId && d.vendorId === viewingVendor.id;
          const matchesName =
            d.vendorName &&
            d.vendorName.trim().toLowerCase() === viewingVendor.name.trim().toLowerCase();

          if (matchesId || matchesName) {
            vList.push({
              id: docSnap.id,
              regNumber: d.regNumber || "—",
              vehicleName: d.vehicleName || `${d.manufacturer || ""} ${d.model || ""}`.trim() || "Vehicle",
              category: d.category || "General",
              seatingCapacity: d.seatingCapacity,
              fuelType: d.fuelType,
              ownershipType: d.ownershipType || "Vendor Attached",
              isActive: d.isActive !== false,
            });
            vendorVehicleIds.add(docSnap.id);
            if (d.regNumber) {
              vendorVehicleRegs.add(d.regNumber.trim().toUpperCase());
            }
          }
        });
        setAttachedVehicles(vList);
        setLoadingVehicles(false);

        // 2. Fetch all bookings related to this vendor's vehicles or vendor
        const bookSnap = await getDocs(collection(db, "bookings"));
        const bList: any[] = [];

        bookSnap.docs.forEach((docSnap) => {
          const b = docSnap.data();
          const matchesVehId = b.vehicleId && vendorVehicleIds.has(b.vehicleId);
          const matchesReg =
            b.vehicleRegNumber && vendorVehicleRegs.has(b.vehicleRegNumber.trim().toUpperCase());
          const matchesVenId = b.vendorId && b.vendorId === viewingVendor.id;
          const matchesVenName =
            b.vendorName &&
            b.vendorName.trim().toLowerCase() === viewingVendor.name.trim().toLowerCase();

          if (matchesVehId || matchesReg || matchesVenId || matchesVenName) {
            bList.push({
              id: docSnap.id,
              ...b,
            });
          }
        });

        // Sort bookings by date descending
        bList.sort((a, b) => {
          const dateA = new Date(a.startDate || a.createdAt?.toDate?.() || 0).getTime();
          const dateB = new Date(b.startDate || b.createdAt?.toDate?.() || 0).getTime();
          return dateB - dateA;
        });

        setVendorBookings(bList);
      } catch (err) {
        console.error("Error fetching vendor fleet & bookings:", err);
      } finally {
        setLoadingVehicles(false);
        setLoadingBookings(false);
      }
    };

    fetchVendorFleetAndBookings();
  }, [viewingVendor]);

  // Last 12 months for month-wise filter tab
  const availableMonths = useMemo(() => {
    const list: { key: string; label: string; year: number; month: number }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      list.push({ key, label, year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return list;
  }, []);

  // Filter bookings for the selected month
  const monthBookings = useMemo(() => {
    if (!selectedMonth) return vendorBookings;
    return vendorBookings.filter((b) => {
      const start = b.startDate ? String(b.startDate) : "";
      if (start.startsWith(selectedMonth)) return true;
      const end = b.endDate ? String(b.endDate) : "";
      if (end.startsWith(selectedMonth)) return true;
      if (b.createdAt?.toDate) {
        const cDate = b.createdAt.toDate().toISOString();
        if (cDate.startsWith(selectedMonth)) return true;
      }
      return false;
    });
  }, [vendorBookings, selectedMonth]);

  // Financial calculations based on paymentMode
  const financialSummary = useMemo(() => {
    if (!viewingVendor) {
      return {
        paymentMode: "Trip wise",
        unitRate: 0,
        totalPayable: 0,
        totalTrips: 0,
        totalDutyDays: 0,
        activeVehiclesCount: 0,
        formulaText: "",
      };
    }

    const mode = viewingVendor.paymentMode || "Trip wise";
    const unitRate = Number(viewingVendor.amount) || 0;
    const totalTrips = monthBookings.length;

    // Distinct vehicles deployed in this month
    const activeVehicles = new Set(
      monthBookings.map((b) => b.vehicleRegNumber || b.vehicleId).filter(Boolean)
    );
    const activeVehiclesCount = activeVehicles.size;

    // Sum of duty days across trips
    const totalDutyDays = monthBookings.reduce((acc, b) => {
      const days = Math.max(1, Math.round(Number(b.totalDays) || 1));
      return acc + days;
    }, 0);

    let totalPayable = 0;
    let formulaText = "";

    if (mode === "Monthly") {
      // Monthly fixed contract
      totalPayable = unitRate;
      formulaText = `Fixed Monthly Plan: ₹${unitRate.toLocaleString("en-IN")}`;
    } else if (mode === "Daily") {
      // Daily rate * total duty days
      totalPayable = totalDutyDays * unitRate;
      formulaText = `${totalDutyDays} duty day${totalDutyDays === 1 ? "" : "s"} × ₹${unitRate.toLocaleString("en-IN")}/day`;
    } else {
      // Trip wise: trips count * trip rate
      totalPayable = totalTrips * unitRate;
      formulaText = `${totalTrips} trip${totalTrips === 1 ? "" : "s"} × ₹${unitRate.toLocaleString("en-IN")}/trip`;
    }

    return {
      paymentMode: mode,
      unitRate,
      totalPayable,
      totalTrips,
      totalDutyDays,
      activeVehiclesCount,
      formulaText,
    };
  }, [viewingVendor, monthBookings]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  // Open Drawer in Add Mode
  const handleOpenAddDrawer = () => {
    setEditingVendorId(null);
    setName("");
    setMobile("");
    setEmail("");
    setCity("");
    setAddress("");
    setVendorType("Car Vendor");
    setPaymentMode("Trip wise");
    setAmount("");
    setIsActive(true);
    setFormError(null);
    setIsOffCanvasOpen(true);
  };

  // Open Drawer in Edit Mode
  const handleOpenEditDrawer = (vendor: CarVendorItem) => {
    setEditingVendorId(vendor.id);
    setName(vendor.name || "");
    setMobile(vendor.mobile || "");
    setEmail(vendor.email || "");
    setCity(vendor.city || "");
    setAddress(vendor.address || "");
    setVendorType((vendor.vendorType as any) || "Car Vendor");
    setPaymentMode((vendor.paymentMode as any) || "Trip wise");
    setAmount(
      vendor.amount !== undefined && vendor.amount !== null && vendor.amount !== ""
        ? String(vendor.amount)
        : ""
    );
    setIsActive(vendor.isActive !== false);
    setFormError(null);
    setIsOffCanvasOpen(true);
  };

  // Copy phone number helper
  const handleCopyPhone = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save / Update Vendor Handler
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!name.trim()) {
      setFormError("Please enter vendor / lease member name.");
      return;
    }
    if (!mobile.trim()) {
      setFormError("Please enter mobile phone number.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        mobile: mobile.trim(),
        email: email.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        vendorType,
        paymentMode,
        amount: amount.trim() ? Number(amount.trim()) : null,
        isActive,
        updatedAt: serverTimestamp(),
      };

      if (editingVendorId) {
        await updateDoc(doc(db, "car_vendors", editingVendorId), payload);
        setFeedback({
          type: "success",
          message: `Vendor "${payload.name}" updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "car_vendors"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Vendor "${payload.name}" added successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      console.error("Error saving vendor:", err);
      const msg = err instanceof Error ? err.message : "Failed to save vendor.";
      setFormError(msg);
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Vendor Handler
  const handleConfirmDelete = async () => {
    if (!deletingVendor) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "car_vendors", deletingVendor.id));
      setFeedback({
        type: "success",
        message: `Vendor "${deletingVendor.name}" removed from directory.`,
      });
      setDeletingVendor(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting vendor:", err);
      setFeedback({ type: "error", message: "Failed to delete vendor." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Vendors
  const filteredVendors = vendors.filter((v) => {
    const matchesSearch =
      searchQuery === "" ||
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mobile.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.city && v.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.email && v.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.address && v.address.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
        ? v.isActive !== false
        : v.isActive === false;

    return matchesSearch && matchesStatus;
  });

  // Pagination calculation (2 per page by default)
  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredVendors.length);
  const paginatedVendors = filteredVendors.slice(startIndex, endIndex);

  // Statistics
  const totalCount = vendors.length;
  const activeCount = vendors.filter((v) => v.isActive !== false).length;
  const uniqueCities = Array.from(
    new Set(vendors.map((v) => v.city).filter(Boolean))
  ).length;

  return (
    <div className="space-y-4">
      {/* Feedback Notification */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center gap-2 p-3 rounded-[6px] border text-xs font-normal transition-all duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center text-[#f16623]">
              <Briefcase className="w-4 h-4" />
            </div>
            <h1 className="text-base font-medium text-slate-900 tracking-tight">
              Car Vendors & Lease Members
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5 ml-9">
            Manage car attachment vendors, agency lessors, contact records, and active fleet allocations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/vehicles"
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <Car className="w-3.5 h-3.5 text-slate-500" />
            <span>View Fleet</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Vendor / Member</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Total Registered</span>
            <span className="text-base font-semibold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Active Members</span>
            <span className="text-base font-semibold text-emerald-600">{activeCount}</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Cities Covered</span>
            <span className="text-base font-semibold text-slate-900">{uniqueCities}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Search & Filters Bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, mobile, city..."
              className="w-full h-[32px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <div className="w-36">
              <SearchableSelect
                options={[
                  { value: "ALL", label: "All Status" },
                  { value: "ACTIVE", label: "Active Only", badge: "Active", badgeColor: "green" },
                  { value: "INACTIVE", label: "Inactive Only", badge: "Inactive", badgeColor: "slate" },
                ]}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as any)}
                placeholder="Filter status..."
              />
            </div>

            {/* Rows Per Page Toggle */}
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
              <span className="hidden sm:inline">Per page:</span>
              <div className="w-20">
                <SearchableSelect
                  options={[
                    { value: "2", label: "2" },
                    { value: "5", label: "5" },
                    { value: "10", label: "10" },
                    { value: "24", label: "24" },
                  ]}
                  value={String(pageSize)}
                  onChange={(val) => setPageSize(Number(val))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading vendors from Firestore...</span>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
              <Briefcase className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery || statusFilter !== "ALL"
                ? "No matching vendors found"
                : "No car vendors or lease members registered yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different name, mobile number, or city."
                : "Add your first attached car vendor or leasing partner to select them during vehicle creation."}
            </p>
            <div className="mt-3.5">
              <button
                type="button"
                onClick={handleOpenAddDrawer}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vendor / Member</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Vendor / Member Name</th>
                  <th className="py-2.5 px-3">Mobile Contact</th>
                  <th className="py-2.5 px-3">Payment Terms</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">City & Location</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedVendors.map((vendor, idx) => (
                  <tr
                    key={vendor.id}
                    onClick={() => {
                      setViewingVendor(vendor);
                      setViewTab("general");
                    }}
                    className="hover:bg-orange-50/40 transition-colors group cursor-pointer"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                      {startIndex + idx + 1}
                    </td>

                    {/* Name & Type */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[4px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs shrink-0 group-hover:border-[#f16623]/30 group-hover:text-[#f16623]">
                          {vendor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 group-hover:text-[#f16623] block leading-tight text-xs transition-colors">
                            {vendor.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {vendor.vendorType || "Car Vendor"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Mobile Number with Copy */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`tel:${vendor.mobile}`}
                          className="font-mono text-slate-800 hover:text-[#f16623] transition-colors font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{vendor.mobile}</span>
                        </a>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPhone(vendor.mobile, vendor.id);
                          }}
                          className="text-slate-400 hover:text-slate-700 transition cursor-pointer p-0.5 rounded hover:bg-slate-100"
                          title="Copy phone number"
                        >
                          {copiedId === vendor.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Payment Terms */}
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-800 block text-xs">
                        {vendor.amount !== undefined && vendor.amount !== null && vendor.amount !== ""
                          ? `₹${Number(vendor.amount).toLocaleString("en-IN")}`
                          : "—"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal block mt-0.5">
                        {vendor.paymentMode || "Trip wise"}
                      </span>
                    </td>

                    {/* Email */}
                    <td className="py-2.5 px-3">
                      {vendor.email ? (
                        <a
                          href={`mailto:${vendor.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-600 hover:text-[#f16623] inline-flex items-center gap-1 text-[11px] font-normal cursor-pointer"
                        >
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{vendor.email}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>

                    {/* City & Address */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-slate-700 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-medium">{vendor.city || "—"}</span>
                      </div>
                      {vendor.address && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-xs mt-0.5">
                          {vendor.address}
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          vendor.isActive !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            vendor.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {vendor.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingVendor(vendor);
                            setViewTab("general");
                          }}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-[#f16623] hover:bg-orange-50 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(vendor)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="Edit Vendor"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingVendor(vendor)}
                          className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar (Default limit: 2 per page) */}
        {filteredVendors.length > 0 && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Showing <span className="font-medium text-slate-800">{startIndex + 1}</span> to{" "}
                <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                <span className="font-medium text-slate-800">{filteredVendors.length}</span> vendors
              </span>
              <span className="text-[10px] text-[#f16623] bg-orange-50 border border-[#f16623]/30 px-1.5 py-0.5 rounded font-mono font-medium">
                {pageSize} per page
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage <= 1}
                className="h-[28px] px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-normal inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  if (
                    totalPages > 7 &&
                    pageNum !== 1 &&
                    pageNum !== totalPages &&
                    Math.abs(pageNum - validCurrentPage) > 1
                  ) {
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return (
                        <span key={pageNum} className="px-1 text-slate-400 text-[10px]">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  const isCurrent = pageNum === validCurrentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-[28px] min-w-[28px] px-2 rounded-[4px] text-[11px] font-medium transition cursor-pointer ${
                        isCurrent
                          ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, Math.min(totalPages, p + 1)))}
                disabled={validCurrentPage >= totalPages}
                className="h-[28px] px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-[11px] font-normal inline-flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* OffCanvas Drawer for Add & Edit */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title={editingVendorId ? "Edit Vendor / Lease Member" : "Add New Car Vendor / Lease Member"}
        subtitle="Save vendor records to assign them when registering attached or leased vehicles."
        size="md"
      >
        <form onSubmit={handleSaveVendor} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium block">Validation Error</span>
                <span className="font-normal">{formError}</span>
              </div>
            </div>
          )}

          {/* Vendor Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Vendor / Member Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sri Balaji Travels / Ramesh Kumar"
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
            />
          </div>

          {/* Mobile Number & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mobile Number <span className="text-[#f16623]">*</span>
              </label>
              <input
                type="tel"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. vendor@example.com"
                className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
            </div>
          </div>

          {/* City & Vendor Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                City <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Hyderabad, Vijayawada"
                className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor Type
              </label>
              <SearchableSelect
                options={[
                  { value: "Car Vendor", label: "Attached Car Vendor" },
                  { value: "Lease Member", label: "Lease Member / Partner" },
                  { value: "Both", label: "Both Attached & Lease" },
                ]}
                value={vendorType}
                onChange={(val) => setVendorType(val as any)}
                placeholder="Select Vendor Type..."
              />
            </div>
          </div>

          {/* Payment Mode & Amount in Rupees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Mode <span className="text-[#f16623]">*</span>
              </label>
              <SearchableSelect
                options={[
                  { value: "Trip wise", label: "Trip wise" },
                  { value: "Daily", label: "Daily" },
                  { value: "Monthly", label: "Monthly" },
                ]}
                value={paymentMode}
                onChange={(val) => setPaymentMode(val as any)}
                placeholder="Select Payment Mode..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount (in ₹ Rupees) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full h-[34px] max-h-[34px] pl-7 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Address / Operational Base <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot No 42, Pillar 125, Mehdipatnam, Hyderabad"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
            />
          </div>

          {/* Active / Inactive Status Toggle */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-700 block">Vendor Status</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Active vendors can be linked to vehicles in the fleet.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                isActive ? "bg-[#f16623]" : "bg-slate-300"
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Drawer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingVendorId ? "Update Vendor" : "Save Vendor"}</span>
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* OffCanvas Drawer for View Details (Tab-based: General | Vehicles | Financial) */}
      <OffCanvas
        isOpen={Boolean(viewingVendor)}
        onClose={() => setViewingVendor(null)}
        title={viewingVendor?.name || "Vendor Details"}
        subtitle={`Vendor Profile, Attached Fleet & Financial Payouts • ${viewingVendor?.vendorType || "Car Vendor"}`}
        size="2xl"
        widthClassName="max-w-3xl sm:max-w-4xl lg:max-w-5xl"
      >
        {viewingVendor && (
          <div className="space-y-4">
            {/* Top Vendor Mini Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623] font-bold text-sm shrink-0">
                  {viewingVendor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 leading-tight">
                      {viewingVendor.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        viewingVendor.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          viewingVendor.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                      {viewingVendor.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {viewingVendor.vendorType || "Car Vendor"} • Base: {viewingVendor.city || "—"}
                  </span>
                </div>
              </div>

              {/* Quick Contact & Action Buttons */}
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${viewingVendor.mobile}`}
                  className="h-[30px] px-2.5 rounded-[6px] bg-white border border-slate-200 text-slate-700 hover:text-[#f16623] hover:border-[#f16623]/30 inline-flex items-center gap-1.5 text-xs font-mono transition cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#f16623]" />
                  <span>{viewingVendor.mobile}</span>
                </a>

                {viewingVendor.email && (
                  <a
                    href={`mailto:${viewingVendor.email}`}
                    className="h-[30px] px-2.5 rounded-[6px] bg-white border border-slate-200 text-slate-700 hover:text-blue-600 inline-flex items-center gap-1.5 text-xs transition cursor-pointer"
                    title={viewingVendor.email}
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span className="hidden sm:inline text-[11px] truncate max-w-[120px]">
                      {viewingVendor.email}
                    </span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const target = viewingVendor;
                    setViewingVendor(null);
                    handleOpenEditDrawer(target);
                  }}
                  className="h-[30px] px-2.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1 hover:bg-[#d95318] transition cursor-pointer shadow-xs shadow-[#f16623]/25"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit</span>
                </button>
              </div>
            </div>

            {/* TAB NAVIGATION HEADER (Active: bg-orange-50 text-[#f16623], no underline) */}
            <div className="flex items-center gap-1 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setViewTab("general")}
                className={`px-3.5 py-1.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                  viewTab === "general"
                    ? "bg-orange-50 text-[#f16623]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>General</span>
              </button>

              <button
                type="button"
                onClick={() => setViewTab("vehicles")}
                className={`px-3.5 py-1.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                  viewTab === "vehicles"
                    ? "bg-orange-50 text-[#f16623]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Vehicles</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    viewTab === "vehicles" ? "bg-[#f16623] text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {attachedVehicles.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewTab("financial")}
                className={`px-3.5 py-1.5 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer ${
                  viewTab === "financial"
                    ? "bg-orange-50 text-[#f16623]"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>Financial</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    viewTab === "financial" ? "bg-[#f16623] text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {financialSummary.totalTrips > 0
                    ? `₹${financialSummary.totalPayable.toLocaleString("en-IN")}`
                    : "0 Trips"}
                </span>
              </button>
            </div>

            {/* TAB 1: GENERAL DETAILS */}
            {viewTab === "general" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                {/* Profile Grid */}
                <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 space-y-3">
                  <span className="text-xs font-medium text-slate-800 block border-b border-slate-100 pb-1.5">
                    Vendor Contact & Registration Profile
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Legal / Trade Name</span>
                      <span className="font-medium text-slate-800 text-xs">{viewingVendor.name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Vendor Category</span>
                      <span className="font-medium text-slate-800 text-xs">{viewingVendor.vendorType || "Car Vendor"}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Primary Mobile Number</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="font-mono font-medium text-slate-800">{viewingVendor.mobile}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyPhone(viewingVendor.mobile, `view-${viewingVendor.id}`)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedId === `view-${viewingVendor.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Official Email</span>
                      <span className="font-medium text-slate-800 text-xs">{viewingVendor.email || "—"}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Operational City</span>
                      <span className="font-medium text-slate-800 text-xs">{viewingVendor.city || "Not Specified"}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-normal">Account Status</span>
                      <span className="font-medium text-slate-800 text-xs">
                        {viewingVendor.isActive !== false ? "Active & Verified" : "Inactive"}
                      </span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-[10px] text-slate-400 block font-normal">Base Office Address</span>
                      <p className="font-normal text-slate-700 text-xs mt-0.5">
                        {viewingVendor.address || "No office address recorded."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Payment Plan & Compensation Terms */}
                <div className="bg-white border border-slate-200 rounded-[6px] p-3.5 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#f16623]" />
                      <span className="text-xs font-medium text-slate-800">
                        Configured Payment Terms
                      </span>
                    </div>
                    <span className="text-[11px] text-[#f16623] font-medium">
                      {viewingVendor.paymentMode || "Trip wise"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-normal">Agreed Rate / Base Amount</span>
                      <span className="text-base font-semibold text-[#f16623]">
                        {viewingVendor.amount
                          ? `₹${Number(viewingVendor.amount).toLocaleString("en-IN")}`
                          : "Not Configured (₹0)"}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {viewingVendor.paymentMode === "Monthly"
                          ? "Per month fixed contract payout"
                          : viewingVendor.paymentMode === "Daily"
                          ? "Per operational duty day deployed"
                          : "Per completed trip assignment"}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-normal">Payout Settlement Type</span>
                      <span className="font-medium text-slate-800 text-xs mt-0.5 block">
                        {viewingVendor.paymentMode === "Monthly"
                          ? "Monthly Retainer Settlement"
                          : viewingVendor.paymentMode === "Daily"
                          ? "Daily Deployed Days Payout"
                          : "Trip-by-Trip Payout"}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Settled via accounts voucher ledger. View detailed monthly payouts in the Financial tab.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fleet & Lifetime Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-normal">Attached Fleet</span>
                    <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                      {attachedVehicles.length} Vehicles
                    </span>
                  </div>

                  <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-normal">Lifetime Bookings</span>
                    <span className="text-sm font-semibold text-slate-900 mt-0.5 block">
                      {vendorBookings.length} Trips
                    </span>
                  </div>

                  <div className="col-span-2 sm:col-span-1 p-3 rounded-[6px] bg-orange-50/70 border border-[#f16623]/25">
                    <span className="text-[10px] text-slate-500 block font-normal">Current Month Payout</span>
                    <span className="text-sm font-semibold text-[#f16623] mt-0.5 block">
                      ₹{financialSummary.totalPayable.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ATTACHED VEHICLES */}
            {viewTab === "vehicles" && (
              <div className="space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1">
                  <div>
                    <span className="text-xs font-medium text-slate-800 block">
                      Vehicles Assigned to this Vendor ({attachedVehicles.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Cars currently registered with vendor name "{viewingVendor.name}".
                    </span>
                  </div>
                  <Link
                    href="/vehicles"
                    className="text-xs text-[#f16623] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <span>Open Fleet Directory</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                {loadingVehicles ? (
                  <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#f16623]" />
                    <span className="text-xs font-normal">Loading attached fleet...</span>
                  </div>
                ) : attachedVehicles.length === 0 ? (
                  <div className="py-10 px-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[6px] space-y-2">
                    <Car className="w-7 h-7 text-slate-300 mx-auto" />
                    <h5 className="text-xs font-medium text-slate-700">No Vehicles Attached Yet</h5>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto font-normal">
                      When adding or editing vehicles in the Fleet page, set Ownership to "Vendor Attached" or "Leased" and select "{viewingVendor.name}".
                    </p>
                    <Link
                      href="/vehicles"
                      className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Vehicle to Fleet</span>
                    </Link>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-[6px] overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                          <th className="py-2 px-3">Reg. Number</th>
                          <th className="py-2 px-3">Vehicle / Model</th>
                          <th className="py-2 px-3">Category</th>
                          <th className="py-2 px-3">Fuel & Seats</th>
                          <th className="py-2 px-3">Ownership</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {attachedVehicles.map((veh) => (
                          <tr key={veh.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                {veh.regNumber}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-medium text-slate-800 block text-xs">
                                {veh.vehicleName}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-slate-600 text-xs">{veh.category}</span>
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500">
                              {veh.fuelType || "—"} • {veh.seatingCapacity || "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {veh.ownershipType || "Vendor Attached"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  veh.isActive !== false
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {veh.isActive !== false ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FINANCIAL (MONTH-WISE FILTERS & ACCURATE PAYOUT CALCULATIONS) */}
            {viewTab === "financial" && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                {/* Month-wise Filter Tabs Header */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-[#f16623]" />
                      <span>Select Billing / Payout Month</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Showing trips deployed in selected month
                    </span>
                  </div>

                  {/* Horizontal Scrollable Month Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {availableMonths.map((m) => {
                      const isSelected = selectedMonth === m.key;
                      // Count trips in this month
                      const count = vendorBookings.filter((b) => {
                        const start = b.startDate ? String(b.startDate) : "";
                        if (start.startsWith(m.key)) return true;
                        const end = b.endDate ? String(b.endDate) : "";
                        if (end.startsWith(m.key)) return true;
                        if (b.createdAt?.toDate) {
                          return b.createdAt.toDate().toISOString().startsWith(m.key);
                        }
                        return false;
                      }).length;

                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setSelectedMonth(m.key)}
                          className={`px-3 py-1.5 rounded-[6px] text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                          }`}
                        >
                          <span>{m.label}</span>
                          <span
                            className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : count > 0
                                ? "bg-slate-200 text-slate-700"
                                : "text-slate-400"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* KPI Financial Breakdown Banner */}
                <div className="p-4 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/40 border border-[#f16623]/20 rounded-[8px] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                        Net Amount Payable to Vendor ({availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth})
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">
                          ₹{financialSummary.totalPayable.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs font-normal text-slate-500">
                          {financialSummary.formulaText}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <div className="px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 text-right shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">Terms Mode</span>
                        <span className="text-xs font-semibold text-[#f16623]">
                          {financialSummary.paymentMode}
                        </span>
                      </div>

                      <div className="px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 text-right shadow-2xs">
                        <span className="text-[10px] text-slate-400 block font-normal">Agreed Rate</span>
                        <span className="text-xs font-semibold text-slate-800">
                          {financialSummary.unitRate ? `₹${financialSummary.unitRate.toLocaleString("en-IN")}` : "₹0"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Deployments in Month</span>
                      <span className="font-semibold text-slate-800">
                        {financialSummary.totalTrips} Booking{financialSummary.totalTrips === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Duty Days</span>
                      <span className="font-semibold text-slate-800">
                        {financialSummary.totalDutyDays} Day{financialSummary.totalDutyDays === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Active Vehicles</span>
                      <span className="font-semibold text-slate-800">
                        {financialSummary.activeVehiclesCount} Car{financialSummary.activeVehiclesCount === 1 ? "" : "s"} Deployed
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block">Calculation Method</span>
                      <span className="font-semibold text-slate-800">
                        {financialSummary.paymentMode === "Monthly"
                          ? "Fixed Retainer Fee"
                          : financialSummary.paymentMode === "Daily"
                          ? "Duty Days × Daily Rate"
                          : "Trips × Per-Trip Rate"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trips / Bookings Table for this Month */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-800">
                      Deployed Trip Bookings in Month ({monthBookings.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Detailed trip assignments & vendor cost breakdown
                    </span>
                  </div>

                  {loadingBookings ? (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#f16623]" />
                      <span className="text-xs font-normal">Calculating month trips...</span>
                    </div>
                  ) : monthBookings.length === 0 ? (
                    <div className="py-8 px-4 text-center bg-slate-50 border border-slate-200/80 rounded-[6px] space-y-1.5">
                      <Receipt className="w-6 h-6 text-slate-300 mx-auto" />
                      <h5 className="text-xs font-medium text-slate-700">
                        No Bookings in {availableMonths.find((m) => m.key === selectedMonth)?.label || selectedMonth}
                      </h5>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto font-normal">
                        {financialSummary.paymentMode === "Monthly"
                          ? `No trips were logged for this vendor's fleet during this month, but the fixed monthly retainer of ₹${financialSummary.unitRate.toLocaleString("en-IN")} remains applicable.`
                          : `No trips were allocated to this vendor's vehicles during this month. Total payable is ₹0.`}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-[6px] overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                            <th className="py-2 px-3">Booking #</th>
                            <th className="py-2 px-3">Trip Dates</th>
                            <th className="py-2 px-3">Route (From - To)</th>
                            <th className="py-2 px-3">Vehicle Assigned</th>
                            <th className="py-2 px-3">Client / Traveler</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Vendor Payout</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {monthBookings.map((b) => {
                            const days = Math.max(1, Math.round(Number(b.totalDays) || 1));
                            let tripPayoutText = "";
                            let tripAmount = 0;

                            if (financialSummary.paymentMode === "Monthly") {
                              tripPayoutText = "Covered under Monthly Plan";
                              tripAmount = 0;
                            } else if (financialSummary.paymentMode === "Daily") {
                              tripAmount = days * financialSummary.unitRate;
                              tripPayoutText = `${days}d × ₹${financialSummary.unitRate.toLocaleString("en-IN")}`;
                            } else {
                              tripAmount = financialSummary.unitRate;
                              tripPayoutText = `1 trip × ₹${financialSummary.unitRate.toLocaleString("en-IN")}`;
                            }

                            return (
                              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-medium text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {b.bookingNumber || b.id.slice(0, 8)}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className="font-medium text-slate-800 block text-xs">
                                    {b.startDate || "—"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    {days} Duty Day{days === 1 ? "" : "s"}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className="font-medium text-slate-800 block text-xs truncate max-w-[150px]">
                                    {b.fromLocation || "—"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                                    → {b.toLocation || "—"}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className="font-mono font-medium text-slate-900 text-xs block">
                                    {b.vehicleRegNumber || "—"}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                                    {b.vehicleName || "Vehicle"}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className="text-slate-800 font-medium block text-xs">
                                    {b.customerName || b.travelerName || "—"}
                                  </span>
                                  {b.travelerMobile && (
                                    <span className="text-[10px] text-slate-400 block font-mono">
                                      {b.travelerMobile}
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                    {b.bookingStatus || "Confirmed"}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right">
                                  {financialSummary.paymentMode === "Monthly" ? (
                                    <span className="text-[10px] text-slate-500 font-medium bg-orange-50 border border-[#f16623]/25 text-[#f16623] px-1.5 py-0.5 rounded">
                                      Monthly Retainer
                                    </span>
                                  ) : (
                                    <div>
                                      <span className="font-semibold text-slate-900 text-xs block">
                                        ₹{tripAmount.toLocaleString("en-IN")}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block font-normal">
                                        {tripPayoutText}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-medium text-xs">
                          <tr>
                            <td colSpan={6} className="py-2.5 px-3 text-right text-slate-600">
                              Total Month Payable to Vendor ({financialSummary.paymentMode}):
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 text-sm">
                              ₹{financialSummary.totalPayable.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-normal">
                Vendor ID: <span className="font-mono text-slate-600">{viewingVendor.id}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingVendor(null)}
                  className="h-[32px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingVendor;
                    setViewingVendor(null);
                    handleOpenEditDrawer(target);
                  }}
                  className="h-[32px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1 hover:bg-[#d95318] transition cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Vendor</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* Delete Confirmation Modal */}
      {deletingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-900">Delete Vendor Record?</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 font-medium">{deletingVendor.name}</strong>?
              This will remove them from the vendor directory. Attached vehicles will retain their vendor name.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingVendor(null)}
                className="h-[32px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="h-[32px] px-3.5 rounded-[6px] bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-rose-700 transition cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
