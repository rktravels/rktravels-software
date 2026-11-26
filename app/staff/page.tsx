"use client";

import React, { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Search,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Users,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Filter,
  CheckSquare,
  Square,
  Layers,
  Lock,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { hashMpin } from "@/lib/security";
import { NAV_ITEMS, PageModuleInfo } from "@/lib/pages-data";

export interface StaffRecord {
  id: string;
  name: string;
  mobileNumber: string;
  mpinHash: string;
  status: "Active" | "Inactive";
  permissions: Record<string, "view" | "view_edit">;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

// Available pages grouped for permission assignment
const PERMISSION_PAGES: {
  id: string;
  name: string;
  category: string;
  path: string;
}[] = [
  // Operations & Overview
  { id: "dashboard", name: "Dashboard", category: "MAIN OVERVIEW", path: "/dashboard" },
  { id: "bookings", name: "Bookings", category: "OPERATIONS", path: "/bookings" },
  { id: "entities", name: "Entities", category: "OPERATIONS", path: "/entities" },
  // Financials
  { id: "payments", name: "Payments", category: "FINANCIALS", path: "/payments" },
  { id: "credit", name: "Credit", category: "FINANCIALS", path: "/credit" },
  // CRM
  { id: "companies", name: "Companies", category: "CRM & CLIENTS", path: "/companies" },
  { id: "customers", name: "Customers", category: "CRM & CLIENTS", path: "/customers" },
  // Commercial
  { id: "tariffs", name: "Company Tariff", category: "COMMERCIAL", path: "/tariffs" },
  { id: "customer-tariffs", name: "Customer Tariff", category: "COMMERCIAL", path: "/customer-tariffs" },
  // Fleet & Crew
  { id: "drivers", name: "Drivers", category: "FLEET & CREW", path: "/drivers" },
  { id: "driver-trip-plan", name: "Driver Trip Plan", category: "FLEET & CREW", path: "/driver-trip-plan" },
  { id: "vehicles", name: "Vehicles", category: "FLEET & CREW", path: "/vehicles" },
  { id: "vehicle-categories", name: "Vehicle Categories", category: "FLEET & CREW", path: "/vehicle-categories" },
  { id: "car-vendors", name: "Car Vendors", category: "FLEET & CREW", path: "/car-vendors" },
  // Masters & HR
  { id: "locations", name: "Locations", category: "MASTERS", path: "/locations" },
  { id: "employees", name: "Employees", category: "HUMAN RESOURCES", path: "/employees" },
  // Reports
  { id: "report-bookings", name: "Bookings Report", category: "REPORTS", path: "/reports/bookings" },
  { id: "report-drivers", name: "Driver Report", category: "REPORTS", path: "/reports/drivers" },
  { id: "report-vehicles", name: "Vehicle Report", category: "REPORTS", path: "/reports/vehicles" },
  { id: "report-credit", name: "Credit Report", category: "REPORTS", path: "/reports/credit" },
  { id: "report-car-vendors", name: "Car Vendor Report", category: "REPORTS", path: "/reports/car-vendors" },
];

const ITEMS_PER_PAGE = 24;

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer & Form state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formMpin, setFormMpin] = useState("");
  const [showMpin, setShowMpin] = useState(false);
  const [formStatus, setFormStatus] = useState<"Active" | "Inactive">("Active");
  const [formPermissions, setFormPermissions] = useState<Record<string, "view" | "view_edit">>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionCategoryFilter, setPermissionCategoryFilter] = useState("All");

  // Feedback banner
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Delete modal state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Real-time Firestore subscription to Staff collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "staff"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: StaffRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: d.name || "",
            mobileNumber: d.mobileNumber || "",
            mpinHash: d.mpinHash || "",
            status: d.status || "Active",
            permissions: d.permissions || {},
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });
        setStaffList(items);
        setLoading(false);
      },
      (error) => {
        console.error("Staff subscription error:", error);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.mobileNumber.includes(searchQuery);
      const matchStatus =
        statusFilter === "All" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [staffList, searchQuery, statusFilter]);

  // Paginated items (limit 24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / ITEMS_PER_PAGE));
  const paginatedStaff = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStaff.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStaff, currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Open Drawer for Add
  const handleOpenAdd = () => {
    setEditingStaffId(null);
    setFormName("");
    setFormMobile("");
    setFormMpin("");
    setShowMpin(false);
    setFormStatus("Active");
    // Default: give dashboard view
    setFormPermissions({ dashboard: "view" });
    setIsDrawerOpen(true);
  };

  // Open Drawer for Edit
  const handleOpenEdit = (staff: StaffRecord) => {
    setEditingStaffId(staff.id);
    setFormName(staff.name);
    setFormMobile(staff.mobileNumber);
    setFormMpin(""); // Empty means keep existing MPIN
    setShowMpin(false);
    setFormStatus(staff.status);
    setFormPermissions({ ...(staff.permissions || {}) });
    setIsDrawerOpen(true);
  };

  // Permission toggles
  const handleSetPermission = (pageId: string, level: "none" | "view" | "view_edit") => {
    setFormPermissions((prev) => {
      const updated = { ...prev };
      if (level === "none") {
        delete updated[pageId];
      } else {
        updated[pageId] = level;
      }
      return updated;
    });
  };

  const handleGrantAll = (level: "view" | "view_edit") => {
    const all: Record<string, "view" | "view_edit"> = {};
    PERMISSION_PAGES.forEach((p) => {
      all[p.id] = level;
    });
    setFormPermissions(all);
  };

  const handleClearAll = () => {
    setFormPermissions({});
  };

  // Save / Update Staff Submit
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const cleanName = formName.trim();
    const cleanMobile = formMobile.replace(/\D/g, "").slice(-10);

    if (!cleanName) {
      alert("Please enter the staff member's name.");
      return;
    }
    if (cleanMobile.length !== 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!editingStaffId && (!formMpin || formMpin.trim().length < 4)) {
      alert("Please enter a 4-6 digit MPIN for this staff member.");
      return;
    }

    if (formMpin && formMpin.trim().length < 4) {
      alert("MPIN must be at least 4 digits.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Check for mobile uniqueness among other staff records
      const existing = staffList.find(
        (s) => s.mobileNumber === cleanMobile && s.id !== editingStaffId
      );
      if (existing) {
        throw new Error(
          `A staff member with mobile number ${cleanMobile} already exists (${existing.name}).`
        );
      }

      if (editingStaffId) {
        // Update existing staff
        const updateData: any = {
          name: cleanName,
          mobileNumber: cleanMobile,
          status: formStatus,
          permissions: formPermissions,
          updatedAt: serverTimestamp(),
        };

        // If new MPIN provided, hash and update
        if (formMpin.trim()) {
          updateData.mpinHash = await hashMpin(formMpin.trim(), cleanMobile);
        }

        await updateDoc(doc(db, "staff", editingStaffId), updateData);
        setFeedback({
          type: "success",
          message: `Staff member "${cleanName}" updated successfully!`,
        });
      } else {
        // Create new staff
        const newDocRef = doc(collection(db, "staff"));
        const hashedMpin = await hashMpin(formMpin.trim(), cleanMobile);

        const newStaffPayload = {
          name: cleanName,
          mobileNumber: cleanMobile,
          mpinHash: hashedMpin,
          status: formStatus,
          permissions: formPermissions,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(newDocRef, newStaffPayload);
        setFeedback({
          type: "success",
          message: `Staff member "${cleanName}" added successfully with encrypted credentials!`,
        });
      }

      setIsDrawerOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error("Save staff error:", err);
      setFeedback({
        type: "error",
        message: err.message || "Failed to save staff member.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status directly
  const handleToggleStatus = async (staff: StaffRecord) => {
    const nextStatus = staff.status === "Active" ? "Inactive" : "Active";
    try {
      await updateDoc(doc(db, "staff", staff.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: "success",
        message: `${staff.name} marked as ${nextStatus}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  // Delete staff member
  const handleDeleteStaff = async (id: string) => {
    try {
      await deleteDoc(doc(db, "staff", id));
      setDeleteConfirmId(null);
      setFeedback({
        type: "success",
        message: "Staff member deleted successfully.",
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert("Failed to delete staff member: " + err.message);
    }
  };

  // Unique categories for drawer filter
  const categoriesList = useMemo(() => {
    const cats = new Set(PERMISSION_PAGES.map((p) => p.category));
    return ["All", ...Array.from(cats)];
  }, []);

  const displayedPermissionPages = useMemo(() => {
    if (permissionCategoryFilter === "All") return PERMISSION_PAGES;
    return PERMISSION_PAGES.filter((p) => p.category === permissionCategoryFilter);
  }, [permissionCategoryFilter]);

  return (
    <div className="w-full space-y-4 font-sans pb-16 max-w-[1400px] mx-auto">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">SYSTEM &amp; ACCESS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Staff Management</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight">
                Staff &amp; Access Control
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                {staffList.filter((s) => s.status === "Active").length} Active Staff
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage staff team members, encrypted MPIN login credentials, and granular view/edit page permissions.
            </p>
          </div>
        </div>

        {/* Action Button: Add Staff */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Add Staff</span>
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs font-normal border ${
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search staff by name or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[32px] pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[4px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Status:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[4px] text-xs">
            {(["All", "Active", "Inactive"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs rounded-[3px] transition cursor-pointer ${
                  statusFilter === st
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Table Container */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#f16623]" />
            <span className="text-xs">Loading staff records...</span>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-800">
              {searchQuery ? "No matching staff members found" : "No staff members added yet"}
            </h3>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? "Try searching with a different name or mobile number."
                : "Add your operational team members with secure MPIN and custom page permissions."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-[4px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Staff</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Staff Name</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">Permitted Modules</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {paginatedStaff.map((staff, idx) => {
                  const globalIdx = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  const permKeys = Object.keys(staff.permissions || {});
                  const viewEditCount = Object.values(staff.permissions || {}).filter(
                    (v) => v === "view_edit"
                  ).length;
                  const viewOnlyCount = permKeys.length - viewEditCount;

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-[4px] bg-blue-100/70 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {staff.name?.[0]?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-tight">
                              {staff.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Staff ID: {staff.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                        +91 {staff.mobileNumber}
                      </td>

                      <td className="py-2.5 px-3">
                        {permKeys.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">
                            No pages assigned
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                              {permKeys.length} Modules
                            </span>
                            {viewEditCount > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-emerald-50 text-emerald-700 text-[9px] font-medium border border-emerald-200">
                                {viewEditCount} Edit
                              </span>
                            )}
                            {viewOnlyCount > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-blue-50 text-blue-700 text-[9px] font-medium border border-blue-200">
                                {viewOnlyCount} View Only
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(staff)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer border ${
                            staff.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              staff.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          <span>{staff.status}</span>
                        </button>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(staff)}
                            className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-[#f16623] hover:bg-orange-50 border border-slate-200 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                            title="Edit staff details and permissions"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(staff.id)}
                            className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 flex items-center justify-center transition cursor-pointer"
                            title="Delete staff"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar (Limit 24 per page) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>
              Showing{" "}
              <strong className="text-slate-800 font-medium">
                {filteredStaff.length === 0
                  ? 0
                  : (currentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-800 font-medium">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredStaff.length)}
              </strong>{" "}
              of{" "}
              <strong className="text-slate-800 font-medium">
                {filteredStaff.length}
              </strong>{" "}
              staff
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[10px] font-mono bg-slate-200/60 px-2 py-0.5 rounded text-slate-600">
              Limit: 24 / page
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-[28px] px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`h-[28px] w-[28px] rounded-[4px] text-xs font-mono font-medium transition cursor-pointer ${
                      currentPage === pg
                        ? "bg-[#f16623] text-white shadow-2xs"
                        : "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-[28px] px-2.5 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ADD / EDIT STAFF OFFCANVAS DRAWER */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingStaffId ? "Edit Staff Member" : "Add New Staff Member"}
        subtitle="Configure staff profile, encrypted MPIN login, and page-by-page access rights"
        size="2xl"
        widthClassName="max-w-3xl"
      >
        <form onSubmit={handleSaveStaff} className="space-y-4 text-xs font-normal">
          {/* Section 1: Staff Credentials */}
          <div className="bg-slate-50/80 p-3.5 rounded-[6px] border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
              <span className="font-semibold text-slate-900 text-xs">
                Staff Credentials &amp; Profile
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Staff Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Staff Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Varma"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full h-[32px] px-2.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] transition"
                />
              </div>

              {/* Mobile Number */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Mobile Number (Used for Login) <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-[11px] font-mono text-slate-400 font-medium">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-[32px] pl-10 pr-2.5 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 font-mono focus:outline-none focus:border-[#f16623] transition"
                  />
                </div>
              </div>

              {/* Security MPIN */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Security MPIN (4-6 Digits){" "}
                  {editingStaffId ? (
                    <span className="text-slate-400 font-normal">(Leave empty to retain current)</span>
                  ) : (
                    <span className="text-rose-500">*</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showMpin ? "text" : "password"}
                    maxLength={6}
                    placeholder={editingStaffId ? "•••• (Unchanged)" : "4 to 6 digit MPIN"}
                    value={formMpin}
                    onChange={(e) => setFormMpin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full h-[32px] pl-2.5 pr-8 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 font-mono tracking-wider focus:outline-none focus:border-[#f16623] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMpin(!showMpin)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showMpin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  Stored as salted SHA-256 hash. Plain MPIN is never kept.
                </span>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 block">
                  Account Status
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="radio"
                      name="staffFormStatus"
                      checked={formStatus === "Active"}
                      onChange={() => setFormStatus("Active")}
                      className="accent-[#f16623]"
                    />
                    <span>Active (Permit Login)</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-800">
                    <input
                      type="radio"
                      name="staffFormStatus"
                      checked={formStatus === "Inactive"}
                      onChange={() => setFormStatus("Inactive")}
                      className="accent-[#f16623]"
                    />
                    <span>Inactive (Block Login)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Page Access & Permissions Matrix */}
          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200 space-y-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-xs font-semibold text-slate-900 leading-tight">
                  Page Access &amp; Permission Matrix
                </h4>
                <p className="text-[10px] text-slate-400">
                  Choose which modules this staff member can access and whether they have View or View &amp; Edit rights.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleGrantAll("view_edit")}
                  className="px-2 py-1 rounded-[4px] bg-orange-50 hover:bg-orange-100 text-[#f16623] text-[10px] font-medium border border-[#f16623]/25 transition cursor-pointer"
                >
                  All View &amp; Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleGrantAll("view")}
                  className="px-2 py-1 rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium border border-slate-200 transition cursor-pointer"
                >
                  All View Only
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2 py-1 rounded-[4px] hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-[10px] transition cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPermissionCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-[3px] text-[10px] whitespace-nowrap transition cursor-pointer ${
                    permissionCategoryFilter === cat
                      ? "bg-slate-900 text-white font-medium"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Table of Pages & Permissions */}
            <div className="border border-slate-200 rounded-[4px] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Module Name</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3 text-right">Access Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {displayedPermissionPages.map((page) => {
                    const currentPerm: "view" | "view_edit" | "none" =
                      (formPermissions[page.id] as any) || "none";

                    return (
                      <tr
                        key={page.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          currentPerm !== "none" ? "bg-orange-50/20" : ""
                        }`}
                      >
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-800 block text-xs">
                            {page.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {page.path}
                          </span>
                        </td>

                        <td className="py-2 px-3 text-[10px] text-slate-400 font-mono">
                          {page.category}
                        </td>

                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded-[4px]">
                            {/* No Access */}
                            <button
                              type="button"
                              onClick={() => handleSetPermission(page.id, "none")}
                              className={`px-2 py-0.5 text-[10px] rounded-[3px] transition cursor-pointer ${
                                currentPerm === "none"
                                  ? "bg-white text-slate-700 font-semibold shadow-2xs"
                                  : "text-slate-400 hover:text-slate-700"
                              }`}
                            >
                              No Access
                            </button>

                            {/* View Only */}
                            <button
                              type="button"
                              onClick={() => handleSetPermission(page.id, "view")}
                              className={`px-2 py-0.5 text-[10px] rounded-[3px] transition cursor-pointer ${
                                currentPerm === "view"
                                  ? "bg-blue-600 text-white font-medium shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              View
                            </button>

                            {/* View & Edit */}
                            <button
                              type="button"
                              onClick={() => handleSetPermission(page.id, "view_edit")}
                              className={`px-2 py-0.5 text-[10px] rounded-[3px] transition cursor-pointer ${
                                currentPerm === "view_edit"
                                  ? "bg-[#f16623] text-white font-semibold shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              View &amp; Edit
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

          {/* Drawer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Staff...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{editingStaffId ? "Save Changes" : "Save Staff Member"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Staff Member?
                </h3>
                <p className="text-xs text-slate-500">
                  This action cannot be undone. The staff member will lose system access immediately.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="h-[32px] px-3 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStaff(deleteConfirmId)}
                className="h-[32px] px-3 rounded-[4px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition cursor-pointer"
              >
                Delete Staff
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
