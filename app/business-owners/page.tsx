"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  User,
  Phone,
  Mail,
  Building,
  Receipt,
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
import { OffCanvas } from "@/components/OffCanvas";

interface BusinessOwnerItem {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  companyName: string;
  gstNumber?: string;
  createdAt?: Timestamp | null;
}

export default function BusinessOwnersPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [owners, setOwners] = useState<BusinessOwnerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time business_owners collection in Firestore
  useEffect(() => {
    try {
      const q = query(
        collection(db, "business_owners"),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: BusinessOwnerItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<BusinessOwnerItem, "id">),
          }));
          setOwners(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore read error, falling back:", error);
          const fallbackQuery = query(collection(db, "business_owners"));
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: BusinessOwnerItem[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<BusinessOwnerItem, "id">),
            }));
            setOwners(items);
            setLoading(false);
          });
          return () => fallbackUnsub();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize business_owners listener:", err);
      setLoading(false);
    }
  }, []);

  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim();
    const trimmedCompany = companyName.trim();
    const trimmedGst = gstNumber.trim().toUpperCase();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter business owner name." });
      return;
    }

    if (!trimmedMobile) {
      setFeedback({ type: "error", message: "Please enter mobile number." });
      return;
    }

    if (!/^[0-9+\-\s]{7,15}$/.test(trimmedMobile)) {
      setFeedback({
        type: "error",
        message: "Please enter a valid mobile number (e.g. 9876543210).",
      });
      return;
    }

    if (!trimmedCompany) {
      setFeedback({ type: "error", message: "Please enter company name." });
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "business_owners"), {
        name: trimmedName,
        mobile: trimmedMobile,
        email: trimmedEmail || null,
        companyName: trimmedCompany,
        gstNumber: trimmedGst || null,
        createdAt: serverTimestamp(),
      });

      setName("");
      setMobile("");
      setEmail("");
      setCompanyName("");
      setGstNumber("");
      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Business Owner "${trimmedName}" (${trimmedCompany}) saved to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving business owner to Firestore:", err);
      setFeedback({
        type: "error",
        message: "Failed to save business owner. Please check your connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, ownerName: string) => {
    if (!confirm(`Are you sure you want to delete "${ownerName}"?`)) return;
    try {
      await deleteDoc(doc(db, "business_owners", id));
      setFeedback({
        type: "success",
        message: `Business owner "${ownerName}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting business owner:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete record.",
      });
    }
  };

  const filteredOwners = owners.filter(
    (o) =>
      o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.mobile?.includes(searchQuery) ||
      o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.gstNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">PARTNERS & STAKEHOLDERS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Business Owners</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Business Owners Directory
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {owners.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage fleet franchise owners, company affiliations, and GST tax records
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Business Owner Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search owners or company..."
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
            <span>Add Business Owner</span>
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

      {/* Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Registered Business Owners
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredOwners.length} record{filteredOwners.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading business owners from Firestore...</span>
          </div>
        ) : filteredOwners.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching records found" : "No business owners added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different owner, company name, phone, or GST number."
                : "Click on 'Add Business Owner' to open the side panel and save your first partner."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Business Owner</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium">Owner Name</th>
                  <th className="py-2 px-3 font-medium">Company Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">GST Number</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOwners.map((owner, index) => {
                  let dateStr = "Just now";
                  if (owner.createdAt && typeof owner.createdAt.toDate === "function") {
                    dateStr = owner.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={owner.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-[3px] bg-[#f16623]/10 text-[#f16623] flex items-center justify-center font-medium text-[10px]">
                            {owner.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900 text-xs">
                            {owner.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-slate-800 font-medium text-xs">
                          {owner.companyName}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {owner.mobile}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        {owner.email || (
                          <span className="text-slate-300 italic text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {owner.gstNumber ? (
                          <span className="font-mono text-[10px] text-slate-700 bg-orange-50/80 border border-orange-200/50 px-1.5 py-0.5 rounded-[3px]">
                            {owner.gstNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`tel:${owner.mobile}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call owner"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          {owner.email && (
                            <a
                              href={`mailto:${owner.email}`}
                              className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200 hover:border-sky-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                              title="Email owner"
                            >
                              <Mail className="w-3 h-3" />
                              <span className="hidden sm:inline">Email</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(owner.id, owner.name)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition"
                            title="Delete owner"
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

      {/* Right Side Off-Canvas Drawer for Adding Business Owner */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title="Add Business Owner"
        subtitle="Fill in partner & tax details to store in Firestore"
      >
        <form onSubmit={handleSaveOwner} className="space-y-4">
          {/* Field: Owner Name */}
          <div className="space-y-1">
            <label
              htmlFor="owner-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <User className="w-3 h-3 text-[#f16623]" />
              Business Owner Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="owner-name"
              type="text"
              required
              placeholder="e.g. Suresh Reddy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Mobile Number */}
          <div className="space-y-1">
            <label
              htmlFor="owner-mobile"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#f16623]" />
              Mobile Number <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="owner-mobile"
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Email (Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="owner-email"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Mail className="w-3 h-3 text-slate-400" />
                Email Address
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>
            <input
              id="owner-email"
              type="email"
              placeholder="e.g. suresh@reddytransports.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Company Name */}
          <div className="space-y-1">
            <label
              htmlFor="owner-company"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Building className="w-3 h-3 text-[#f16623]" />
              Company Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="owner-company"
              type="text"
              required
              placeholder="e.g. Reddy Fleet Services Pvt Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: GST Number (Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="owner-gst"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Receipt className="w-3 h-3 text-slate-400" />
                GST Number
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>
            <input
              id="owner-gst"
              type="text"
              placeholder="e.g. 36AAACR1234F1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
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
                  <span>Save Owner</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
