"use client";

import { useState, useEffect } from "react";
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

interface TravelItem {
  id: string;
  travelName: string;
  mobileNumber: string;
  createdAt?: Timestamp | null;
}

export default function TravelsPage() {
  const [travelName, setTravelName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [travels, setTravels] = useState<TravelItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time Firestore updates
  useEffect(() => {
    try {
      const q = query(collection(db, "travels"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: TravelItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<TravelItem, "id">),
          }));
          setTravels(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore read error:", error);
          const fallbackQuery = query(collection(db, "travels"));
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: TravelItem[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<TravelItem, "id">),
            }));
            setTravels(items);
            setLoading(false);
          });
          return () => fallbackUnsub();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize listener:", err);
      setLoading(false);
    }
  }, []);

  const handleSaveTravel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = travelName.trim();
    const trimmedMobile = mobileNumber.trim();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter a travel name." });
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
      await addDoc(collection(db, "travels"), {
        travelName: trimmedName,
        mobileNumber: trimmedMobile,
        createdAt: serverTimestamp(),
      });

      setTravelName("");
      setMobileNumber("");
      setFeedback({
        type: "success",
        message: `Travel "${trimmedName}" has been successfully saved to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving travel to Firestore:", err);
      setFeedback({
        type: "error",
        message:
          "Failed to save travel to Firebase Firestore. Please check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "travels", id));
      setFeedback({
        type: "success",
        message: `Travel "${name}" was removed.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting travel:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete travel record.",
      });
    }
  };

  const filteredTravels = travels.filter(
    (item) =>
      item.travelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.mobileNumber?.includes(searchQuery)
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
        <span className="text-[#f16623] font-medium">Travels</span>
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
                Travels Registry
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {travels.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage partner travel operators & mobile contacts in Firebase Firestore
            </p>
          </div>
        </div>

        {/* Search input (strictly max-height 34px, rounded 6px, font-normal) */}
        <div className="relative sm:w-60">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search travel or phone..."
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

      {/* Form Card: Add Travel with compact padding */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-3.5">
        <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-slate-100">
          <Plus className="w-3.5 h-3.5 text-[#f16623]" />
          <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
            Add New Travel
          </h2>
        </div>

        <form onSubmit={handleSaveTravel} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end">
            {/* Field 1: Travel Name */}
            <div className="lg:col-span-2 space-y-1">
              <label
                htmlFor="travelName"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Building className="w-3 h-3 text-[#f16623]" />
                Travel Name <span className="text-[#f16623]">*</span>
              </label>
              <input
                id="travelName"
                type="text"
                required
                placeholder="e.g. RK Luxury Travels"
                value={travelName}
                onChange={(e) => setTravelName(e.target.value)}
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
                    <span>Save Travel</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Travels Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Registered Travels List
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredTravels.length} record{filteredTravels.length === 1 ? "" : "s"} shown
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading travels from Firestore...</span>
          </div>
        ) : filteredTravels.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Route className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching travels found" : "No travels added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different travel name or phone number."
                : "Fill out the form above to save your first travel to Firestore."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium">Travel Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">Created Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTravels.map((travel, index) => {
                  let dateStr = "Just now";
                  if (travel.createdAt && typeof travel.createdAt.toDate === "function") {
                    dateStr = travel.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }

                  return (
                    <tr
                      key={travel.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-[3px] bg-[#f16623]/10 text-[#f16623] flex items-center justify-center font-medium text-[9px]">
                            {travel.travelName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900 text-xs">
                            {travel.travelName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {travel.mobileNumber}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`tel:${travel.mobileNumber}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call travel"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDelete(travel.id, travel.travelName)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition"
                            title="Delete travel"
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
      </div>
    </div>
  );
}
