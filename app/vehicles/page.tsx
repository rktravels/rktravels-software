"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Car,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ImageIcon,
  X,
  ExternalLink,
  Fuel,
  Users2,
  ShieldCheck,
  Route,
  Camera,
  Eye,
  RefreshCw,
  Tags,
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

interface VehicleItem {
  id: string;
  vehicleName: string;
  regNumber: string;
  category: string;
  travelId?: string;
  travelName?: string;
  seatingCapacity?: string;
  fuelType?: string;
  status?: string;
  imageUrl?: string;
  createdAt?: Timestamp | null;
}

interface TravelOption {
  id: string;
  travelName: string;
  mobileNumber?: string;
}

const CATEGORIES = [
  "Sedan",
  "SUV",
  "Luxury SUV",
  "Tempo Traveller",
  "Mini Bus",
  "Coach Bus",
  "Hatchback",
];

const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "Electric", "Hybrid"];

const STATUS_OPTIONS = ["Active", "In Service", "Under Maintenance", "Standby"];

export default function VehiclesPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [category, setCategory] = useState("SUV");
  const [selectedTravelId, setSelectedTravelId] = useState("");
  const [selectedTravelName, setSelectedTravelName] = useState("");
  const [seatingCapacity, setSeatingCapacity] = useState("7+1 Seater");
  const [fuelType, setFuelType] = useState("Diesel");
  const [status, setStatus] = useState("Active");

  // Travels list from Firestore
  const [travelsList, setTravelsList] = useState<TravelOption[]>([]);

  // Image Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview Modal for Table Image View
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalTitle, setPreviewModalTitle] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time travels collection for "Choose Travels" dropdown
  useEffect(() => {
    try {
      const travelsQuery = query(
        collection(db, "travels"),
        orderBy("createdAt", "desc")
      );
      const unsubTravels = onSnapshot(
        travelsQuery,
        (snapshot) => {
          const items: TravelOption[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            travelName: docSnap.data().travelName || "Unnamed Travel",
            mobileNumber: docSnap.data().mobileNumber || "",
          }));
          setTravelsList(items);
        },
        (err) => {
          console.error("Travels dropdown listener error, falling back:", err);
          const fallbackQuery = query(collection(db, "travels"));
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: TravelOption[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              travelName: docSnap.data().travelName || "Unnamed Travel",
              mobileNumber: docSnap.data().mobileNumber || "",
            }));
            setTravelsList(items);
          });
          return () => fallbackUnsub();
        }
      );
      return () => unsubTravels();
    } catch (err) {
      console.error("Failed to load travels list:", err);
    }
  }, []);

  // Subscribe to real-time vehicles collection in Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: VehicleItem[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<VehicleItem, "id">),
          }));
          setVehicles(items);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore read error, falling back:", error);
          const fallbackQuery = query(collection(db, "vehicles"));
          const fallbackUnsub = onSnapshot(fallbackQuery, (snapshot) => {
            const items: VehicleItem[] = snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as Omit<VehicleItem, "id">),
            }));
            setVehicles(items);
            setLoading(false);
          });
          return () => fallbackUnsub();
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to initialize vehicles listener:", err);
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFeedback({
          type: "error",
          message: "Image file size should be less than 10MB.",
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

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = vehicleName.trim();
    const trimmedReg = regNumber.trim().toUpperCase();

    if (!trimmedName) {
      setFeedback({ type: "error", message: "Please enter vehicle name." });
      return;
    }

    if (!trimmedReg) {
      setFeedback({ type: "error", message: "Please enter registration number." });
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = "";

    try {
      // Step 1: Upload image to ImageKit if selected
      if (selectedFile) {
        setUploadProgressText("Uploading vehicle image to ImageKit...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "fileName",
          `${trimmedReg.replace(/\s+/g, "_")}_${Date.now()}`
        );

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(uploadData.error || "ImageKit upload failed");
        }

        finalImageUrl = uploadData.url;
      }

      // Step 2: Save Vehicle details to Firestore
      setUploadProgressText("Saving vehicle details to Firestore...");
      await addDoc(collection(db, "vehicles"), {
        vehicleName: trimmedName,
        regNumber: trimmedReg,
        category,
        travelId: selectedTravelId || null,
        travelName: selectedTravelName || null,
        seatingCapacity: seatingCapacity || null,
        fuelType: fuelType || null,
        status: status || "Active",
        imageUrl: finalImageUrl || null,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setVehicleName("");
      setRegNumber("");
      setSelectedTravelId("");
      setSelectedTravelName("");
      setCategory("SUV");
      setSeatingCapacity("7+1 Seater");
      setFuelType("Diesel");
      setStatus("Active");
      handleRemoveImage();

      setIsOffCanvasOpen(false);
      setFeedback({
        type: "success",
        message: `Vehicle "${trimmedName}" (${trimmedReg}) successfully added!`,
      });

      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving vehicle:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to save vehicle.";
      setFeedback({
        type: "error",
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete vehicle "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, "vehicles", id));
      setFeedback({
        type: "success",
        message: `Vehicle "${name}" was deleted.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete vehicle record.",
      });
    }
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.vehicleName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.regNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.travelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.fuelType?.toLowerCase().includes(searchQuery.toLowerCase())
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
        <span className="text-[#f16623] font-medium">Vehicles</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Vehicles Fleet Directory
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {vehicles.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage fleet vehicles, assigned travels, ImageKit photos & Firestore records
            </p>
          </div>
        </div>

        {/* Right side controls: Search & Add Vehicle Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vehicle, travel, plate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          <Link
            href="/vehicle-categories"
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition flex items-center gap-1.5 shrink-0"
          >
            <Tags className="w-3.5 h-3.5 text-slate-500" />
            <span>Categories</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsOffCanvasOpen(true)}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Vehicle</span>
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

      {/* Vehicles Data Table Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Registered Fleet Vehicles
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {filteredVehicles.length} vehicle{filteredVehicles.length === 1 ? "" : "s"} found
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading fleet from Firestore...</span>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Car className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching vehicles found" : "No vehicles added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different vehicle name, category, or plate number."
                : "Click on 'Add Vehicle' to select travel, upload vehicle photo to ImageKit, and save."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => setIsOffCanvasOpen(true)}
                className="mt-3 h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 w-10 text-center font-medium">#</th>
                  <th className="py-2 px-3 font-medium w-16">Vehicle Photo</th>
                  <th className="py-2 px-3 font-medium">Vehicle Name</th>
                  <th className="py-2 px-3 font-medium">Plate Number</th>
                  <th className="py-2 px-3 font-medium">Travels / Agency</th>
                  <th className="py-2 px-3 font-medium">Type / Category</th>
                  <th className="py-2 px-3 font-medium">Capacity</th>
                  <th className="py-2 px-3 font-medium">Fuel</th>
                  <th className="py-2 px-3 font-medium">Status</th>
                  <th className="py-2 px-3 font-medium">Added Date</th>
                  <th className="py-2 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.map((v, index) => {
                  let dateStr = "Just now";
                  if (v.createdAt && typeof v.createdAt.toDate === "function") {
                    dateStr = v.createdAt.toDate().toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });
                  }

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-orange-50/30 transition-colors group"
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {index + 1}
                      </td>

                      {/* Photo Thumbnail with sleek styling */}
                      <td className="py-2 px-3">
                        {v.imageUrl ? (
                          <div
                            onClick={() => {
                              setPreviewModalUrl(v.imageUrl || null);
                              setPreviewModalTitle(`${v.vehicleName} (${v.regNumber})`);
                            }}
                            className="relative w-12 h-9 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-100 shadow-2xs group/img cursor-pointer transition hover:border-[#f16623]"
                            title="Click to view image"
                          >
                            <img
                              src={v.imageUrl}
                              alt={v.vehicleName}
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-9 rounded-[6px] bg-orange-50/60 border border-orange-100 flex items-center justify-center text-[#f16623]">
                            <Car className="w-4 h-4 opacity-70" />
                          </div>
                        )}
                      </td>

                      {/* Vehicle Name */}
                      <td className="py-2 px-3">
                        <span className="font-medium text-slate-900 text-xs block truncate max-w-[170px]">
                          {v.vehicleName}
                        </span>
                      </td>

                      {/* Plate Number */}
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-800 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-[3px] text-[11px] font-normal tracking-wide inline-block">
                          {v.regNumber}
                        </span>
                      </td>

                      {/* Assigned Travel */}
                      <td className="py-2 px-3">
                        {v.travelName ? (
                          <span className="px-2 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] border border-[#f16623]/20 font-medium text-[11px] inline-flex items-center gap-1 max-w-[140px] truncate">
                            <Route className="w-3 h-3 shrink-0" />
                            <span className="truncate">{v.travelName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-normal italic">
                            Not assigned
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3 text-slate-700 text-xs font-normal">
                        <span className="px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-[10px] text-slate-600">
                          {v.category}
                        </span>
                      </td>

                      {/* Capacity */}
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        {v.seatingCapacity || "—"}
                      </td>

                      {/* Fuel */}
                      <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">
                        {v.fuelType || "—"}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded-[3px] text-[10px] font-normal ${
                            v.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : v.status === "Under Maintenance"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {v.status || "Active"}
                        </span>
                      </td>

                      {/* Added Date */}
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-normal">
                        {dateStr}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {v.imageUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewModalUrl(v.imageUrl || null);
                                setPreviewModalTitle(`${v.vehicleName} (${v.regNumber})`);
                              }}
                              className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-[#f16623] border border-slate-200 hover:border-orange-200 text-[11px] inline-flex items-center gap-1 font-normal transition cursor-pointer"
                              title="View photo"
                            >
                              <ImageIcon className="w-3 h-3" />
                              <span className="hidden sm:inline">Photo</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(v.id, v.vehicleName)}
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 flex items-center justify-center transition cursor-pointer"
                            title="Delete vehicle"
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

      {/* Right Side Off-Canvas Drawer for Adding Vehicle */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        title="Add New Vehicle"
        subtitle="Associate travel operator, vehicle specs, and ImageKit photo"
      >
        <form onSubmit={handleSaveVehicle} className="space-y-3.5">
          {/* Field: Choose Travels */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="veh-travel"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Route className="w-3 h-3 text-[#f16623]" />
                Choose Travels / Agency
              </label>
              <span className="text-[10px] text-slate-400 font-normal italic">
                Optional
              </span>
            </div>
            <select
              id="veh-travel"
              value={selectedTravelId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTravelId(val);
                const found = travelsList.find((t) => t.id === val);
                setSelectedTravelName(found ? found.travelName : "");
              }}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              <option value="">-- Select Travel / Agency --</option>
              {travelsList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.travelName} {t.mobileNumber ? `(${t.mobileNumber})` : ""}
                </option>
              ))}
            </select>
            {travelsList.length === 0 && (
              <p className="text-[10px] text-slate-400">
                No external travels registered yet. You can add them in the{" "}
                <Link href="/travels" className="text-[#f16623] underline">
                  Travels page
                </Link>
                .
              </p>
            )}
          </div>

          {/* Field: Vehicle Name & Model */}
          <div className="space-y-1">
            <label
              htmlFor="veh-name"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <Car className="w-3 h-3 text-[#f16623]" />
              Vehicle Name & Model <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="veh-name"
              type="text"
              required
              placeholder="e.g. Toyota Innova Crysta 2.4 VX"
              value={vehicleName}
              onChange={(e) => setVehicleName(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Registration Number */}
          <div className="space-y-1">
            <label
              htmlFor="veh-reg"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3 text-[#f16623]" />
              Vehicle Number / Plate <span className="text-[#f16623]">*</span>
            </label>
            <input
              id="veh-reg"
              type="text"
              required
              placeholder="e.g. TS 09 UA 5678"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-3 text-xs uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Field: Category / Type */}
          <div className="space-y-1">
            <label
              htmlFor="veh-cat"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
            >
              Vehicle Category <span className="text-[#f16623]">*</span>
            </label>
            <select
              id="veh-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Two Columns: Seating Capacity & Fuel Type */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label
                htmlFor="veh-seats"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Users2 className="w-3 h-3 text-slate-400" />
                Seating
              </label>
              <input
                id="veh-seats"
                type="text"
                placeholder="e.g. 7+1 Seater"
                value={seatingCapacity}
                onChange={(e) => setSeatingCapacity(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="veh-fuel"
                className="text-[10px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1"
              >
                <Fuel className="w-3 h-3 text-slate-400" />
                Fuel Type
              </label>
              <select
                id="veh-fuel"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Field: Vehicle Status */}
          <div className="space-y-1">
            <label
              htmlFor="veh-status"
              className="text-[10px] font-medium text-slate-600 uppercase tracking-wider"
            >
              Operational Status
            </label>
            <select
              id="veh-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Premium Vehicle Image Upload Card (ImageKit) */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#f16623]" />
                Vehicle Photo (ImageKit)
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
              id="vehicle-image-upload"
            />

            {imagePreview ? (
              /* Sleek 16:9 Image Preview Box with Controls */
              <div className="relative w-full h-36 rounded-[6px] overflow-hidden border border-slate-200 bg-slate-900 group shadow-xs">
                <img
                  src={imagePreview}
                  alt="Vehicle Preview"
                  className="w-full h-full object-cover"
                />
                {/* Gradient info overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-2.5">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-black/60 hover:bg-rose-600/90 text-white text-xs font-normal backdrop-blur-xs transition flex items-center gap-1 cursor-pointer"
                      title="Remove image"
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
                        {(Number(selectedFile?.size || 0) / 1024).toFixed(0)} KB • Ready to upload to ImageKit
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
              /* Sleek Minimal Upload Box */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3.5 rounded-[6px] border border-dashed border-slate-300 hover:border-[#f16623] bg-gradient-to-b from-slate-50/70 to-slate-100/40 hover:from-orange-50/30 hover:to-orange-50/10 transition-all cursor-pointer flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-[6px] bg-white border border-slate-200 group-hover:border-[#f16623]/40 text-slate-400 group-hover:text-[#f16623] flex items-center justify-center shrink-0 shadow-2xs transition-colors">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700 group-hover:text-[#f16623] transition-colors">
                      Choose vehicle image
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

          {/* Upload Progress Status if submitting */}
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
                  <span>Save Vehicle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* Image Preview Lightbox Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative bg-white rounded-[6px] max-w-2xl w-full p-2.5 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-medium text-slate-800 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-[#f16623]" />
                {previewModalTitle || "Vehicle Image Preview"}
              </span>
              <div className="flex items-center gap-1.5">
                <a
                  href={previewModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs inline-flex items-center gap-1 font-normal"
                >
                  <span>Open Full</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalUrl(null)}
                  className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 flex items-center justify-center bg-slate-900/5 rounded-[4px] mt-2">
              <img
                src={previewModalUrl}
                alt="Enlarged Vehicle"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-[4px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
