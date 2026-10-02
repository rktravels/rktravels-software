"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Route,
  Phone,
  Building,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  ChevronLeft,
  ChevronRight,
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

interface EntityItem {
  id: string;
  entityName: string;
  mobileNumber: string;
  createdAt?: Timestamp | null;
  _sourceCollection?: "entities" | "travels";
}

const ITEMS_PER_PAGE = 24;

export default function EntitiesPage() {
  const [entityName, setEntityName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [entitiesMap, setEntitiesMap] = useState<Map<string, EntityItem>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Subscribe to real-time updates from both "entities" and legacy "travels" collections
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    try {
      // 1. Entities collection
      const qEntities = query(collection(db, "entities"), orderBy("createdAt", "desc"));
      const unsubEntities = onSnapshot(
        qEntities,
        (snapshot) => {
          setEntitiesMap((prev) => {
            const next = new Map(prev);
            for (const [key, val] of next.entries()) {
              if (val._sourceCollection === "entities") next.delete(key);
            }
            snapshot.docs.forEach((docSnap) => {
              const data = docSnap.data();
              const name = data.entityName || data.travelName || "Unnamed Entity";
              next.set(docSnap.id, {
                id: docSnap.id,
                entityName: name,
                mobileNumber: data.mobileNumber || "",
                createdAt: data.createdAt || null,
                _sourceCollection: "entities",
              });
            });
            return next;
          });
          setLoading(false);
        },
        (error) => {
          console.warn("Entities collection read error, trying fallback:", error);
          const fallbackQ = query(collection(db, "entities"));
          const unsubFallback = onSnapshot(fallbackQ, (snapshot) => {
            setEntitiesMap((prev) => {
              const next = new Map(prev);
              for (const [key, val] of next.entries()) {
                if (val._sourceCollection === "entities") next.delete(key);
              }
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const name = data.entityName || data.travelName || "Unnamed Entity";
                next.set(docSnap.id, {
                  id: docSnap.id,
                  entityName: name,
                  mobileNumber: data.mobileNumber || "",
                  createdAt: data.createdAt || null,
                  _sourceCollection: "entities",
                });
              });
              return next;
            });
            setLoading(false);
          });
          unsubs.push(unsubFallback);
        }
      );
      unsubs.push(unsubEntities);

      // 2. Legacy travels collection for complete data preservation
      const qTravels = query(collection(db, "travels"), orderBy("createdAt", "desc"));
      const unsubTravels = onSnapshot(
        qTravels,
        (snapshot) => {
          setEntitiesMap((prev) => {
            const next = new Map(prev);
            snapshot.docs.forEach((docSnap) => {
              if (!next.has(docSnap.id)) {
                const data = docSnap.data();
                const name = data.entityName || data.travelName || "Unnamed Entity";
                next.set(docSnap.id, {
                  id: docSnap.id,
                  entityName: name,
                  mobileNumber: data.mobileNumber || "",
                  createdAt: data.createdAt || null,
                  _sourceCollection: "travels",
                });
              }
            });
            return next;
          });
          setLoading(false);
        },
        (err) => {
          console.warn("Travels fallback listener warning:", err);
          setLoading(false);
        }
      );
      unsubs.push(unsubTravels);
    } catch (err) {
      console.error("Failed to initialize entity listeners:", err);
      setLoading(false);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  const entitiesList = useMemo(() => {
    const list = Array.from(entitiesMap.values());
    return list.sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return timeB - timeA;
    });
  }, [entitiesMap]);

  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = entityName.trim();
    const trimmedMobile = mobileNumber.trim();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter an entity name." });
      return;
    }

    if (!trimmedMobile) {
      setFeedback({ type: "error", message: "Please enter a mobile number." });
      return;
    }

    if (!/^[0-9+\-\s]{7,15}$/.test(trimmedMobile)) {
      setFeedback({
        type: "error",
        message: "Please enter a valid mobile number (e.g. 9876543210).",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        entityName: trimmedName,
        travelName: trimmedName, // Backward-compatible alias
        mobileNumber: trimmedMobile,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "entities"), payload);

      setEntityName("");
      setMobileNumber("");
      setFeedback({
        type: "success",
        message: `Entity "${trimmedName}" has been successfully saved to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving entity to Firestore:", err);
      setFeedback({
        type: "error",
        message: "Failed to save entity to Firebase Firestore. Please check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: EntityItem) => {
    if (!confirm(`Are you sure you want to remove "${item.entityName}"?`)) return;
    try {
      const colName = item._sourceCollection || "entities";
      await deleteDoc(doc(db, colName, item.id));
      setFeedback({
        type: "success",
        message: `Entity "${item.entityName}" was removed.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting entity:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete entity record.",
      });
    }
  };

  const filteredEntities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return entitiesList;
    return entitiesList.filter(
      (item) =>
        item.entityName?.toLowerCase().includes(q) ||
        item.mobileNumber?.includes(q)
    );
  }, [entitiesList, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredEntities.length / ITEMS_PER_PAGE));
  const paginatedEntities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEntities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEntities, currentPage]);

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
        <span className="text-[#f16623] font-medium">Entities</span>
      </nav>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Entities Registry
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {entitiesList.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage operating entities, partner travel operators & phone contacts in Firebase Firestore
            </p>
          </div>
        </div>

        {/* Search input (strictly max-height 34px, rounded 6px, font-normal) */}
        <div className="relative sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search entity or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
          />
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

      {/* Form Card: Add Entity with compact padding */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-3.5">
        <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-slate-100">
          <Plus className="w-3.5 h-3.5 text-[#f16623]" />
          <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
            Add New Entity
          </h2>
        </div>

        <form onSubmit={handleSaveEntity} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
            {/* Field 1: Entity Name */}
            <div className="lg:col-span-2 space-y-1">
              <label
                htmlFor="entityName"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Building className="w-3 h-3 text-[#f16623]" />
                Entity Name <span className="text-[#f16623]">*</span>
              </label>
              <input
                id="entityName"
                type="text"
                required
                placeholder="e.g. RK Luxury Travels / RK South Zone"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>

            {/* Field 2: Mobile Number */}
            <div className="lg:col-span-2 space-y-1">
              <label
                htmlFor="mobileNumber"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Phone className="w-3 h-3 text-[#f16623]" />
                Mobile Number <span className="text-[#f16623]">*</span>
              </label>
              <input
                id="mobileNumber"
                type="tel"
                required
                placeholder="e.g. 9876543210"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>

            {/* Submit Button */}
            <div className="lg:col-span-1">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Save Entity</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Entities Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Registered Entities List
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredEntities.length} record{filteredEntities.length === 1 ? "" : "s"} shown
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading entities from Firestore...</span>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Route className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching entities found" : "No entities added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different entity name or phone number."
                : "Fill out the form above to save your first entity to Firestore."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium">Entity Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">Created Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedEntities.map((entity, index) => {
                  const absoluteIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  let dateStr = "Just now";
                  if (entity.createdAt && typeof entity.createdAt.toDate === "function") {
                    dateStr = entity.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }

                  return (
                    <tr
                      key={entity.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {absoluteIndex}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-[3px] bg-[#f16623]/10 text-[#f16623] flex items-center justify-center font-medium text-[9px]">
                            {entity.entityName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900 text-xs">
                            {entity.entityName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {entity.mobileNumber}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`tel:${entity.mobileNumber}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call entity"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDelete(entity)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition cursor-pointer"
                            title="Delete entity"
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

        {/* Pagination bar with limit of 24 items */}
        {filteredEntities.length > 0 && (
          <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 font-normal">
            <div>
              Showing{" "}
              <span className="font-medium text-slate-800">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-slate-800">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredEntities.length)}
              </span>{" "}
              of <span className="font-medium text-slate-800">{filteredEntities.length}</span> entities
              (24 per page)
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="px-2 py-1 text-slate-600 font-medium">
                Page {currentPage} of {totalPages}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-white border border-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
