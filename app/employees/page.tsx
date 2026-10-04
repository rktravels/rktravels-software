"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UserCog,
  User,
  Phone,
  Mail,
  MapPin,
  Home,
  IndianRupee,
  CalendarCheck,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  RefreshCw,
  PhoneCall,
  UploadCloud,
  Briefcase,
  Route,
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
import { SearchableSelect } from "@/components/SearchableSelect";

interface EmployeeItem {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  city: string;
  address: string;
  travelId?: string;
  travelName?: string;
  salaryType: "Monthly" | "Daily";
  salaryAmount: number | string;
  acceptedLeaves: string;
  photoUrl?: string;
  createdAt?: Timestamp | null;
}

interface TravelOption {
  id: string;
  travelName: string;
  mobileNumber?: string;
}

export default function EmployeesPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [selectedTravelId, setSelectedTravelId] = useState("");
  const [selectedTravelName, setSelectedTravelName] = useState("");
  const [salaryType, setSalaryType] = useState<"Monthly" | "Daily">("Monthly");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [acceptedLeaves, setAcceptedLeaves] = useState("2 Days / Month");

  // Dynamic Travels list from Firestore
  const [travelsList, setTravelsList] = useState<TravelOption[]>([]);

  // Image Upload State (ImageKit)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Page Data & Filters
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Entities / Travels Collections for "Select Travels" dropdown
  useEffect(() => {
    let unsubs: Array<() => void> = [];
    const entityMap = new Map<string, TravelOption>();

    const updateCombined = () => {
      setTravelsList(Array.from(entityMap.values()));
    };

    try {
      // Primary: entities collection
      const qEntities = query(collection(db, "entities"), orderBy("createdAt", "desc"));
      const unsubEntities = onSnapshot(
        qEntities,
        (snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            entityMap.set(docSnap.id, {
              id: docSnap.id,
              travelName: data.entityName || data.travelName || "Unnamed Entity",
              mobileNumber: data.mobileNumber || "",
            });
          });
          updateCombined();
        },
        (err) => {
          console.warn("Entities query error, falling back:", err);
          const fallback = query(collection(db, "entities"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            snap.docs.forEach((docSnap) => {
              const data = docSnap.data();
              entityMap.set(docSnap.id, {
                id: docSnap.id,
                travelName: data.entityName || data.travelName || "Unnamed Entity",
                mobileNumber: data.mobileNumber || "",
              });
            });
            updateCombined();
          });
          unsubs.push(unsubFallback);
        }
      );
      unsubs.push(unsubEntities);

      // Secondary: legacy travels collection
      const qTravels = query(collection(db, "travels"), orderBy("createdAt", "desc"));
      const unsubTravels = onSnapshot(
        qTravels,
        (snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            if (!entityMap.has(docSnap.id)) {
              const data = docSnap.data();
              entityMap.set(docSnap.id, {
                id: docSnap.id,
                travelName: data.entityName || data.travelName || "Unnamed Entity",
                mobileNumber: data.mobileNumber || "",
              });
            }
          });
          updateCombined();
        },
        (err) => {
          console.warn("Travels listener error:", err);
        }
      );
      unsubs.push(unsubTravels);
    } catch (err) {
      console.error("Failed to load entities in employees:", err);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  // 2. Subscribe to real-time employees collection in Firestore
  useEffect(() => {
    try {
      const q = query(
        collection(db, "employees"),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: EmployeeItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<EmployeeItem, "id">),
          }));
          setEmployees(items);
          setLoading(false);
        },
        (err) => {
          console.error("Employees listener error, falling back:", err);
          const fallback = query(collection(db, "employees"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: EmployeeItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<EmployeeItem, "id">),
            }));
            setEmployees(items);
            setLoading(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to initialize employees listener:", err);
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFeedback({
          type: "error",
          message: "Photo size should be less than 10MB.",
        });
        return;
      }
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim();
    const trimmedCity = city.trim();
    const trimmedAddress = address.trim();
    const trimmedLeaves = acceptedLeaves.trim();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter employee name." });
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

    if (!selectedTravelId) {
      setFeedback({
        type: "error",
        message: "Please select an assigned Travels / Agency for this employee.",
      });
      return;
    }

    if (!trimmedCity) {
      setFeedback({ type: "error", message: "Please enter employee city." });
      return;
    }

    if (!trimmedAddress) {
      setFeedback({ type: "error", message: "Please enter full address." });
      return;
    }

    if (!salaryAmount || isNaN(Number(salaryAmount))) {
      setFeedback({
        type: "error",
        message: `Please enter a valid ${salaryType === "Monthly" ? "monthly salary" : "daily wage"} amount.`,
      });
      return;
    }

    setIsSubmitting(true);
    let finalPhotoUrl = "";

    try {
      // Step 1: Upload photo to ImageKit if provided
      if (selectedFile) {
        setUploadProgressText("Uploading employee photo to ImageKit...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("folder", "/employees");
        formData.append(
          "fileName",
          `employee_${trimmedName.replace(/\s+/g, "_")}_${Date.now()}`
        );

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || "ImageKit upload failed");
        }

        finalPhotoUrl = uploadData.url;
      }

      // Step 2: Save to Firestore
      setUploadProgressText("Saving employee details to Firestore...");
      await addDoc(collection(db, "employees"), {
        name: trimmedName,
        mobile: trimmedMobile,
        email: trimmedEmail || null,
        city: trimmedCity,
        address: trimmedAddress,
        travelId: selectedTravelId || null,
        travelName: selectedTravelName || null,
        salaryType,
        salaryAmount: Number(salaryAmount),
        acceptedLeaves: trimmedLeaves || "0",
        photoUrl: finalPhotoUrl || null,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setName("");
      setMobile("");
      setEmail("");
      setCity("");
      setAddress("");
      setSelectedTravelId("");
      setSelectedTravelName("");
      setSalaryType("Monthly");
      setSalaryAmount("");
      setAcceptedLeaves("2 Days / Month");
      handleRemoveImage();

      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Employee "${trimmedName}" has been successfully added to Firestore!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving employee:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save employee.";
      setFeedback({
        type: "error",
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  const handleDelete = async (id: string, empName: string) => {
    if (!confirm(`Are you sure you want to delete employee "${empName}"?`))
      return;
    try {
      await deleteDoc(doc(db, "employees", id));
      setFeedback({
        type: "success",
        message: `Employee "${empName}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting employee:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete employee record.",
      });
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.mobile?.includes(searchQuery) ||
      e.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.travelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.salaryType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">HUMAN RESOURCES</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Employees</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <UserCog className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Employees Directory & Payroll
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {employees.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage staff profiles, travel assignment, addresses, compensation & leave allowances
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Employee Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee, travel, city..."
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
            <span>Add Employee</span>
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

      {/* Employees Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Staff & Employee Records
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredEmployees.length} employee{filteredEmployees.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading employees from Firestore...</span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <UserCog className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching employees found" : "No employees added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different name, city, or travel."
                : "Click on 'Add Employee' to select travel, address details, compensation structure, and photo."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Employee</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium w-12">Photo</th>
                  <th className="py-2 px-3 font-medium">Employee Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">Assigned Travels</th>
                  <th className="py-2 px-3 font-medium">Email</th>
                  <th className="py-2 px-3 font-medium">City & Address</th>
                  <th className="py-2 px-3 font-medium">Compensation</th>
                  <th className="py-2 px-3 font-medium">Accepted Leaves</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp, index) => {
                  let dateStr = "Just now";
                  if (emp.createdAt && typeof emp.createdAt.toDate === "function") {
                    dateStr = emp.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>

                      {/* Photo / Avatar */}
                      <td className="py-2 px-3">
                        {emp.photoUrl ? (
                          <div className="w-8 h-8 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
                            <img
                              src={emp.photoUrl}
                              alt={emp.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-[6px] bg-[#f16623]/10 text-[#f16623] border border-[#f16623]/20 flex items-center justify-center font-medium text-xs">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* Name */}
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-900 text-xs block">
                          {emp.name}
                        </span>
                      </td>

                      {/* Mobile */}
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {emp.mobile}
                        </span>
                      </td>

                      {/* Assigned Travels */}
                      <td className="py-2 px-3">
                        {emp.travelName ? (
                          <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1 max-w-[140px] truncate">
                            <Route className="w-3 h-3 shrink-0" />
                            <span className="truncate">{emp.travelName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        {emp.email || (
                          <span className="text-slate-300 italic text-[10px]">—</span>
                        )}
                      </td>

                      {/* City & Address */}
                      <td className="py-2 px-3 max-w-[180px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#f16623]" />
                            {emp.city}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal truncate" title={emp.address}>
                            {emp.address}
                          </span>
                        </div>
                      </td>

                      {/* Compensation (Monthly / Daily) */}
                      <td className="py-2 px-3">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 text-[11px] font-normal border border-slate-200/80">
                          <span className="font-mono font-medium text-slate-900">
                            ₹{Number(emp.salaryAmount).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            /{emp.salaryType === "Monthly" ? "mo" : "day"}
                          </span>
                        </div>
                      </td>

                      {/* Accepted Leaves */}
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded-[3px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 text-[10px] font-medium">
                          {emp.acceptedLeaves || "0"}
                        </span>
                      </td>

                      {/* Added Date */}
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`tel:${emp.mobile}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call employee"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDelete(emp.id, emp.name)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition cursor-pointer"
                            title="Delete employee"
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

      {/* Right Side Off-Canvas Drawer for Adding Employee */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        title="Add New Employee"
        subtitle="Staff identity, assigned travels, compensation & leaves"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-3.5">
          {/* Field: Select Travels Assignment */}
          <div className="space-y-1">
            <label
              htmlFor="emp-travel"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Route className="w-3 h-3 text-[#f16623]" />
              Select Travels / Agency <span className="text-[#f16623]">*</span>
            </label>
            <SearchableSelect
              id="emp-travel"
              options={travelsList.map((t) => ({
                value: t.id,
                label: t.travelName,
                subLabel: t.mobileNumber,
              }))}
              value={selectedTravelId}
              onChange={(val) => {
                setSelectedTravelId(val);
                const found = travelsList.find((t) => t.id === val);
                setSelectedTravelName(found ? found.travelName : "");
              }}
              placeholder="Select Travels / Agency..."
            />
            {travelsList.length === 0 && (
              <p className="text-[10px] text-slate-400">
                No entities registered yet. Add entities in the{" "}
                <Link href="/entities" className="text-[#f16623] underline">
                  Entities page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Field 1: Employee Name */}
          <div className="space-y-1">
            <label
              htmlFor="emp-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <User className="w-3 h-3 text-[#f16623]" />
              Employee Full Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="emp-name"
              type="text"
              required
              placeholder="e.g. Ananya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 2: Mobile Number */}
          <div className="space-y-1">
            <label
              htmlFor="emp-mobile"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#f16623]" />
              Mobile Number <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="emp-mobile"
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 3: Email (Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="emp-email"
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
              id="emp-email"
              type="email"
              placeholder="e.g. ananya@rktravels.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 4: City */}
          <div className="space-y-1">
            <label
              htmlFor="emp-city"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <MapPin className="w-3 h-3 text-[#f16623]" />
              City <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="emp-city"
              type="text"
              required
              placeholder="e.g. Hyderabad / Vijayawada"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 5: Full Address */}
          <div className="space-y-1">
            <label
              htmlFor="emp-address"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Home className="w-3 h-3 text-[#f16623]" />
              Full Address <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="emp-address"
              type="text"
              required
              placeholder="e.g. Flat 302, Sai Residency, Ameerpet, Hyderabad"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 6 & 7: Salary Type (Monthly or Daily) and Amount */}
          <div className="p-3 bg-slate-50/80 rounded-[6px] border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-[#f16623]" />
                Wage Type <span className="text-[#f16623]">*</span>
              </label>

              {/* Toggle Buttons: Monthly vs Daily */}
              <div className="flex items-center bg-white p-0.5 rounded-[4px] border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSalaryType("Monthly")}
                  className={`h-[24px] px-2.5 rounded-[3px] text-[11px] font-medium transition cursor-pointer ${
                    salaryType === "Monthly"
                      ? "bg-[#f16623] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSalaryType("Daily")}
                  className={`h-[24px] px-2.5 rounded-[3px] text-[11px] font-medium transition cursor-pointer ${
                    salaryType === "Daily"
                      ? "bg-[#f16623] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Daily
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="emp-salary"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <IndianRupee className="w-3 h-3 text-[#f16623]" />
                {salaryType === "Monthly"
                  ? "Monthly Salary (₹)"
                  : "Daily Wage Rate (₹)"}{" "}
                <span className="text-[#f16623]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  ₹
                </span>
                <input
                  id="emp-salary"
                  type="number"
                  min="0"
                  required
                  placeholder={
                    salaryType === "Monthly"
                      ? "e.g. 25000"
                      : "e.g. 850"
                  }
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-6 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                />
              </div>
            </div>
          </div>

          {/* Field 8: Accepted Leaves */}
          <div className="space-y-1">
            <label
              htmlFor="emp-leaves"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <CalendarCheck className="w-3 h-3 text-[#f16623]" />
              Accepted Leaves Allowance <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="emp-leaves"
              type="text"
              required
              placeholder="e.g. 2 Days / Month or 18 Days / Year"
              value={acceptedLeaves}
              onChange={(e) => setAcceptedLeaves(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 9: Employee Photo (ImageKit) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#f16623]" />
                Employee Photo (ImageKit)
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="employee-photo-upload"
            />

            {imagePreview ? (
              <div className="relative w-full h-32 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-900 group shadow-xs">
                <img
                  src={imagePreview}
                  alt="Employee Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-2.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-black/60 hover:bg-rose-600/90 text-white text-xs font-normal backdrop-blur-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-[11px] text-white font-medium truncate">
                        {selectedFile?.name}
                      </p>
                      <p className="text-[10px] text-slate-300 font-normal">
                        {(Number(selectedFile?.size || 0) / 1024).toFixed(0)} KB • Ready for ImageKit
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-[28px] max-h-[34px] px-2.5 rounded-[6px] bg-white/90 hover:bg-white text-slate-800 text-[11px] font-medium shadow-xs transition shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3 rounded-[6px] border border-dashed border-slate-300 hover:border-[#f16623] bg-gradient-to-b from-slate-50/70 to-slate-100/40 hover:from-orange-50/30 transition-all cursor-pointer flex items-center gap-3 group"
              >
                <div className="w-9 h-9 rounded-[6px] bg-white border border-slate-200 group-hover:border-[#f16623]/40 text-slate-400 group-hover:text-[#f16623] flex items-center justify-center shrink-0 shadow-2xs transition-colors">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700 group-hover:text-[#f16623] transition-colors">
                      Choose employee photo
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      (Click here)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                    JPG, PNG, WebP up to 10MB • Auto-uploaded to ImageKit
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Progress message if submitting */}
          {isSubmitting && uploadProgressText && (
            <div className="flex items-center gap-2 p-2 rounded-[6px] bg-orange-50 border border-orange-200/60 text-xs text-[#f16623] font-normal">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{uploadProgressText}</span>
            </div>
          )}

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
                  <span>Save Employee</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
