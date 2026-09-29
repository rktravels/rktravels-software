"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Layers,
  IndianRupee,
  Route,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
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
  travelId: string;
  travelName: string;
  packageType?: string;
  description?: string;
  createdAt?: Timestamp | null;
}

interface TravelOption {
  id: string;
  travelName: string;
  mobileNumber?: string;
}

const PACKAGE_TYPES = [
  "Round Trip",
  "One-Way Drop",
  "Local Hourly Rental",
  "Outstation Package",
  "Airport Transfer",
  "Corporate Monthly",
  "Custom Tariff",
];

export default function PlansPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Form Fields
  const [planName, setPlanName] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedTravelId, setSelectedTravelId] = useState("");
  const [selectedTravelName, setSelectedTravelName] = useState("");
  const [packageType, setPackageType] = useState("Round Trip");
  const [description, setDescription] = useState("");

  // Dynamic Travels list from Firestore
  const [travelsList, setTravelsList] = useState<TravelOption[]>([]);

  // Page Data & Filters
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Travels Collection for dropdown
  useEffect(() => {
    try {
      const q = query(collection(db, "travels"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: TravelOption[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            travelName: docSnap.data().travelName || "Unnamed Travel",
            mobileNumber: docSnap.data().mobileNumber || "",
          }));
          setTravelsList(items);
        },
        (err) => {
          console.error("Travels listener error in plans, falling back:", err);
          const fallback = query(collection(db, "travels"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: TravelOption[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              travelName: docSnap.data().travelName || "Unnamed Travel",
              mobileNumber: docSnap.data().mobileNumber || "",
            }));
            setTravelsList(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load travels in plans:", err);
    }
  }, []);

  // 2. Subscribe to real-time plans collection in Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: PlanItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<PlanItem, "id">),
          }));
          setPlans(items);
          setLoading(false);
        },
        (err) => {
          console.error("Plans listener error, falling back:", err);
          const fallback = query(collection(db, "plans"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: PlanItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<PlanItem, "id">),
            }));
            setPlans(items);
            setLoading(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to initialize plans listener:", err);
      setLoading(false);
    }
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedPlanName = planName.trim();
    const numAmount = Number(amount);

    if (!trimmedPlanName) {
      setFeedback({ type: "error", message: "Please enter plan name." });
      return;
    }

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setFeedback({
        type: "error",
        message: "Please enter a valid plan amount (greater than 0).",
      });
      return;
    }

    if (!selectedTravelId) {
      setFeedback({
        type: "error",
        message: "Please select a Travels / Agency for this plan.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "plans"), {
        planName: trimmedPlanName,
        amount: numAmount,
        travelId: selectedTravelId,
        travelName: selectedTravelName,
        packageType: packageType || null,
        description: description.trim() || null,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setPlanName("");
      setAmount("");
      setSelectedTravelId("");
      setSelectedTravelName("");
      setPackageType("Round Trip");
      setDescription("");

      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Plan "${trimmedPlanName}" (₹${numAmount.toLocaleString("en-IN")}) has been saved to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving plan:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save plan.";
      setFeedback({
        type: "error",
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete plan "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "plans", id));
      setFeedback({
        type: "success",
        message: `Plan "${name}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting plan:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete plan.",
      });
    }
  };

  const filteredPlans = plans.filter(
    (p) =>
      p.planName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.travelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.packageType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(p.amount).includes(searchQuery)
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">COMMERCIAL</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Plans</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Tariff & Travel Plans
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {plans.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage package pricing, route tariffs, assigned travel operators & Firestore records
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Plan Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plan, travel, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsOffCanvasOpen(true)}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Plan</span>
          </button>
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

      {/* Plans Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Configured Travel Plans
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredPlans.length} plan{filteredPlans.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading plans from Firestore...</span>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching plans found" : "No plans added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different plan name, travel, or tariff amount."
                : "Click on 'Add Plan' to configure a new plan name, tariff amount, and assign travel agency."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plan</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium">Plan Name</th>
                  <th className="py-2 px-3 font-medium">Package Type</th>
                  <th className="py-2 px-3 font-medium">Assigned Travels</th>
                  <th className="py-2 px-3 font-medium">Plan Amount</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlans.map((p, index) => {
                  let dateStr = "Just now";
                  if (p.createdAt && typeof p.createdAt.toDate === "function") {
                    dateStr = p.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>

                      {/* Plan Name */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 text-xs">
                            {p.planName}
                          </span>
                          {p.description && (
                            <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]" title={p.description}>
                              {p.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Package Type */}
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-[10px] text-slate-600 font-normal">
                          {p.packageType || "Standard Tariff"}
                        </span>
                      </td>

                      {/* Assigned Travels */}
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1 max-w-[150px] truncate">
                          <Route className="w-3 h-3 shrink-0" />
                          <span className="truncate">{p.travelName}</span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-3">
                        <span className="font-mono font-medium text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded-[4px] border border-slate-200/70 inline-block">
                          ₹{Number(p.amount).toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Added Date */}
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.planName)}
                          className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete plan"
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

      {/* Right Side Off-Canvas Drawer for Adding Plan */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        title="Add New Plan"
        subtitle="Configure plan name, amount tariff, and assigned travels"
      >
        <form onSubmit={handleSavePlan} className="space-y-3.5">
          {/* Field 1: Plan Name */}
          <div className="space-y-1">
            <label
              htmlFor="plan-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Tag className="w-3 h-3 text-[#f16623]" />
              Plan Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="plan-name"
              type="text"
              required
              placeholder="e.g. Hyderabad to Srisailam Round Trip"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 2: Travels (Required) */}
          <div className="space-y-1">
            <label
              htmlFor="plan-travel"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Route className="w-3 h-3 text-[#f16623]" />
              Travels / Agency <span className="text-[#f16623]">*</span>
            </label>
            <select
              id="plan-travel"
              required
              value={selectedTravelId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTravelId(val);
                const found = travelsList.find((t) => t.id === val);
                setSelectedTravelName(found ? found.travelName : "");
              }}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              <option value="">-- Choose Travels / Agency --</option>
              {travelsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.travelName} {t.mobileNumber ? `(${t.mobileNumber})` : ""}
                </option>
              ))}
            </select>
            {travelsList.length === 0 && (
              <p className="text-[10px] text-slate-400">
                No travels registered yet. Add travels in the{" "}
                <Link href="/travels" className="text-[#f16623] underline">
                  Travels page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Field 3: Plan Amount */}
          <div className="space-y-1">
            <label
              htmlFor="plan-amount"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <IndianRupee className="w-3 h-3 text-[#f16623]" />
              Amount / Tariff (₹) <span className="text-[#f16623]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                ₹
              </span>
              <input
                id="plan-amount"
                type="number"
                min="1"
                required
                placeholder="e.g. 4500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-[34px] max-h-[34px] pl-6 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>
          </div>

          {/* Field 4: Package Type (Optional) */}
          <div className="space-y-1">
            <label
              htmlFor="plan-type"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
            >
              Package Type
            </label>
            <select
              id="plan-type"
              value={packageType}
              onChange={(e) => setPackageType(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              {PACKAGE_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>

          {/* Field 5: Description (Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="plan-desc"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <FileText className="w-3 h-3 text-slate-400" />
                Notes / Terms
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>
            <input
              id="plan-desc"
              type="text"
              placeholder="e.g. Toll charges extra, includes 300 kms"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Plan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
