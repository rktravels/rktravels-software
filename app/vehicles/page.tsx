"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Car,
  Plus,
  Loader2,
  Trash2,
  Edit2,
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
  Download,
  FileSpreadsheet,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Building,
  Wrench,
  DollarSign,
  Activity,
  FileText,
  Copy,
  ChevronDown,
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
  getDocs,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";

// Indian States with Vehicle Registration Codes
export const INDIAN_STATES = [
  { code: "TS", name: "Telangana" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "KA", name: "Karnataka" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "MH", name: "Maharashtra" },
  { code: "KL", name: "Kerala" },
  { code: "GA", name: "Goa" },
  { code: "DL", name: "Delhi (NCR)" },
  { code: "GJ", name: "Gujarat" },
  { code: "RJ", name: "Rajasthan" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "HR", name: "Haryana" },
  { code: "PB", name: "Punjab" },
  { code: "WB", name: "West Bengal" },
  { code: "OD", name: "Odisha" },
  { code: "CG", name: "Chhattisgarh" },
  { code: "BR", name: "Bihar" },
  { code: "JH", name: "Jharkhand" },
  { code: "UK", name: "Uttarakhand" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "CH", name: "Chandigarh" },
  { code: "PY", name: "Puducherry" },
  { code: "JK", name: "Jammu & Kashmir" },
];

export interface VehicleItem {
  id: string;
  // Tab 1: Profile
  regNumber: string;
  vehicleName: string;
  category: string;
  seatingCapacity: string;
  fuelType: string;
  ownershipType: "Owned" | "Vendor Attached" | "Leased";
  vendorId?: string | null;
  vendorName?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  variant?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  imageUrl?: string | null;

  // Tab 2: Compliance
  fitnessExpiry?: string | null;
  rcExpiry?: string | null;
  insuranceExpiry?: string | null;
  insurancePolicyNumber?: string | null;
  pucExpiry?: string | null;
  quarterlyTaxExpiry?: string | null;
  statePermitExpiry?: string | null;
  nationalPermitExpiry?: string | null;
  registrationState?: string | null;
  registrationCityRto?: string | null;

  // Tab 3: Operations
  odometerBaselineKm?: string | null;
  lastServiceDate?: string | null;
  lastServiceKm?: string | null;
  serviceIntervalKm?: string | null;
  allowedStates?: string[] | null;
  notesRestrictions?: string | null;

  // Tab 4: Financial
  purchaseDate?: string | null;
  purchasePrice?: string | null;
  expenseLedgerRef?: string | null;
  depreciationGroup?: string | null;

  // Tab 5: Status
  status: "Active" | "In Service" | "Under Maintenance" | "Standby";
  isActive: boolean;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

interface VendorOption {
  id: string;
  name: string;
  mobile?: string;
  city?: string;
}

const DEFAULT_CATEGORIES = [
  "Sedan",
  "SUV",
  "Luxury SUV",
  "Tempo Traveller",
  "Mini Bus",
  "Coach Bus",
  "Hatchback",
];

const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "EV", "Hybrid"];
const OWNERSHIP_TYPES = ["Owned", "Vendor Attached", "Leased"] as const;
const STATUS_OPTIONS = ["Active", "In Service", "Under Maintenance", "Standby"] as const;
const DEPRECIATION_GROUPS = [
  "Commercial Passenger Fleet (15%)",
  "Heavy Commercial Vehicles (20%)",
  "Luxury & Premium Assets (25%)",
  "Standard Office Fleet (10%)",
];

// Helper to generate 50 sample vehicles CSV content
function generateSample50VehiclesCSV(): string {
  const headers = [
    "Registration Number",
    "Vehicle Category",
    "Seat Capacity",
    "Fuel Type",
    "Ownership Type",
    "Vendor Name",
    "Manufacturer",
    "Model",
    "Variant",
    "Chassis Number",
    "Engine Number",
    "Fitness Expiry",
    "RC Expiry",
    "PUC Expiry",
    "Insurance Expiry",
    "Insurance Policy Number",
    "Registration State",
    "Registration City RTO",
    "Last Service KM",
    "Service Interval KM",
    "Status",
  ];

  const sampleRows: string[][] = [];

  const modelsByCategory = [
    { cat: "Sedan", mfr: "Maruti Suzuki", mdl: "Dzire", var: "VXi", seats: "4", fuel: "Petrol" },
    { cat: "Sedan", mfr: "Honda", mdl: "Amaze", var: "S MT", seats: "4", fuel: "Diesel" },
    { cat: "SUV", mfr: "Toyota", mdl: "Innova Crysta", var: "2.4 GX", seats: "7", fuel: "Diesel" },
    { cat: "SUV", mfr: "Maruti Suzuki", mdl: "Ertiga", var: "ZXi CNG", seats: "6", fuel: "CNG" },
    { cat: "Luxury SUV", mfr: "Toyota", mdl: "Innova Hycross", var: "ZX Hybrid", seats: "7", fuel: "Hybrid" },
    { cat: "Tempo Traveller", mfr: "Force Motors", mdl: "Urbania", var: "3615 Medium", seats: "12", fuel: "Diesel" },
    { cat: "Tempo Traveller", mfr: "Force Motors", mdl: "Traveller 3050", var: "Super Deluxe", seats: "17", fuel: "Diesel" },
    { cat: "Mini Bus", mfr: "Tata Motors", mdl: "Winger", var: "Skool / Staff", seats: "20", fuel: "Diesel" },
    { cat: "Coach Bus", mfr: "Ashok Leyland", mdl: "Viking", var: "AC Sleeper/Seater", seats: "40", fuel: "Diesel" },
    { cat: "Hatchback", mfr: "Tata Motors", mdl: "Tiago EV", var: "XZ+ Tech LUX", seats: "4", fuel: "EV" },
  ];

  const states = ["TS", "AP", "KA", "MH", "DL", "TN", "GJ"];
  const vendors = ["RK In-House Fleet", "Sri Balaji Tours", "Venkateshwara Travels", "Cityline Express", "Star Cabs"];

  for (let i = 1; i <= 50; i++) {
    const template = modelsByCategory[(i - 1) % modelsByCategory.length];
    const st = states[(i - 1) % states.length];
    const series = String(1000 + i);
    const reg = `${st}09EA${series}`;
    const ownership = i % 3 === 0 ? "Vendor Attached" : i % 5 === 0 ? "Leased" : "Owned";
    const vendor = ownership === "Owned" ? "" : vendors[i % vendors.length];

    const fitnessYear = 2026 + (i % 3);
    const rcYear = 2030 + (i % 5);
    const pucYear = 2026 + (i % 2);
    const insYear = 2026 + (i % 2);

    const fitDate = `${fitnessYear}-0${(i % 9) + 1}-15`;
    const rcDate = `${rcYear}-11-20`;
    const pucDate = `${pucYear}-0${(i % 8) + 2}-10`;
    const insDate = `${insYear}-0${(i % 7) + 3}-25`;

    sampleRows.push([
      reg,
      template.cat,
      template.seats,
      template.fuel,
      ownership,
      vendor,
      template.mfr,
      template.mdl,
      template.var,
      `MAT612${String(100000 + i)}XYZ`,
      `ENG${String(900000 + i)}`,
      fitDate,
      rcDate,
      pucDate,
      insDate,
      `POL-8849${i}21`,
      st,
      `${st}-09 Central RTO`,
      String(25000 + i * 1500),
      "10000",
      i % 7 === 0 ? "In Service" : i % 15 === 0 ? "Under Maintenance" : "Active",
    ]);
  }

  const csvLines = [
    headers.map((h) => `"${h}"`).join(","),
    ...sampleRows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
  ];

  return csvLines.join("\n");
}

