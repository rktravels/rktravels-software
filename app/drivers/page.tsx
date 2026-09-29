"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  UserCheck,
  User,
  Phone,
  CreditCard,
  Route,
  Car,
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
  IdCard,
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

interface DriverItem {
  id: string;
  name: string;
  mobile: string;
  licenseNumber: string;
  travelId?: string;
  travelName?: string;
  vehicleId?: string;
  vehicleName?: string;
  vehicleRegNumber?: string;
  status?: string;
  photoUrl?: string;
  createdAt?: Timestamp | null;
}

interface TravelOption {
  id: string;
  travelName: string;
  mobileNumber?: string;
}

interface VehicleOption {
  id: string;
  vehicleName: string;
  regNumber: string;
  travelId?: string;
}

const DRIVER_STATUS_OPTIONS = ["Available", "On Trip", "Active", "Off Duty"];

export default function DriversPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [selectedTravelId, setSelectedTravelId] = useState("");
  const [selectedTravelName, setSelectedTravelName] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicleName, setSelectedVehicleName] = useState("");
  const [selectedVehicleReg, setSelectedVehicleReg] = useState("");
  const [status, setStatus] = useState("Available");

  // Image Upload State (ImageKit)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Options from Firestore
  const [travelsList, setTravelsList] = useState<TravelOption[]>([]);
  const [vehiclesList, setVehiclesList] = useState<VehicleOption[]>([]);

  // Page Data & Filters
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Travels Collection
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
          console.error("Travels listener error, falling back:", err);
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
      console.error("Failed to load travels:", err);
    }
  }, []);

  // 2. Subscribe to Vehicles Collection
  useEffect(() => {
    try {
      const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: VehicleOption[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            vehicleName: docSnap.data().vehicleName || "Unnamed Vehicle",
            regNumber: docSnap.data().regNumber || "",
            travelId: docSnap.data().travelId || "",
          }));
          setVehiclesList(items);
        },
        (err) => {
          console.error("Vehicles listener error, falling back:", err);
          const fallback = query(collection(db, "vehicles"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: VehicleOption[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              vehicleName: docSnap.data().vehicleName || "Unnamed Vehicle",
              regNumber: docSnap.data().regNumber || "",
              travelId: docSnap.data().travelId || "",
            }));
            setVehiclesList(items);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to load vehicles:", err);
    }
  }, []);

  // 3. Subscribe to Drivers Collection
  useEffect(() => {
    try {
      const q = query(collection(db, "drivers"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: DriverItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<DriverItem, "id">),
          }));
          setDrivers(items);
          setLoading(false);
        },
        (err) => {
          console.error("Drivers listener error, falling back:", err);
          const fallback = query(collection(db, "drivers"));
          const unsubFallback = onSnapshot(fallback, (snap) => {
            const items: DriverItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<DriverItem, "id">),
            }));
            setDrivers(items);
            setLoading(false);
          });
          return () => unsubFallback();
        }
      );
      return () => unsub();
    } catch (err) {
      console.error("Failed to initialize drivers listener:", err);
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

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = name.trim();
    const trimmedMobile = mobile.trim();
    const trimmedLicense = licenseNumber.trim().toUpperCase();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter driver full name." });
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

    if (!trimmedLicense) {
      setFeedback({
        type: "error",
        message: "Please enter driving license (DL) number.",
      });
      return;
    }

    if (!selectedTravelId) {
      setFeedback({
        type: "error",
        message: "Please assign a Travel / Agency to this driver.",
      });
      return;
    }

    setIsSubmitting(true);
    let finalPhotoUrl = "";

    try {
      // Step 1: Upload photo to ImageKit if provided
      if (selectedFile) {
        setUploadProgressText("Uploading driver photo to ImageKit...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "fileName",
          `driver_${trimmedLicense.replace(/\s+/g, "_")}_${Date.now()}`
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
      setUploadProgressText("Saving driver profile to Firestore...");
      await addDoc(collection(db, "drivers"), {
        name: trimmedName,
        mobile: trimmedMobile,
        licenseNumber: trimmedLicense,
        travelId: selectedTravelId || null,
        travelName: selectedTravelName || null,
        vehicleId: selectedVehicleId || null,
        vehicleName: selectedVehicleName || null,
        vehicleRegNumber: selectedVehicleReg || null,
        status: status || "Available",
        photoUrl: finalPhotoUrl || null,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setName("");
      setMobile("");
      setLicenseNumber("");
      setSelectedTravelId("");
      setSelectedTravelName("");
      setSelectedVehicleId("");
      setSelectedVehicleName("");
      setSelectedVehicleReg("");
      setStatus("Available");
      handleRemoveImage();

      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Driver "${trimmedName}" has been successfully registered and assigned!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving driver:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save driver.";
      setFeedback({
        type: "error",
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  const handleDelete = async (id: string, driverName: string) => {
    if (!confirm(`Are you sure you want to delete driver "${driverName}"?`))
      return;
    try {
      await deleteDoc(doc(db, "drivers", id));
      setFeedback({
        type: "success",
        message: `Driver "${driverName}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting driver:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete driver record.",
      });
    }
  };

  const filteredDrivers = drivers.filter(
    (d) =>
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.mobile?.includes(searchQuery) ||
      d.licenseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.travelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vehicleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.vehicleRegNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-3">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">FLEET & CREW</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Drivers</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Drivers Directory & Assignment
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {drivers.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage commercial drivers, travel assignments, vehicle pairing & duty rosters
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Driver Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search driver, license, vehicle..."
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
            <span>Add Driver</span>
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

      {/* Drivers Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Registered Commercial Drivers
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredDrivers.length} driver{filteredDrivers.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading drivers from Firestore...</span>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <UserCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching drivers found" : "No drivers added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different driver name, mobile number, or license plate."
                : "Click on 'Add Driver' to assign travel, pair vehicle, and save to Firestore."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Driver</span>
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
                  <th className="py-2 px-3 font-medium">Driver Name</th>
                  <th className="py-2 px-3 font-medium">Mobile Number</th>
                  <th className="py-2 px-3 font-medium">License (DL) Number</th>
                  <th className="py-2 px-3 font-medium">Assigned Travels</th>
                  <th className="py-2 px-3 font-medium">Assigned Vehicle</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map((d, index) => {
                  let dateStr = "Just now";
                  if (d.createdAt && typeof d.createdAt.toDate === "function") {
                    dateStr = d.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={d.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>

                      {/* Photo / Avatar */}
                      <td className="py-2 px-3">
                        {d.photoUrl ? (
                          <div className="w-8 h-8 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs">
                            <img
                              src={d.photoUrl}
                              alt={d.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-[6px] bg-[#f16623]/10 text-[#f16623] border border-[#f16623]/20 flex items-center justify-center font-medium text-xs">
                            {d.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </td>

                      {/* Driver Name */}
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-900 text-xs block">
                          {d.name}
                        </span>
                      </td>

                      {/* Mobile */}
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal">
                          {d.mobile}
                        </span>
                      </td>

                      {/* License Number */}
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-800 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-[3px] text-[10px] font-normal tracking-wide">
                          {d.licenseNumber}
                        </span>
                      </td>

                      {/* Assigned Travels */}
                      <td className="py-2 px-3">
                        {d.travelName ? (
                          <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1 max-w-[150px] truncate">
                            <Route className="w-3 h-3 shrink-0" />
                            <span className="truncate">{d.travelName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Assigned Vehicle */}
                      <td className="py-2 px-3">
                        {d.vehicleRegNumber ? (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-800 text-[11px] font-normal border border-slate-200">
                            <Car className="w-3 h-3 text-[#f16623]" />
                            <span className="font-medium">{d.vehicleName}</span>
                            <span className="font-mono text-[10px] text-slate-500">
                              ({d.vehicleRegNumber})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            No vehicle paired
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-normal ${
                            d.status === "Available"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : d.status === "On Trip"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : d.status === "Active"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {d.status || "Available"}
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
                            href={`tel:${d.mobile}`}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                            title="Call driver"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="hidden sm:inline">Call</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDelete(d.id, d.name)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition cursor-pointer"
                            title="Delete driver"
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

      {/* Right Side Off-Canvas Drawer for Adding Driver */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        title="Add New Driver"
        subtitle="Register driver, assign travel operator and paired vehicle"
      >
        <form onSubmit={handleSaveDriver} className="space-y-3.5">
          {/* Field 1: Driver Full Name */}
          <div className="space-y-1">
            <label
              htmlFor="driver-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <User className="w-3 h-3 text-[#f16623]" />
              Driver Full Name <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="driver-name"
              type="text"
              required
              placeholder="e.g. Rajesh Goud"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 2: Mobile Number */}
          <div className="space-y-1">
            <label
              htmlFor="driver-mobile"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Phone className="w-3 h-3 text-[#f16623]" />
              Mobile Number <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="driver-mobile"
              type="tel"
              required
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 3: Driving License Number */}
          <div className="space-y-1">
            <label
              htmlFor="driver-license"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <IdCard className="w-3 h-3 text-[#f16623]" />
              Driving License (DL) Number <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="driver-license"
              type="text"
              required
              placeholder="e.g. TS09 20210012345"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field 4: Travels Assignment (Required) */}
          <div className="space-y-1">
            <label
              htmlFor="driver-travel"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Route className="w-3 h-3 text-[#f16623]" />
              Travels Assignment <span className="text-[#f16623]">*</span>
            </label>
            <select
              id="driver-travel"
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
              <option value="">-- Choose Assigned Travels --</option>
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

          {/* Field 5: Vehicle Assignment (Required / Optional) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="driver-vehicle"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Car className="w-3 h-3 text-[#f16623]" />
                Vehicle Assignment
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>
            <select
              id="driver-vehicle"
              value={selectedVehicleId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedVehicleId(val);
                const found = vehiclesList.find((v) => v.id === val);
                if (found) {
                  setSelectedVehicleName(found.vehicleName);
                  setSelectedVehicleReg(found.regNumber);
                } else {
                  setSelectedVehicleName("");
                  setSelectedVehicleReg("");
                }
              }}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              <option value="">-- Select Assigned Vehicle --</option>
              {vehiclesList.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicleName} ({v.regNumber})
                </option>
              ))}
            </select>
            {vehiclesList.length === 0 && (
              <p className="text-[10px] text-slate-400">
                No vehicles registered yet. Add vehicles in the{" "}
                <Link href="/vehicles" className="text-[#f16623] underline">
                  Vehicles page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Field 6: Status */}
          <div className="space-y-1">
            <label
              htmlFor="driver-status"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
            >
              Driver Availability Status
            </label>
            <select
              id="driver-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              {DRIVER_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Field 7: Driver Photo (ImageKit) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#f16623]" />
                Driver Photo (ImageKit)
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
              id="driver-photo-upload"
            />

            {imagePreview ? (
              <div className="relative w-full h-32 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-900 group shadow-xs">
                <img
                  src={imagePreview}
                  alt="Driver Preview"
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
                      Choose driver photo
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
                  <span>Save Driver</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>
    </div>
  );
}
