"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  User,
  Phone,
  Mail,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Send,
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

interface CustomerItem {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  createdAt?: Timestamp | null;
}

export default function CustomersPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time customers collection in Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "customers"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: CustomerItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<CustomerItem, "id">),
          }));
          setCustomers(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore read error, falling back:", error);
          const fallbackQuery = query(collection(db, "customers"));
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: CustomerItem[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<CustomerItem, "id">),
            }));
            setCustomers(items);
            setLoading(false);
          });
          return () => fallbackUnsub();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize customers listener:", err);
      setLoading(false);
    }
  }, []);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter customer name." });
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

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "customers"), {
        name: trimmedName,
        mobile: trimmedMobile,
        email: trimmedEmail || null,
        createdAt: serverTimestamp(),
      });

      setName("");
      setMobile("");
      setEmail("");
      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Customer "${trimmedName}" has been successfully added to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving customer to Firestore:", err);
      setFeedback({
        type: "error",
        message: "Failed to save customer. Please check your internet connection.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, customerName: string) => {
    if (!confirm(`Are you sure you want to delete customer "${customerName}"?`)) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      setFeedback({
        type: "success",
        message: `Customer "${customerName}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting customer:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete customer record.",
      });
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.mobile?.includes(searchQuery) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">CRM & CLIENTS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Customers</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Customers Directory
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {customers.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage client records, contact numbers, and travel profiles in Firestore
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Customer Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customers..."
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
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
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

      {/* Customer Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Customer Accounts
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredCustomers.length} customer{filteredCustomers.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading customers from Firestore...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching customers found" : "No customers added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different name, phone, or email address."
                : "Click on 'Add Customer' to open the side panel and save your first customer."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Customer</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium">Customer Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((cust, index) => {
                  let dateStr = "Just now";
                  if (cust.createdAt && typeof cust.createdAt.toDate === "function") {
                    dateStr = cust.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-[3px] bg-[#f16623]/10 text-[#f16623] flex items-center justify-center font-medium text-[10px]">
                            {cust.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900 text-xs">
                            {cust.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {cust.mobile}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        {cust.email || (
                          <span className="text-slate-300 italic text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`tel:${cust.mobile}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call customer"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          {cust.email && (
                            <a
                              href={`mailto:${cust.email}`}
                              className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border border-slate-200 hover:border-sky-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                              title="Email customer"
                            >
                              <Mail className="w-3 h-3" />
                              <span className="hidden sm:inline">Email</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(cust.id, cust.name)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition"
                            title="Delete customer"
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

      {/* Right Side Off-Canvas Drawer for Adding Customer */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title="Add New Customer"
        subtitle="Fill in customer details to store in Firestore"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {/* Field: Customer Name */}
          <div className="space-y-1">
            <label
              htmlFor="cust-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <User className="w-3 h-3 text-[#f16623]" />
              Customer Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="cust-name"
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Mobile Number */}
          <div className="space-y-1">
            <label
              htmlFor="cust-mobile"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#f16623]" />
              Mobile Number <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="cust-mobile"
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
                htmlFor="cust-email"
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
              id="cust-email"
              type="email"
              placeholder="e.g. ramesh@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                  <span>Save Customer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