export default function VehiclesPage() {
  // Main Fleet state
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  // Dynamic Categories from Firestore
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);

  // Pagination states (Limit: 24 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // OffCanvas Drawer states
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [unlockedTabs, setUnlockedTabs] = useState<number[]>([1]);

  // View Details Drawer state
  const [viewingVehicle, setViewingVehicle] = useState<VehicleItem | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Tab 1 Form States (Profile)
  const [regNumber, setRegNumber] = useState("");
  const [category, setCategory] = useState("Sedan");
  const [seatingCapacity, setSeatingCapacity] = useState("");
  const [fuelType, setFuelType] = useState("Diesel");
  const [ownershipType, setOwnershipType] = useState<"Owned" | "Vendor Attached" | "Leased">("Owned");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [customVendorName, setCustomVendorName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");

  // Image Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2 Form States (Compliance)
  const [fitnessExpiry, setFitnessExpiry] = useState("");
  const [rcExpiry, setRcExpiry] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [pucExpiry, setPucExpiry] = useState("");
  const [quarterlyTaxExpiry, setQuarterlyTaxExpiry] = useState("");
  const [statePermitExpiry, setStatePermitExpiry] = useState("");
  const [nationalPermitExpiry, setNationalPermitExpiry] = useState("");
  const [registrationState, setRegistrationState] = useState("TS");
  const [registrationCityRto, setRegistrationCityRto] = useState("");

  // Tab 3 Form States (Operations)
  const [odometerBaselineKm, setOdometerBaselineKm] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");
  const [lastServiceKm, setLastServiceKm] = useState("");
  const [serviceIntervalKm, setServiceIntervalKm] = useState("");
  const [allowedStates, setAllowedStates] = useState<string[]>(["TS", "AP", "KA", "MH", "TN"]);
  const [notesRestrictions, setNotesRestrictions] = useState("");

  // Tab 4 Form States (Financial)
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [expenseLedgerRef, setExpenseLedgerRef] = useState("");
  const [depreciationGroup, setDepreciationGroup] = useState(DEPRECIATION_GROUPS[0]);

  // Tab 5 Form States (Status)
  const [status, setStatus] = useState<"Active" | "In Service" | "Under Maintenance" | "Standby">("Active");
  const [isActiveToggle, setIsActiveToggle] = useState(true);

  // Registered Vendors / Travels list from Firestore
  const [vendorsList, setVendorsList] = useState<VendorOption[]>([]);
  const [showAddVendorInput, setShowAddVendorInput] = useState(false);

  // Bulk Upload Modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedVehicles, setParsedVehicles] = useState<Partial<VehicleItem>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");

  // Deletion modal
  const [deletingVehicle, setDeletingVehicle] = useState<VehicleItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback & Progress
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [tabError, setTabError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Real-time Firestore Listener with 24 Limit per page
  useEffect(() => {
    try {
      const fetchLimit = Math.max(24, currentPage * 24);
      const q = query(
        collection(db, "vehicles"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
      );

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
          console.error("Firestore vehicles read error:", error);
          const fallbackQuery = query(collection(db, "vehicles"), limit(fetchLimit));
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
  }, [currentPage]);

  // Listen to vehicle categories from Firestore
  useEffect(() => {
    try {
      const q = query(collection(db, "vehicle_categories"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const names = snapshot.docs
          .map((d) => d.data().categoryName as string)
          .filter(Boolean);
        if (names.length > 0) {
          // Merge unique categories with defaults
          const merged = Array.from(new Set([...names, ...DEFAULT_CATEGORIES]));
          setCategoryOptions(merged);
        }
      });
      return () => unsubscribe();
    } catch {
      // Keep defaults
    }
  }, []);

  // Listen to car vendors & lease members from dedicated Firestore collection
  useEffect(() => {
    try {
      const q = query(collection(db, "car_vendors"), orderBy("name", "asc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: VendorOption[] = snapshot.docs.map((d) => ({
            id: d.id,
            name: d.data().name || "Unnamed Vendor",
            mobile: d.data().mobile || "",
            city: d.data().city || "",
          }));
          setVendorsList(list);
        },
        () => {
          // Fallback query if index is building
          const fallbackQ = query(collection(db, "car_vendors"));
          onSnapshot(fallbackQ, (snapshot) => {
            const list: VendorOption[] = snapshot.docs.map((d) => ({
              id: d.id,
              name: d.data().name || "Unnamed Vendor",
              mobile: d.data().mobile || "",
              city: d.data().city || "",
            }));
            setVendorsList(list);
          });
        }
      );
      return () => unsubscribe();
    } catch {
      // Ignored
    }
  }, []);

  // Auto-reset page on search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterCategory]);

  // Open Drawer in Add Mode
  const handleOpenAddDrawer = () => {
    setEditingVehicleId(null);
    setActiveTab(1);
    setUnlockedTabs([1]);
    setTabError(null);

    // Reset Form
    setRegNumber("");
    setCategory(categoryOptions[0] || "Sedan");
    setSeatingCapacity("");
    setFuelType("Diesel");
    setOwnershipType("Owned");
    setSelectedVendorId("");
    setSelectedVendorName("");
    setCustomVendorName("");
    setManufacturer("");
    setModel("");
    setVariant("");
    setChassisNumber("");
    setEngineNumber("");
    setSelectedFile(null);
    setImagePreview(null);
    setExistingImageUrl("");

    setFitnessExpiry("");
    setRcExpiry("");
    setInsuranceExpiry("");
    setInsurancePolicyNumber("");
    setPucExpiry("");
    setQuarterlyTaxExpiry("");
    setStatePermitExpiry("");
    setNationalPermitExpiry("");
    setRegistrationState("TS");
    setRegistrationCityRto("");

    setOdometerBaselineKm("");
    setLastServiceDate("");
    setLastServiceKm("");
    setServiceIntervalKm("");
    setAllowedStates(["TS", "AP", "KA", "MH", "TN"]);
    setNotesRestrictions("");

    setPurchaseDate("");
    setPurchasePrice("");
    setExpenseLedgerRef("");
    setDepreciationGroup(DEPRECIATION_GROUPS[0]);

    setStatus("Active");
    setIsActiveToggle(true);

    setIsOffCanvasOpen(true);
  };

  // Open Drawer in Edit Mode
  const handleOpenEditDrawer = (v: VehicleItem) => {
    setEditingVehicleId(v.id);
    setActiveTab(1);
    setUnlockedTabs([1, 2, 3, 4, 5]); // All tabs accessible when editing
    setTabError(null);

    setRegNumber(v.regNumber || "");
    setCategory(v.category || "Sedan");
    setSeatingCapacity(v.seatingCapacity || "");
    setFuelType(v.fuelType || "Diesel");
    setOwnershipType(v.ownershipType || "Owned");
    setSelectedVendorId(v.vendorId || "");
    setSelectedVendorName(v.vendorName || "");
    setCustomVendorName("");
    setManufacturer(v.manufacturer || "");
    setModel(v.model || "");
    setVariant(v.variant || "");
    setChassisNumber(v.chassisNumber || "");
    setEngineNumber(v.engineNumber || "");
    setSelectedFile(null);
    setImagePreview(v.imageUrl || null);
    setExistingImageUrl(v.imageUrl || "");

    setFitnessExpiry(v.fitnessExpiry || "");
    setRcExpiry(v.rcExpiry || "");
    setInsuranceExpiry(v.insuranceExpiry || "");
    setInsurancePolicyNumber(v.insurancePolicyNumber || "");
    setPucExpiry(v.pucExpiry || "");
    setQuarterlyTaxExpiry(v.quarterlyTaxExpiry || "");
    setStatePermitExpiry(v.statePermitExpiry || "");
    setNationalPermitExpiry(v.nationalPermitExpiry || "");
    setRegistrationState(v.registrationState || "TS");
    setRegistrationCityRto(v.registrationCityRto || "");

    setOdometerBaselineKm(v.odometerBaselineKm || "");
    setLastServiceDate(v.lastServiceDate || "");
    setLastServiceKm(v.lastServiceKm || "");
    setServiceIntervalKm(v.serviceIntervalKm || "10000");
    setAllowedStates(v.allowedStates || ["TS", "AP", "KA", "MH", "TN"]);
    setNotesRestrictions(v.notesRestrictions || "");

    setPurchaseDate(v.purchaseDate || "");
    setPurchasePrice(v.purchasePrice || "");
    setExpenseLedgerRef(v.expenseLedgerRef || "");
    setDepreciationGroup(v.depreciationGroup || DEPRECIATION_GROUPS[0]);

    setStatus(v.status || "Active");
    setIsActiveToggle(typeof v.isActive === "boolean" ? v.isActive : true);

    setIsOffCanvasOpen(true);
  };

  // Image Selection Handler (local preview only; uploads on save)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 8 * 1024 * 1024) {
        setTabError("Image file size exceeds 8MB. Please choose a smaller image.");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setTabError(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setExistingImageUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Tab Validation before Continuing
  const validateTab = (tabIndex: number): boolean => {
    setTabError(null);

    if (tabIndex === 1) {
      if (!regNumber.trim()) {
        setTabError("Please enter vehicle registration number (e.g. TS09EA1234).");
        return false;
      }
      if (!category) {
        setTabError("Please select a vehicle category.");
        return false;
      }
      if (!seatingCapacity.trim() || parseInt(seatingCapacity, 10) < 1) {
        setTabError("Please enter a valid passenger seating capacity (minimum 1).");
        return false;
      }
      if (!fuelType) {
        setTabError("Please select a fuel type.");
        return false;
      }
      if (!ownershipType) {
        setTabError("Please select ownership type.");
        return false;
      }
      if (
        (ownershipType === "Vendor Attached" || ownershipType === "Leased") &&
        !selectedVendorName.trim() &&
        !customVendorName.trim()
      ) {
        setTabError(`Please select or enter the ${ownershipType} vendor/lessor name.`);
        return false;
      }
      return true;
    }

    if (tabIndex === 2) {
      if (!fitnessExpiry) {
        setTabError("Please enter the Fitness Expiry Date.");
        return false;
      }
      if (!rcExpiry) {
        setTabError("Please enter the RC (Registration) Expiry Date.");
        return false;
      }
      if (!pucExpiry) {
        setTabError("Please enter the PUC (Pollution) Expiry Date.");
        return false;
      }
      if (!registrationState) {
        setTabError("Please select the Vehicle Registration State.");
        return false;
      }
      return true;
    }

    if (tabIndex === 3) {
      if (!lastServiceKm.trim()) {
        setTabError("Please enter Last Service KM.");
        return false;
      }
      if (!serviceIntervalKm.trim()) {
        setTabError("Please enter Service Interval KM.");
        return false;
      }
      return true;
    }

    if (tabIndex === 4) {
      return true; // Financial tab optional
    }

    return true;
  };

  // Step Continue Navigation
  const handleContinue = (nextTab: 2 | 3 | 4 | 5) => {
    const currentTab = (nextTab - 1) as 1 | 2 | 3 | 4;
    if (!validateTab(currentTab)) return;

    if (!unlockedTabs.includes(nextTab)) {
      setUnlockedTabs((prev) => [...prev, nextTab]);
    }
    setActiveTab(nextTab);
  };

  // Allowed States toggle helper
  const handleToggleState = (code: string) => {
    setAllowedStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Final Form Submit (Save / Update Vehicle)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setTabError(null);

    // Final checks
    if (!validateTab(1) || !validateTab(2) || !validateTab(3)) {
      return;
    }

    setIsSubmitting(true);
    let finalImageUrl = existingImageUrl;

    try {
      // 1. Upload to ImageKit if user selected a new file
      if (selectedFile) {
        setUploadProgressText("Uploading vehicle image to ImageKit...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "fileName",
          `${regNumber.trim().replace(/\s+/g, "_")}_${Date.now()}`
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

      setUploadProgressText("Saving vehicle details to Firestore...");

      let finalVendorId = selectedVendorId;
      const finalVendor = customVendorName.trim() || selectedVendorName.trim() || null;

      // If user entered a custom vendor name, also save it to car_vendors directory
      if (customVendorName.trim() && (ownershipType === "Vendor Attached" || ownershipType === "Leased")) {
        try {
          const newDoc = await addDoc(collection(db, "car_vendors"), {
            name: customVendorName.trim(),
            mobile: "",
            city: null,
            address: null,
            vendorType: ownershipType === "Leased" ? "Lease Member" : "Car Vendor",
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          finalVendorId = newDoc.id;
        } catch (vErr) {
          console.error("Auto-adding custom vendor failed:", vErr);
        }
      }

      const vehiclePayload: Omit<VehicleItem, "id"> = {
        regNumber: regNumber.trim().toUpperCase(),
        vehicleName: `${manufacturer.trim()} ${model.trim()}`.trim() || regNumber.trim().toUpperCase(),
        category,
        seatingCapacity: `${seatingCapacity.trim()} Seater`,
        fuelType,
        ownershipType,
        vendorId: finalVendorId || null,
        vendorName: finalVendor,
        manufacturer: manufacturer.trim() || null,
        model: model.trim() || null,
        variant: variant.trim() || null,
        chassisNumber: chassisNumber.trim().toUpperCase() || null,
        engineNumber: engineNumber.trim().toUpperCase() || null,
        imageUrl: finalImageUrl || null,

        fitnessExpiry: fitnessExpiry || null,
        rcExpiry: rcExpiry || null,
        insuranceExpiry: insuranceExpiry || null,
        insurancePolicyNumber: insurancePolicyNumber.trim() || null,
        pucExpiry: pucExpiry || null,
        quarterlyTaxExpiry: quarterlyTaxExpiry || null,
        statePermitExpiry: statePermitExpiry || null,
        nationalPermitExpiry: nationalPermitExpiry || null,
        registrationState: registrationState || null,
        registrationCityRto: registrationCityRto.trim() || null,

        odometerBaselineKm: odometerBaselineKm.trim() || null,
        lastServiceDate: lastServiceDate || null,
        lastServiceKm: lastServiceKm.trim() || null,
        serviceIntervalKm: serviceIntervalKm.trim() || null,
        allowedStates: allowedStates.length > 0 ? allowedStates : null,
        notesRestrictions: notesRestrictions.trim() || null,

        purchaseDate: purchaseDate || null,
        purchasePrice: purchasePrice.trim() || null,
        expenseLedgerRef: expenseLedgerRef.trim() || null,
        depreciationGroup: depreciationGroup || null,

        status,
        isActive: isActiveToggle,
        updatedAt: serverTimestamp(),
      };

      if (editingVehicleId) {
        await updateDoc(doc(db, "vehicles", editingVehicleId), vehiclePayload);
        setFeedback({
          type: "success",
          message: `Vehicle "${vehiclePayload.regNumber}" updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "vehicles"), {
          ...vehiclePayload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Vehicle "${vehiclePayload.regNumber}" added to fleet successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving vehicle:", err);
      const msg = err instanceof Error ? err.message : "Failed to save vehicle";
      setTabError(`Submission failed: ${msg}`);
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  // Delete vehicle handler
  const handleConfirmDelete = async () => {
    if (!deletingVehicle) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "vehicles", deletingVehicle.id));
      setFeedback({
        type: "success",
        message: `Vehicle "${deletingVehicle.regNumber}" deleted.`,
      });
      setDeletingVehicle(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting vehicle:", err);
      setFeedback({ type: "error", message: "Failed to delete vehicle." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Download Sample 50 Vehicles CSV
  const handleDownloadSampleFile = () => {
    const csvContent = generateSample50VehiclesCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_50_vehicles.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Bulk CSV Import File
  const handleBulkFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setBulkFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;

      // Simple CSV line parser
      const parseCSVLine = (line: string): string[] => {
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const matches: string[] = [];
        let match;
        while ((match = regex.exec(line))) {
          let val = match[1] || "";
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/""/g, '"');
          }
          matches.push(val.trim());
          if (regex.lastIndex >= line.length) break;
        }
        return matches;
      };

      const parsed: Partial<VehicleItem>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[0]) continue;

        parsed.push({
          regNumber: cols[0].toUpperCase(),
          category: cols[1] || "Sedan",
          seatingCapacity: cols[2] ? `${cols[2]} Seater` : "4 Seater",
          fuelType: cols[3] || "Diesel",
          ownershipType: (cols[4] as "Owned" | "Vendor Attached" | "Leased") || "Owned",
          vendorName: cols[5] || "",
          manufacturer: cols[6] || "",
          model: cols[7] || "",
          variant: cols[8] || "",
          chassisNumber: cols[9] || "",
          engineNumber: cols[10] || "",
          fitnessExpiry: cols[11] || "",
          rcExpiry: cols[12] || "",
          pucExpiry: cols[13] || "",
          insuranceExpiry: cols[14] || "",
          insurancePolicyNumber: cols[15] || "",
          registrationState: cols[16] || "TS",
          registrationCityRto: cols[17] || "",
          lastServiceKm: cols[18] || "25000",
          serviceIntervalKm: cols[19] || "10000",
          status: (cols[20] as "Active" | "In Service" | "Under Maintenance" | "Standby") || "Active",
          isActive: cols[20] !== "Inactive",
          vehicleName: `${cols[6] || ""} ${cols[7] || ""}`.trim() || cols[0].toUpperCase(),
        });
      }

      setParsedVehicles(parsed);
    };
    reader.readAsText(file);
  };

  // Execute Bulk Upload to Firestore with Auto-Creation of missing Categories and Vendors
  const handleExecuteBulkImport = async () => {
    if (parsedVehicles.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    setImportStatusText("Checking existing categories and vendors in database...");

    try {
      // 1. Fetch existing categories
      const catSnap = await getDocs(collection(db, "vehicle_categories"));
      const existingCategoriesMap = new Map<string, string>(); // lowercased categoryName -> id
      catSnap.docs.forEach((d) => {
        const catName = d.data().categoryName as string;
        if (catName) existingCategoriesMap.set(catName.trim().toLowerCase(), d.id);
      });

      // 2. Fetch existing vendors
      const vendorSnap = await getDocs(collection(db, "car_vendors"));
      const existingVendorsMap = new Map<string, string>(); // lowercased vendor name -> id
      vendorSnap.docs.forEach((d) => {
        const vName = d.data().name as string;
        if (vName) existingVendorsMap.set(vName.trim().toLowerCase(), d.id);
      });

      // 3. Scan parsedVehicles for new categories and new vendors
      let newCategoriesCreated = 0;
      let newVendorsCreated = 0;

      for (const item of parsedVehicles) {
        // Auto-create category if missing
        const rawCat = (item.category || "").trim();
        if (rawCat && !existingCategoriesMap.has(rawCat.toLowerCase())) {
          setImportStatusText(`Auto-creating missing category: "${rawCat}"...`);
          const parsedCapacity = parseInt((item.seatingCapacity || "4").replace(/\D/g, ""), 10) || 4;
          const driverCount = 1;
          const totalCapacity = parsedCapacity + driverCount;
          const printName = `${rawCat} (${parsedCapacity}+${driverCount} AC)`;

          const newCatRef = await addDoc(collection(db, "vehicle_categories"), {
            categoryName: rawCat,
            passengerCapacity: parsedCapacity,
            driverCount,
            totalCapacity,
            acType: "AC",
            printName,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          existingCategoriesMap.set(rawCat.toLowerCase(), newCatRef.id);
          newCategoriesCreated++;
        }

        // Auto-create vendor if missing
        const rawVendor = (item.vendorName || "").trim();
        if (
          rawVendor &&
          (item.ownershipType === "Vendor Attached" || item.ownershipType === "Leased" || rawVendor.length > 0) &&
          !existingVendorsMap.has(rawVendor.toLowerCase())
        ) {
          setImportStatusText(`Auto-creating missing vendor: "${rawVendor}"...`);
          const vType = item.ownershipType === "Leased" ? "Lease Member" : "Car Vendor";
          const newVenRef = await addDoc(collection(db, "car_vendors"), {
            name: rawVendor,
            mobile: "",
            email: null,
            city: null,
            address: null,
            vendorType: vType,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          existingVendorsMap.set(rawVendor.toLowerCase(), newVenRef.id);
          newVendorsCreated++;
        }
      }

      // 4. Save each vehicle with matched vendorId
      let count = 0;
      for (const item of parsedVehicles) {
        const rawVendor = (item.vendorName || "").trim();
        const matchedVendorId = rawVendor ? existingVendorsMap.get(rawVendor.toLowerCase()) || null : null;

        setImportStatusText(
          `Saving vehicle ${count + 1} of ${parsedVehicles.length} (${item.regNumber})...`
        );

        await addDoc(collection(db, "vehicles"), {
          ...item,
          vendorId: matchedVendorId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count++;
        setImportProgress(Math.round((count / parsedVehicles.length) * 100));
      }

      // Detailed feedback
      const createdNotes: string[] = [];
      if (newCategoriesCreated > 0) createdNotes.push(`${newCategoriesCreated} new categories`);
      if (newVendorsCreated > 0) createdNotes.push(`${newVendorsCreated} new vendors`);
      const extraMsg = createdNotes.length > 0
        ? ` Auto-created ${createdNotes.join(" and ")} in database!`
        : "";

      setFeedback({
        type: "success",
        message: `Successfully imported ${count} vehicles into fleet!${extraMsg}`,
      });
      setIsBulkModalOpen(false);
      setBulkFile(null);
      setParsedVehicles([]);
      setTimeout(() => setFeedback(null), 6000);
    } catch (err: unknown) {
      console.error("Bulk upload error:", err);
      const msg = err instanceof Error ? err.message : "An error occurred during bulk upload.";
      setFeedback({
        type: "error",
        message: msg,
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatusText("");
    }
  };

  // Filtered vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      v.regNumber?.toLowerCase().includes(q) ||
      v.vehicleName?.toLowerCase().includes(q) ||
      v.category?.toLowerCase().includes(q) ||
      v.fuelType?.toLowerCase().includes(q) ||
      v.vendorName?.toLowerCase().includes(q) ||
      v.registrationState?.toLowerCase().includes(q);

    const matchesStatus =
      filterStatus === "ALL" ||
      (filterStatus === "Active" && v.status === "Active") ||
      (filterStatus === "In Service" && v.status === "In Service") ||
      (filterStatus === "Under Maintenance" && v.status === "Under Maintenance") ||
      (filterStatus === "Standby" && v.status === "Standby");

    const matchesCategory =
      filterCategory === "ALL" || v.category === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Pagination calculation with 24 limit
  const totalFiltered = filteredVehicles.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFiltered);
  const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);

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
          <span className="text-[#f16623] font-medium">Vehicles</span>
        </div>

        {/* Quick Nav to Vehicle Categories */}
        <Link
          href="/vehicle-categories"
          className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#f16623] transition"
        >
          <Tags className="w-3.5 h-3.5" />
          <span>Vehicle Categories</span>
          <ChevronRight className="w-3 h-3 text-slate-400" />
        </Link>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Fleet Vehicles Directory
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {vehicles.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Manage fleet vehicles across 5 compliance sections, bulk upload, and real-time Firestore sync
            </p>
          </div>
        </div>

        {/* Header Right Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search bar */}
          <div className="relative w-full sm:w-52">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plate, category, fuel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Download Sample File button */}
          <button
            type="button"
            onClick={handleDownloadSampleFile}
            className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1.5 shrink-0"
            title="Download Sample 50 Vehicles File"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Sample 50 CSV</span>
          </button>

          {/* Bulk Upload Button */}
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="h-[34px] max-h-[34px] px-2.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1.5 shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bulk Upload</span>
          </button>

          {/* Add Vehicle Button (Opens 5-Tab OffCanvas) */}
          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Vehicle</span>
          </button>
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

      {/* Table Data Card */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table Filter Bar */}
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h2 className="text-xs font-medium text-slate-900">Registered Fleet</h2>
            <span className="text-[11px] text-slate-400 font-normal">
              ({filteredVehicles.length} matching)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-[30px] px-2 text-[11px] bg-white border border-slate-200 rounded-[6px] text-slate-700 font-normal focus:outline-none focus:border-[#f16623]"
            >
              <option value="ALL">All Status</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-[30px] px-2 text-[11px] bg-white border border-slate-200 rounded-[6px] text-slate-700 font-normal focus:outline-none focus:border-[#f16623]"
            >
              <option value="ALL">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading fleet from Firestore...</span>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
              <Car className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery || filterStatus !== "ALL" || filterCategory !== "ALL"
                ? "No matching vehicles found"
                : "No vehicles in fleet yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different registration number or category."
                : "Add your first vehicle with complete compliance and operations info or use bulk upload."}
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddDrawer}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Vehicle</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bulk Upload</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Vehicle / Plate</th>
                  <th className="py-2.5 px-3">Category & Seats</th>
                  <th className="py-2.5 px-3">Fuel & Owner</th>
                  <th className="py-2.5 px-3">Key Compliance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedVehicles.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                      {startIndex + idx + 1}
                    </td>

                    {/* Vehicle / Plate */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.regNumber}
                            className="w-9 h-8 rounded-[4px] object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-8 rounded-[4px] bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                            <Car className="w-4 h-4" />
                          </div>
                        )}
                        <div>
                          <span className="font-mono font-medium text-slate-900 block leading-tight text-[11px] bg-slate-100/80 px-1.5 py-0.5 rounded border border-slate-200/70 inline-block">
                            {item.regNumber}
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                            {item.vehicleName || `${item.manufacturer || ""} ${item.model || ""}`.trim()}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category & Seats */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-800 block">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {item.seatingCapacity}
                      </span>
                    </td>

                    {/* Fuel & Owner */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Fuel className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-700">{item.fuelType}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {item.ownershipType}
                        {item.vendorName ? ` (${item.vendorName})` : ""}
                      </span>
                    </td>

                    {/* Key Compliance */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        <span className="text-slate-600">
                          FC: <span className="font-medium">{item.fitnessExpiry || "—"}</span>
                        </span>
                        <span className="text-slate-600">
                          PUC: <span className="font-medium">{item.pucExpiry || "—"}</span>
                        </span>
                        {item.registrationState && (
                          <span className="text-slate-400">
                            State: {item.registrationState}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          item.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "In Service"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : item.status === "Under Maintenance"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status === "Active"
                              ? "bg-emerald-500"
                              : item.status === "In Service"
                              ? "bg-blue-500"
                              : item.status === "Under Maintenance"
                              ? "bg-amber-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span>{item.status}</span>
                      </span>
                    </td>

                    {/* Action buttons (View, Edit, Delete) */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingVehicle(item)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-[#f16623] hover:bg-orange-50 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="View Vehicle Details"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(item)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="Edit Vehicle"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingVehicle(item)}
                          className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete Vehicle"
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

        {/* Pagination Bar (Limit: 24 per page) */}
        {filteredVehicles.length > 0 && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Showing <span className="font-medium text-slate-800">{startIndex + 1}</span> to{" "}
                <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                <span className="font-medium text-slate-800">{filteredVehicles.length}</span> vehicles
              </span>
              <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                24 per page
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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

      {/* 5-TAB OffCanvas for Add & Edit Vehicle */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        size="2xl"
        widthClassName="max-w-2xl sm:max-w-3xl"
        title={editingVehicleId ? "Edit Fleet Vehicle" : "Add New Fleet Vehicle"}
        subtitle="Complete 5-stage setup: Profile, Compliance, Operations, Financial, and Status"
      >
        <form onSubmit={handleSaveVehicle} className="space-y-4">
          {/* Validation / Feedback Alerts inside Drawer */}
          {tabError && (
            <div className="flex items-center gap-2 p-2.5 rounded-[6px] text-xs font-normal border bg-rose-50 text-rose-800 border-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{tabError}</span>
            </div>
          )}

          {uploadProgressText && (
            <div className="flex items-center gap-2 p-2.5 rounded-[6px] text-xs font-normal border bg-orange-50 text-[#f16623] border-[#f16623]/30">
              <Loader2 className="w-4 h-4 animate-spin text-[#f16623] shrink-0" />
              <span>{uploadProgressText}</span>
            </div>
          )}

          {/* Stepper Tabs Bar (Total 5 Tabs) */}
          <div className="border-b border-slate-200 pb-2">
            <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none py-1">
              {[
                { step: 1, title: "1. Profile" },
                { step: 2, title: "2. Compliance" },
                { step: 3, title: "3. Operations" },
                { step: 4, title: "4. Financial" },
                { step: 5, title: "5. Status" },
              ].map((t) => {
                const isCurrent = activeTab === t.step;
                const isUnlocked = unlockedTabs.includes(t.step);
                return (
                  <button
                    key={t.step}
                    type="button"
                    onClick={() => {
                      if (isUnlocked) {
                        setTabError(null);
                        setActiveTab(t.step as 1 | 2 | 3 | 4 | 5);
                      }
                    }}
                    disabled={!isUnlocked}
                    className={`h-[32px] px-3 rounded-[6px] text-xs font-medium inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                      isCurrent
                        ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                        : isUnlocked
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                        : "bg-slate-50 text-slate-400 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <span>{t.title}</span>
                    {unlockedTabs.includes(t.step + 1) && !isCurrent && (
                      <Check className="w-3 h-3 text-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB 1: PROFILE */}
          {activeTab === 1 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Registration Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration Number <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TS09EA1234"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 font-mono font-medium focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Vehicle Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Vehicle Category <span className="text-[#f16623]">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Seating Capacity (Plain number input, no arrows, scroll blocked) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Seat Capacity (Passengers) <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="Enter seating capacity (e.g. 7)"
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Fuel Type */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fuel Type <span className="text-[#f16623]">*</span>
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ownership Type & Vendor Selection */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200/80 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Ownership Type <span className="text-[#f16623]">*</span>
                    </label>
                    <select
                      value={ownershipType}
                      onChange={(e) => {
                        const val = e.target.value as "Owned" | "Vendor Attached" | "Leased";
                        setOwnershipType(val);
                        if (val === "Owned") {
                          setSelectedVendorName("");
                          setCustomVendorName("");
                        }
                      }}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] transition"
                    >
                      {OWNERSHIP_TYPES.map((ot) => (
                        <option key={ot} value={ot}>
                          {ot}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(ownershipType === "Vendor Attached" || ownershipType === "Leased") && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-slate-700">
                          {ownershipType === "Leased" ? "Lessor / Agency Name *" : "Attached Vendor Name *"}
                        </label>
                        <div className="flex items-center gap-2">
                          <Link
                            href="/car-vendors"
                            target="_blank"
                            className="text-[10px] text-slate-400 hover:text-[#f16623] cursor-pointer"
                            title="Open Car Vendors directory in new tab"
                          >
                            Manage Vendors ↗
                          </Link>
                          <button
                            type="button"
                            onClick={() => setShowAddVendorInput(!showAddVendorInput)}
                            className="text-[10px] text-[#f16623] hover:underline cursor-pointer"
                          >
                            {showAddVendorInput ? "Select Existing" : "+ New Vendor"}
                          </button>
                        </div>
                      </div>

                      {showAddVendorInput ? (
                        <input
                          type="text"
                          required
                          placeholder="Type vendor / agency name (will be saved to directory)"
                          value={customVendorName}
                          onChange={(e) => setCustomVendorName(e.target.value)}
                          className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] transition"
                        />
                      ) : (
                        <select
                          value={selectedVendorName}
                          onChange={(e) => {
                            setSelectedVendorName(e.target.value);
                            const found = vendorsList.find((v) => v.name === e.target.value);
                            setSelectedVendorId(found?.id || "");
                          }}
                          className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] transition cursor-pointer"
                        >
                          <option value="">-- Select Car Vendor / Lease Member --</option>
                          {vendorsList.map((vnd) => (
                            <option key={vnd.id} value={vnd.name}>
                              {vnd.name} {vnd.mobile ? `(${vnd.mobile})` : ""} {vnd.city ? `• ${vnd.city}` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Manufacturer, Model, Variant */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Toyota, Force"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Innova Crysta"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Variant
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2.4 GX MT"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Chassis & Engine Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Chassis Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MAT612001..."
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Engine Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2GD987654..."
                    value={engineNumber}
                    onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Vehicle Photo (Uploads on Save only) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Vehicle Image (Uploads to ImageKit on final Save)
                </label>
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <div className="relative w-20 h-16 rounded-[6px] overflow-hidden border border-slate-200 shrink-0">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center cursor-pointer shadow-xs"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-16 rounded-[6px] border border-dashed border-slate-300 hover:border-[#f16623] flex flex-col items-center justify-center text-slate-400 hover:text-[#f16623] cursor-pointer bg-slate-50 transition shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <span className="text-[10px] mt-0.5">Add Photo</span>
                    </div>
                  )}

                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-[30px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-slate-500" />
                      <span>{selectedFile ? "Replace Photo" : "Browse from device"}</span>
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Max file size 8MB (JPG, PNG, WebP).
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Continue button for Tab 1 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => handleContinue(2)}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Compliance</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: COMPLIANCE */}
          {activeTab === 2 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Fitness Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Fitness Expiry Date <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={fitnessExpiry}
                    onChange={(e) => setFitnessExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* RC Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    RC (Registration) Expiry Date <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={rcExpiry}
                    onChange={(e) => setRcExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Insurance Expiry Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Insurance Expiry Date
                  </label>
                  <input
                    type="date"
                    value={insuranceExpiry}
                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Insurance Policy Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Insurance Policy Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. POL-987654321"
                    value={insurancePolicyNumber}
                    onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 font-mono placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* PUC Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    PUC (Pollution) Expiry Date <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={pucExpiry}
                    onChange={(e) => setPucExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Quarterly Tax Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Quarterly Tax Expiry Date
                  </label>
                  <input
                    type="date"
                    value={quarterlyTaxExpiry}
                    onChange={(e) => setQuarterlyTaxExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* State Permit Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    State Permit Expiry Date
                  </label>
                  <input
                    type="date"
                    value={statePermitExpiry}
                    onChange={(e) => setStatePermitExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* National Permit Expiry */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    National Permit Expiry Date
                  </label>
                  <input
                    type="date"
                    value={nationalPermitExpiry}
                    onChange={(e) => setNationalPermitExpiry(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Registration State with Codes */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration State List <span className="text-[#f16623]">*</span>
                  </label>
                  <select
                    value={registrationState}
                    onChange={(e) => setRegistrationState(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.code} - {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Registration City / RTO */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration City / RTO
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hyderabad Central RTO (TS-09)"
                    value={registrationCityRto}
                    onChange={(e) => setRegistrationCityRto(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Navigation buttons for Tab 2 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab(1)}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleContinue(3)}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Operations</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OPERATIONS */}
          {activeTab === 3 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Default Odometer Baseline KM (plain number input) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Default Odometer Baseline (KM)
                  </label>
                  <input
                    type="number"
                    value={odometerBaselineKm}
                    onChange={(e) => setOdometerBaselineKm(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="e.g. 15000"
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Last Service Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Service Date
                  </label>
                  <input
                    type="date"
                    value={lastServiceDate}
                    onChange={(e) => setLastServiceDate(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Last Service KM (Mandatory) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Service KM <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={lastServiceKm}
                    onChange={(e) => setLastServiceKm(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="e.g. 24000"
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Service Interval KM (Mandatory) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Service Interval KM <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={serviceIntervalKm}
                    onChange={(e) => setServiceIntervalKm(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="e.g. 10000"
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Allowed States with Multiple Checkboxes */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-800">
                    Allowed Operating States ({allowedStates.length} selected)
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAllowedStates(INDIAN_STATES.map((s) => s.code))}
                      className="text-[#f16623] hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAllowedStates(["TS", "AP", "KA", "MH", "TN"])}
                      className="text-[#f16623] hover:underline cursor-pointer"
                    >
                      South India
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setAllowedStates([])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
                  {INDIAN_STATES.map((st) => {
                    const isChecked = allowedStates.includes(st.code);
                    return (
                      <label
                        key={st.code}
                        className={`flex items-center gap-1.5 p-1.5 rounded-[4px] border text-[11px] font-normal cursor-pointer transition ${
                          isChecked
                            ? "bg-white border-[#f16623]/60 text-slate-900 shadow-2xs"
                            : "bg-transparent border-slate-200 text-slate-500 hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleState(st.code)}
                          className="w-3.5 h-3.5 accent-[#f16623] rounded-[2px]"
                        />
                        <span className="font-mono font-medium text-[#f16623]">{st.code}</span>
                        <span className="truncate">{st.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Notes and Restrictions */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Note and Restrictions
                </label>
                <textarea
                  rows={2}
                  value={notesRestrictions}
                  onChange={(e) => setNotesRestrictions(e.target.value)}
                  placeholder="e.g. Airport commercial badge mandatory. Speed governor calibrated at 80kmph."
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                />
              </div>

              {/* Navigation buttons for Tab 3 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab(2)}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleContinue(4)}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Financial</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: FINANCIAL */}
          {activeTab === 4 && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Purchase Price (plain number input) */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Purchase Price (₹)
                  </label>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    placeholder="e.g. 1850000"
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Expense Ledger Reference */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Expense Ledger Reference
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LED-FLT-2024-001"
                    value={expenseLedgerRef}
                    onChange={(e) => setExpenseLedgerRef(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Depreciation Group */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Depreciation Group
                  </label>
                  <select
                    value={depreciationGroup}
                    onChange={(e) => setDepreciationGroup(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  >
                    {DEPRECIATION_GROUPS.map((dg) => (
                      <option key={dg} value={dg}>
                        {dg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Navigation buttons for Tab 4 */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab(3)}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleContinue(5)}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Continue to Status</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: STATUS & FINAL SAVE */}
          {activeTab === 5 && (
            <div className="space-y-4">
              {/* Active / Inactive Toggle (Default Active) */}
              <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-medium text-slate-800 block">
                      Vehicle Active / Inactive Status
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {isActiveToggle
                        ? "Active: Vehicle is operational and available for trip dispatching"
                        : "Inactive: Vehicle is disabled from new trip booking selectors"}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={isActiveToggle}
                    onClick={() => setIsActiveToggle(!isActiveToggle)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      isActiveToggle ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isActiveToggle ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">Fleet Duty State:</span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "Active" | "In Service" | "Under Maintenance" | "Standby")
                    }
                    className="h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623]"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Complete Setup Review Card */}
              <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5 text-xs">
                <span className="font-medium text-slate-900 block border-b border-slate-100 pb-1.5">
                  Summary Review before Final Save
                </span>

                <div className="grid grid-cols-2 gap-2 text-slate-600">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Registration</span>
                    <span className="font-mono font-medium text-slate-900">{regNumber || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Category & Seats</span>
                    <span className="font-medium text-slate-900">{category} ({seatingCapacity || "—"} Seats)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Fuel & Ownership</span>
                    <span className="text-slate-800">{fuelType} • {ownershipType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Fitness Expiry</span>
                    <span className="font-medium text-slate-800">{fitnessExpiry || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">State / RTO</span>
                    <span className="text-slate-800">{registrationState} {registrationCityRto ? `• ${registrationCityRto}` : ""}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Photo Attachment</span>
                    <span className="text-slate-800">
                      {selectedFile ? "Ready to upload to ImageKit" : existingImageUrl ? "Existing photo linked" : "No photo attached"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation & Final Save Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab(4)}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOffCanvasOpen(false)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Vehicle...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{editingVehicleId ? "Update Vehicle" : "Save Vehicle"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </OffCanvas>

      {/* VIEW DETAILS OffCanvas */}
      <OffCanvas
        isOpen={!!viewingVehicle}
        onClose={() => setViewingVehicle(null)}
        size="2xl"
        widthClassName="max-w-2xl sm:max-w-3xl"
        title={viewingVehicle?.regNumber || "Vehicle Details"}
        subtitle="Complete 5-stage profile, compliance telemetry, operations & financial records"
      >
        {viewingVehicle && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="p-3.5 bg-slate-50 rounded-[6px] border border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {viewingVehicle.imageUrl ? (
                  <img
                    src={viewingVehicle.imageUrl}
                    alt={viewingVehicle.regNumber}
                    className="w-14 h-12 rounded-[6px] object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623] shrink-0">
                    <Car className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-mono font-medium text-slate-900 leading-tight">
                    {viewingVehicle.regNumber}
                  </h3>
                  <p className="text-xs text-slate-600 font-normal mt-0.5">
                    {viewingVehicle.vehicleName || `${viewingVehicle.manufacturer || ""} ${viewingVehicle.model || ""}`.trim()}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: {viewingVehicle.id}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
                    viewingVehicle.status === "Active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      viewingVehicle.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                  <span>{viewingVehicle.status}</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {viewingVehicle.category} • {viewingVehicle.seatingCapacity}
                </span>
              </div>
            </div>

            {/* Profile & Specs */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2">
              <span className="text-xs font-medium text-slate-800 block border-b border-slate-100 pb-1">
                1. Vehicle Profile
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Fuel Type</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.fuelType || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Ownership</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.ownershipType || "Owned"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Vendor / Lessor</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.vendorName || "In-House"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Manufacturer & Model</span>
                  <span className="font-medium text-slate-800">
                    {viewingVehicle.manufacturer} {viewingVehicle.model} {viewingVehicle.variant ? `(${viewingVehicle.variant})` : ""}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Chassis Number</span>
                  <span className="font-mono text-slate-800">{viewingVehicle.chassisNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Engine Number</span>
                  <span className="font-mono text-slate-800">{viewingVehicle.engineNumber || "—"}</span>
                </div>
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2">
              <span className="text-xs font-medium text-slate-800 block border-b border-slate-100 pb-1">
                2. Legal & Compliance Records
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Fitness Expiry</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.fitnessExpiry || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">RC Expiry</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.rcExpiry || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">PUC Expiry</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.pucExpiry || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Insurance Expiry</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.insuranceExpiry || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Policy No</span>
                  <span className="font-mono text-slate-800">{viewingVehicle.insurancePolicyNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Quarterly Tax</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.quarterlyTaxExpiry || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">State / RTO</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.registrationState} ({viewingVehicle.registrationCityRto || "—"})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Permits</span>
                  <span className="font-medium text-slate-800">
                    {viewingVehicle.nationalPermitExpiry ? "National Active" : viewingVehicle.statePermitExpiry ? "State Active" : "Standard"}
                  </span>
                </div>
              </div>
            </div>

            {/* Operations */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2">
              <span className="text-xs font-medium text-slate-800 block border-b border-slate-100 pb-1">
                3. Operations & Maintenance
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Baseline Odometer</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.odometerBaselineKm ? `${viewingVehicle.odometerBaselineKm} KM` : "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Last Service KM</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.lastServiceKm ? `${viewingVehicle.lastServiceKm} KM` : "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Service Interval</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.serviceIntervalKm ? `${viewingVehicle.serviceIntervalKm} KM` : "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Last Service Date</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.lastServiceDate || "—"}</span>
                </div>
              </div>
              {viewingVehicle.allowedStates && viewingVehicle.allowedStates.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">Allowed States</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {viewingVehicle.allowedStates.map((st) => (
                      <span
                        key={st}
                        className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-mono border border-slate-200/60"
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Financial */}
            <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2">
              <span className="text-xs font-medium text-slate-800 block border-b border-slate-100 pb-1">
                4. Financial & Asset Ledger
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Purchase Price</span>
                  <span className="font-medium text-slate-900">
                    {viewingVehicle.purchasePrice ? `₹${Number(viewingVehicle.purchasePrice).toLocaleString("en-IN")}` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Purchase Date</span>
                  <span className="font-medium text-slate-800">{viewingVehicle.purchaseDate || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Ledger Ref</span>
                  <span className="font-mono text-slate-800">{viewingVehicle.expenseLedgerRef || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Depreciation</span>
                  <span className="text-slate-800 truncate block">{viewingVehicle.depreciationGroup || "Standard"}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingVehicle(null)}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingVehicle;
                  setViewingVehicle(null);
                  handleOpenEditDrawer(target);
                }}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Vehicle</span>
              </button>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* BULK UPLOAD MODAL */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-2xl w-full p-4 sm:p-5 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 leading-tight">
                    Bulk Vehicle Import (Excel / CSV)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Import multiple fleet vehicles with full compliance data at once
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setParsedVehicles([]);
                  }
                }}
                className="h-[30px] w-[30px] rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Download Sample file option */}
            <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-800 block">
                  Need the template?
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Download our pre-formatted sample with 50 realistic vehicles
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleFile}
                className="h-[30px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5 text-[#f16623]" />
                <span>Download 50 CSV</span>
              </button>
            </div>

            {/* File Upload Zone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-[#f16623] rounded-[6px] p-6 text-center bg-slate-50/50 transition">
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-slate-800">
                {bulkFile ? bulkFile.name : "Select or drag & drop CSV file"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Supports CSV or exported Excel (.csv) with header columns
              </p>

              <label className="mt-3 inline-block">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleBulkFileSelected}
                  className="hidden"
                />
                <span className="h-[32px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Choose File</span>
                </span>
              </label>
            </div>

            {/* Preview of Parsed Vehicles */}
            {parsedVehicles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">
                    Preview ({parsedVehicles.length} vehicles ready)
                  </span>
                  <span className="text-emerald-600 font-medium text-[11px] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Validated Columns</span>
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5">Plate</th>
                        <th className="py-2 px-2.5">Category</th>
                        <th className="py-2 px-2.5">Seats</th>
                        <th className="py-2 px-2.5">Fuel</th>
                        <th className="py-2 px-2.5">Owner</th>
                        <th className="py-2 px-2.5">Fitness Exp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {parsedVehicles.slice(0, 10).map((pv, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2.5 font-mono font-medium">{pv.regNumber}</td>
                          <td className="py-1.5 px-2.5">{pv.category}</td>
                          <td className="py-1.5 px-2.5">{pv.seatingCapacity}</td>
                          <td className="py-1.5 px-2.5">{pv.fuelType}</td>
                          <td className="py-1.5 px-2.5">{pv.ownershipType}</td>
                          <td className="py-1.5 px-2.5">{pv.fitnessExpiry || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedVehicles.length > 10 && (
                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      ...and {parsedVehicles.length - 10} more vehicles
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Auto-Creation Notice */}
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-[6px] flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium block">Automatic Category & Vendor Creation Active</span>
                <span className="text-[11px] text-emerald-700 font-normal">
                  If the Excel / CSV file has categories or attached vendors not already in the database, RK Travels will automatically create them in <strong>Vehicle Categories</strong> and <strong>Car Vendors</strong> directories and link each vehicle accurately.
                </span>
              </div>
            </div>

            {/* Import Progress Bar */}
            {isImporting && (
              <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                  <span className="truncate flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f16623]" />
                    <span>{importStatusText || "Processing bulk import..."}</span>
                  </span>
                  <span className="font-mono">{importProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-[#f16623] transition-all duration-200"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setParsedVehicles([]);
                  }
                }}
                disabled={isImporting}
                className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkImport}
                disabled={isImporting || parsedVehicles.length === 0}
                className="h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>
                  {isImporting ? "Importing Vehicles..." : `Import ${parsedVehicles.length} Vehicles`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVehicle && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-900">
                  Delete Vehicle?
                </h4>
                <p className="text-[11px] text-slate-500 font-normal">
                  Are you sure you want to remove &ldquo;{deletingVehicle.regNumber}&rdquo;?
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 font-normal bg-slate-50 p-2.5 rounded-[4px] border border-slate-100">
              This action cannot be undone. All compliance and telemetry logs for this vehicle will be deleted.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingVehicle(null)}
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
    </div>
  );
}
