"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Tags,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  Car,
  Snowflake,
  Wind,
  Users,
  Info,
  Check,
  ChevronRight,
  ChevronLeft,
  Eye,
  Copy,
  Printer,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Filter,
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
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";

export interface VehicleCategoryItem {
  id: string;
  categoryName: string;
  passengerCapacity: number;
  driverCount: number;
  totalCapacity: number;
  acType: "AC" | "Non-AC";
  printName: string;
  isActive: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

// Starter seed categories in case Firestore collection is empty
const DEFAULT_SEED_CATEGORIES: Omit<VehicleCategoryItem, "id" | "createdAt" | "updatedAt">[] = [
  {
    categoryName: "Sedan",
    passengerCapacity: 4,
    driverCount: 1,
    totalCapacity: 5,
    acType: "AC",
    printName: "SEDAN AC (4+1)",
    isActive: true,
  },
  {
    categoryName: "SUV",
    passengerCapacity: 6,
    driverCount: 1,
    totalCapacity: 7,
    acType: "AC",
    printName: "SUV AC (6+1)",
    isActive: true,
  },
  {
    categoryName: "Luxury SUV",
    passengerCapacity: 7,
    driverCount: 1,
    totalCapacity: 8,
    acType: "AC",
    printName: "INNOVA CRYSTA AC (7+1)",
    isActive: true,
  },
  {
    categoryName: "Tempo Traveller",
    passengerCapacity: 12,
    driverCount: 1,
    totalCapacity: 13,
    acType: "AC",
    printName: "TEMPO TRAVELLER (12+1)",
    isActive: true,
  },
  {
    categoryName: "Hatchback",
    passengerCapacity: 4,
    driverCount: 1,
    totalCapacity: 5,
    acType: "Non-AC",
    printName: "HATCHBACK NON-AC (4+1)",
    isActive: true,
  },
];

export default function VehicleCategoriesPage() {
  const [categories, setCategories] = useState<VehicleCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [filterAc, setFilterAc] = useState<"ALL" | "AC" | "Non-AC">("ALL");

  // OffCanvas Drawer states
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VehicleCategoryItem | null>(null);

  // Viewing details drawer state
  const [viewingCategory, setViewingCategory] = useState<VehicleCategoryItem | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Pagination state (limit 24 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // Form states
  const [categoryName, setCategoryName] = useState("");
  const [seatingCapacityInput, setSeatingCapacityInput] = useState<string>("");
  const [acType, setAcType] = useState<"AC" | "Non-AC">("AC");
  const [printName, setPrintName] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Submission & feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Delete modal confirmation
  const [deletingCategory, setDeletingCategory] = useState<VehicleCategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Calculated seating helper: passenger count + 1 driver (starts empty without inbuilt number)
  const parsedPassengerCount = parseInt(seatingCapacityInput, 10);
  const hasValidPassengerCount = !isNaN(parsedPassengerCount) && parsedPassengerCount > 0;
  const calculatedTotalCount = hasValidPassengerCount ? parsedPassengerCount + 1 : null;

  // Real-time Firestore listener with 24 item fetching limit per page
  useEffect(() => {
    try {
      const fetchLimit = Math.max(24, currentPage * 24);
      const q = query(
        collection(db, "vehicle_categories"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: VehicleCategoryItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const passengerCapacity = Number(data.passengerCapacity) || 4;
            const driverCount = Number(data.driverCount) || 1;
            const totalCapacity = Number(data.totalCapacity) || (passengerCapacity + driverCount);

            return {
              id: docSnap.id,
              categoryName: data.categoryName || "",
              passengerCapacity,
              driverCount,
              totalCapacity,
              acType: data.acType === "Non-AC" ? "Non-AC" : "AC",
              printName: data.printName || data.categoryName || "",
              isActive: typeof data.isActive === "boolean" ? data.isActive : true,
              createdAt: data.createdAt || null,
              updatedAt: data.updatedAt || null,
            };
          });

          setCategories(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore vehicle_categories read error:", error);
          // Fallback query without orderBy in case composite index is building
          const fallbackQuery = query(
            collection(db, "vehicle_categories"),
            limit(fetchLimit)
          );
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: VehicleCategoryItem[] = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              const passengerCapacity = Number(data.passengerCapacity) || 4;
              const driverCount = Number(data.driverCount) || 1;
              const totalCapacity = Number(data.totalCapacity) || (passengerCapacity + driverCount);

              return {
                id: docSnap.id,
                categoryName: data.categoryName || "",
                passengerCapacity,
                driverCount,
                totalCapacity,
                acType: data.acType === "Non-AC" ? "Non-AC" : "AC",
                printName: data.printName || data.categoryName || "",
                isActive: typeof data.isActive === "boolean" ? data.isActive : true,
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
              };
            });
            setCategories(items);
            setLoading(false);
          });
          return () => fallbackUnsub();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize vehicle_categories listener:", err);
      setLoading(false);
    }
  }, [currentPage]);

  // Open drawer for creating a new category
  const handleOpenAddDrawer = () => {
    setEditingCategory(null);
    setCategoryName("");
    setSeatingCapacityInput("");
    setAcType("AC");
    setPrintName("");
    setIsActive(true);
    setFeedback(null);
    setIsOffCanvasOpen(true);
  };

  // Open drawer for editing an existing category
  const handleOpenEditDrawer = (item: VehicleCategoryItem) => {
    setEditingCategory(item);
    setCategoryName(item.categoryName);
    setSeatingCapacityInput(String(item.passengerCapacity));
    setAcType(item.acType);
    setPrintName(item.printName);
    setIsActive(item.isActive);
    setFeedback(null);
    setIsOffCanvasOpen(true);
  };

  // Helper to auto-generate print name
  const handleAutoGeneratePrintName = () => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    const acLabel = acType === "AC" ? "AC" : "NON-AC";
    const capacityLabel = hasValidPassengerCount ? ` (${parsedPassengerCount}+1)` : "";
    setPrintName(`${trimmed.toUpperCase()} ${acLabel}${capacityLabel}`);
  };

  // Quick toggle status directly from the table
  const handleToggleStatus = async (item: VehicleCategoryItem) => {
    try {
      const nextStatus = !item.isActive;
      await updateDoc(doc(db, "vehicle_categories", item.id), {
        isActive: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: "success",
        message: `Category "${item.categoryName}" marked as ${nextStatus ? "Active" : "Inactive"}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Failed to toggle category status:", err);
      setFeedback({
        type: "error",
        message: "Failed to update category status. Please try again.",
      });
    }
  };

  // Form submission (Add or Update)
  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedCategory = categoryName.trim();
    if (!trimmedCategory) {
      setFeedback({ type: "error", message: "Please enter category name." });
      return;
    }

    const passengerCount = parseInt(seatingCapacityInput, 10);
    if (isNaN(passengerCount) || passengerCount < 1) {
      setFeedback({
        type: "error",
        message: "Please enter a valid seating capacity (minimum 1 passenger).",
      });
      return;
    }

    const finalDriverCount = 1;
    const finalTotalCapacity = passengerCount + finalDriverCount;
    const finalPrintName = printName.trim() || trimmedCategory;

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        // Update existing category
        await updateDoc(doc(db, "vehicle_categories", editingCategory.id), {
          categoryName: trimmedCategory,
          passengerCapacity: passengerCount,
          driverCount: finalDriverCount,
          totalCapacity: finalTotalCapacity,
          acType,
          printName: finalPrintName,
          isActive,
          updatedAt: serverTimestamp(),
        });

        setFeedback({
          type: "success",
          message: `Category "${trimmedCategory}" updated successfully!`,
        });
      } else {
        // Create new category
        await addDoc(collection(db, "vehicle_categories"), {
          categoryName: trimmedCategory,
          passengerCapacity: passengerCount,
          driverCount: finalDriverCount,
          totalCapacity: finalTotalCapacity,
          acType,
          printName: finalPrintName,
          isActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setFeedback({
          type: "success",
          message: `Category "${trimmedCategory}" added successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving vehicle category:", err);
      setFeedback({
        type: "error",
        message: "Failed to save vehicle category to Firestore. Check connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete category handler
  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "vehicle_categories", deletingCategory.id));
      setFeedback({
        type: "success",
        message: `Category "${deletingCategory.categoryName}" removed successfully.`,
      });
      setDeletingCategory(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting category:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete category from Firestore.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Seed default categories for easy testing
  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      for (const item of DEFAULT_SEED_CATEGORIES) {
        await addDoc(collection(db, "vehicle_categories"), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      setFeedback({
        type: "success",
        message: "Added 5 default vehicle categories to Firestore!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error seeding default categories:", err);
      setFeedback({
        type: "error",
        message: "Failed to seed default categories.",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered categories
  const filteredCategories = categories.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.categoryName.toLowerCase().includes(q) ||
      item.printName.toLowerCase().includes(q) ||
      item.acType.toLowerCase().includes(q) ||
      `${item.passengerCapacity}+1`.includes(q) ||
      `${item.totalCapacity}`.includes(q);

    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "ACTIVE" && item.isActive) ||
      (filterStatus === "INACTIVE" && !item.isActive);

    const matchesAc =
      filterAc === "ALL" ||
      (filterAc === "AC" && item.acType === "AC") ||
      (filterAc === "Non-AC" && item.acType === "Non-AC");

    return matchesSearch && matchesStatus && matchesAc;
  });

  // Auto-reset current page to 1 whenever filters or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterAc]);

  // Pagination with limit of 24
  const totalFiltered = filteredCategories.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedCategories = filteredCategories.slice(startIndex, endIndex);

  // Metric summaries
  const totalCount = categories.length;
  const activeCount = categories.filter((c) => c.isActive).length;
  const acCount = categories.filter((c) => c.acType === "AC").length;
  const nonAcCount = categories.filter((c) => c.acType === "Non-AC").length;

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center justify-between text-xs text-slate-500 font-normal">
        <div className="flex items-center gap-1.5">
          <Link href="/dashboard" className="hover:text-slate-800 transition">
            Home
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">FLEET & CREW</span>
          <span className="text-slate-300">/</span>
          <span className="text-[#f16623] font-medium">Vehicle Categories</span>
        </div>

        {/* Quick Nav link to Vehicles fleet */}
        <Link
          href="/vehicles"
          className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#f16623] transition"
        >
          <Car className="w-3.5 h-3.5" />
          <span>Go to Vehicles Fleet</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </Link>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Vehicle Categories
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {totalCount} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage category names, seating capacities with auto driver count, AC/Non-AC types & print names
            </p>
          </div>
        </div>

        {/* Header Right Action: Search & Add Category Button */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search category, print name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-2.5 sm:p-3 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Total Categories
            </span>
            <span className="text-lg font-medium text-slate-900 leading-tight">
              {totalCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-[6px] bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <Tags className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Active Categories
            </span>
            <span className="text-lg font-medium text-emerald-600 leading-tight">
              {activeCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-[6px] bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              AC Categories
            </span>
            <span className="text-lg font-medium text-sky-600 leading-tight">
              {acCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-[6px] bg-sky-50 border border-sky-200/60 flex items-center justify-center text-sky-600">
            <Snowflake className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-[6px] border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">
              Non-AC Categories
            </span>
            <span className="text-lg font-medium text-slate-600 leading-tight">
              {nonAcCount}
            </span>
          </div>
          <div className="w-8 h-8 rounded-[6px] bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-600">
            <Wind className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs font-normal border transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Category List Data Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Toolbar with Filters */}
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h2 className="text-xs font-medium text-slate-900">
              Registered Categories
            </h2>
            <span className="text-[11px] text-slate-400 font-normal">
              ({filteredCategories.length} matching)
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Status Filter */}
            <div className="inline-flex rounded-[6px] border border-slate-200 bg-white p-0.5 text-[11px]">
              {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`px-2 py-0.5 rounded-[4px] font-normal transition ${
                    filterStatus === status
                      ? "bg-[#f16623] text-white font-medium shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {status === "ALL" ? "All Status" : status === "ACTIVE" ? "Active" : "Inactive"}
                </button>
              ))}
            </div>

            {/* AC Filter */}
            <div className="inline-flex rounded-[6px] border border-slate-200 bg-white p-0.5 text-[11px]">
              {(["ALL", "AC", "Non-AC"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterAc(mode)}
                  className={`px-2 py-0.5 rounded-[4px] font-normal transition ${
                    filterAc === mode
                      ? "bg-slate-800 text-white font-medium shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode === "ALL" ? "All AC" : mode}
                </button>
              ))}
            </div>

            {/* Seed Defaults helper button when empty */}
            {categories.length === 0 && !loading && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={isSeeding}
                className="h-[26px] px-2 rounded-[4px] border border-[#f16623]/30 bg-orange-50 hover:bg-orange-100 text-[#f16623] text-[11px] font-medium inline-flex items-center gap-1 transition"
              >
                {isSeeding ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>Load Starter Categories</span>
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading categories from Firestore...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
              <Tags className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery || filterStatus !== "ALL" || filterAc !== "ALL"
                ? "No matching categories found"
                : "No vehicle categories yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery || filterStatus !== "ALL" || filterAc !== "ALL"
                ? "Try adjusting your search criteria or resetting filters to see all categories."
                : "Add your first vehicle category to categorize fleet vehicles and automate driver capacity."}
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddDrawer}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>

              {categories.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={isSeeding}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#f16623]" />
                  <span>{isSeeding ? "Adding..." : "Add Common Categories"}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Category Name</th>
                  <th className="py-2.5 px-3">Print Name</th>
                  <th className="py-2.5 px-3">Seating Capacity</th>
                  <th className="py-2.5 px-3">AC Type</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCategories.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                      {startIndex + idx + 1}
                    </td>

                    {/* Category Name */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[4px] bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                          <Car className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block leading-tight">
                            {item.categoryName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            ID: {item.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Print Name */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Printer className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                          {item.printName || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Seating Capacity with Driver breakdown */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/60">
                            <Users className="w-3 h-3 text-amber-700" />
                            <span>{item.passengerCapacity} + {item.driverCount || 1} Driver</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            = {item.totalCapacity} Seater
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {item.passengerCapacity} Passenger{item.passengerCapacity === 1 ? "" : "s"} + 1 Driver
                        </span>
                      </div>
                    </td>

                    {/* AC Type */}
                    <td className="py-2.5 px-3">
                      {item.acType === "AC" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200/80">
                          <Snowflake className="w-3 h-3 text-sky-600" />
                          <span>AC</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Wind className="w-3 h-3 text-slate-500" />
                          <span>Non-AC</span>
                        </span>
                      )}
                    </td>

                    {/* Interactive Active / Inactive Status Toggle */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        title={`Click to mark as ${item.isActive ? "Inactive" : "Active"}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer transition active:scale-95 ${
                          item.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.isActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        <span>{item.isActive ? "Active" : "Inactive"}</span>
                      </button>
                    </td>

                    {/* Action buttons (View, Edit, Delete) */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingCategory(item)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-[#f16623] hover:bg-orange-50 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="View Category Details"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(item)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingCategory(item)}
                          className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete Category"
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

        {/* Pagination Controls (Limit: 24 per page) */}
        {filteredCategories.length > 0 && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Showing <span className="font-medium text-slate-800">{filteredCategories.length === 0 ? 0 : startIndex + 1}</span> to{" "}
                <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                <span className="font-medium text-slate-800">{filteredCategories.length}</span> categories
              </span>
              <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                24 per page
              </span>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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

      {/* Delete Confirmation Modal */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-900">
                  Delete Category?
                </h4>
                <p className="text-[11px] text-slate-500 font-normal">
                  Are you sure you want to delete &ldquo;{deletingCategory.categoryName}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-normal bg-slate-50 p-2.5 rounded-[4px] border border-slate-100">
              This action cannot be undone. Vehicles assigned to this category will keep their current records.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isDeleting}
                className="h-[32px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-[32px] px-3.5 rounded-[6px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium inline-flex items-center gap-1.5 transition"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{isDeleting ? "Deleting..." : "Yes, Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-Side OffCanvas for Adding & Editing Vehicle Category */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title={editingCategory ? "Edit Vehicle Category" : "Add Vehicle Category"}
        subtitle="Configure category name, seating capacity with auto driver, AC & print label"
      >
        <form onSubmit={handleSubmitCategory} className="space-y-4">
          {/* Form Banner Feedback inside drawer */}
          {feedback && (
            <div
              className={`flex items-center gap-2 p-2.5 rounded-[6px] text-xs font-normal border ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* 1. Category Name */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Category Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Sedan, SUV, Tempo Traveller, Luxury Bus"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              The primary category title shown across fleet rosters and booking selectors.
            </p>
          </div>

          {/* 2. Seating Capacity (Excluding Driver) with Auto Driver addition */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Seating Capacity (Passengers) <span className="text-[#f16623]">*</span>
              </label>
              {/* Dynamic total badge */}
              {calculatedTotalCount ? (
                <span className="text-[11px] font-medium text-[#f16623] bg-orange-50 border border-[#f16623]/25 px-1.5 py-0.5 rounded-[4px]">
                  Total: {parsedPassengerCount} + 1 Driver = {calculatedTotalCount} Seats
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-normal">
                  +1 Driver adds automatically
                </span>
              )}
            </div>

            <input
              type="number"
              min="1"
              max="100"
              required
              value={seatingCapacityInput}
              onChange={(e) => setSeatingCapacityInput(e.target.value)}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="Enter passenger count without driver (e.g. 4)"
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />

            {/* MANDATORY MESSAGE REQUESTED BY USER */}
            <div className="mt-1.5 p-2 rounded-[6px] bg-amber-50/80 border border-amber-200/70 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 font-medium leading-snug">
                Add count without driver, driver count will add automatically
              </p>
            </div>
          </div>

          {/* 3. AC or Non AC (Default: AC) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Air Conditioning (AC) <span className="text-[#f16623]">*</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              {/* Option 1: AC */}
              <button
                type="button"
                onClick={() => setAcType("AC")}
                className={`h-[38px] px-3 rounded-[6px] border text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                  acType === "AC"
                    ? "bg-sky-50 border-sky-400 text-sky-800 shadow-xs shadow-sky-500/10"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Snowflake
                  className={`w-3.5 h-3.5 ${
                    acType === "AC" ? "text-sky-600" : "text-slate-400"
                  }`}
                />
                <span>AC (Default)</span>
                {acType === "AC" && (
                  <Check className="w-3.5 h-3.5 text-sky-600 ml-auto" />
                )}
              </button>

              {/* Option 2: Non-AC */}
              <button
                type="button"
                onClick={() => setAcType("Non-AC")}
                className={`h-[38px] px-3 rounded-[6px] border text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer ${
                  acType === "Non-AC"
                    ? "bg-slate-100 border-slate-400 text-slate-900 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Wind
                  className={`w-3.5 h-3.5 ${
                    acType === "Non-AC" ? "text-slate-700" : "text-slate-400"
                  }`}
                />
                <span>Non-AC</span>
                {acType === "Non-AC" && (
                  <Check className="w-3.5 h-3.5 text-slate-700 ml-auto" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Select whether this vehicle category is Air Conditioned or Non-Air Conditioned.
            </p>
          </div>

          {/* 4. Print Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Print Name
              </label>
              <button
                type="button"
                onClick={handleAutoGeneratePrintName}
                disabled={!categoryName.trim()}
                className="text-[10px] text-[#f16623] hover:underline disabled:text-slate-300 inline-flex items-center gap-0.5 cursor-pointer"
              >
                <Sparkles className="w-2.5 h-2.5" />
                <span>Auto-generate</span>
              </button>
            </div>

            <div className="relative">
              <Printer className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="e.g., SEDAN AC (4+1), INNOVA 7+1 AC"
                value={printName}
                onChange={(e) => setPrintName(e.target.value)}
                className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Label displayed on customer invoices, trip sheets, quotes & passenger vouchers.
            </p>
          </div>

          {/* 5. Category Active or Inactive Toggle (Default: Active) */}
          <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-medium text-slate-800 block">
                  Category Status
                </label>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isActive
                    ? "Active: Category is available for vehicle assignment and bookings"
                    : "Inactive: Category is hidden from booking selections"}
                </span>
              </div>

              {/* Toggle switch button */}
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive(!isActive)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-normal">Current State:</span>
              <span
                className={`px-2 py-0.5 rounded-[4px] font-medium text-[10px] ${
                  isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {isActive ? "Active (Default)" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{editingCategory ? "Update Category" : "Save Category"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* Right-Side OffCanvas for Viewing Vehicle Category Details */}
      <OffCanvas
        isOpen={!!viewingCategory}
        onClose={() => setViewingCategory(null)}
        title={viewingCategory?.categoryName || "Category Details"}
        subtitle="Vehicle category specifications, capacity breakdown & print label"
      >
        {viewingCategory && (
          <div className="space-y-4">
            {/* Category Header Card */}
            <div className="p-3.5 bg-slate-50 rounded-[6px] border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623] shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 leading-tight">
                    {viewingCategory.categoryName}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Print: {viewingCategory.printName || viewingCategory.categoryName}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    viewingCategory.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      viewingCategory.isActive ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  <span>{viewingCategory.isActive ? "Active" : "Inactive"}</span>
                </span>

                {viewingCategory.acType === "AC" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-sky-50 text-sky-800 border border-sky-200/80">
                    <Snowflake className="w-2.5 h-2.5 text-sky-600" />
                    <span>AC</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    <Wind className="w-2.5 h-2.5 text-slate-500" />
                    <span>Non-AC</span>
                  </span>
                )}
              </div>
            </div>

            {/* Capacity Breakdown Section */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-800">
                  Seating Capacity Breakdown
                </span>
                <span className="text-xs font-medium text-[#f16623]">
                  {viewingCategory.totalCapacity} Total Seats
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-[6px] border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 uppercase font-medium block">
                    Passengers
                  </span>
                  <span className="text-sm font-medium text-slate-900">
                    {viewingCategory.passengerCapacity}
                  </span>
                </div>
                <div className="p-2 bg-orange-50/60 rounded-[6px] border border-[#f16623]/20">
                  <span className="text-[10px] text-[#f16623] uppercase font-medium block">
                    Driver (Auto)
                  </span>
                  <span className="text-sm font-medium text-[#f16623]">
                    +1
                  </span>
                </div>
                <div className="p-2 bg-amber-50/70 rounded-[6px] border border-amber-200/70">
                  <span className="text-[10px] text-amber-700 uppercase font-medium block">
                    Total Seater
                  </span>
                  <span className="text-sm font-medium text-amber-900">
                    {viewingCategory.totalCapacity}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 font-normal">
                Formula: {viewingCategory.passengerCapacity} Passengers + 1 Driver = {viewingCategory.totalCapacity} Seater
              </p>
            </div>

            {/* Configuration Details Table */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 divide-y divide-slate-100 text-xs">
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-500">Category Name</span>
                <span className="font-medium text-slate-900">{viewingCategory.categoryName}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-500">Print Name</span>
                <span className="font-mono text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                  {viewingCategory.printName || "—"}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-500">Air Conditioning</span>
                <span className="font-medium text-slate-800">{viewingCategory.acType}</span>
              </div>
              <div className="p-3 flex items-center justify-between">
                <span className="text-slate-500">Document ID</span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                  <span>{viewingCategory.id}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingCategory.id);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2000);
                    }}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy ID"
                  >
                    {copiedId ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingCategory(null)}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const cat = viewingCategory;
                  setViewingCategory(null);
                  handleOpenEditDrawer(cat);
                }}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Category</span>
              </button>
            </div>
          </div>
        )}
      </OffCanvas>
    </div>
  );
}
