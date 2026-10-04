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
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  Camera,
  X,
  RefreshCw,
  PhoneCall,
  UploadCloud,
  IdCard,
  ShieldCheck,
  Building,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  Eye,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ExternalLink,
  Briefcase,
  FileSpreadsheet,
  Download,
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
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";

export interface DriverItem {
  id: string;
  // Step 1: Core Profile
  fullName: string;
  name?: string; // fallback alias
  mobileNumber: string;
  mobile?: string; // fallback alias
  alternateMobileNumber?: string | null;
  photoUrl?: string | null;

  // Step 2: Licensing
  dlNumber: string;
  licenseNumber?: string; // fallback alias
  dlValidFrom: string;
  dlValidTo: string;
  badgeNumber?: string | null;
  badgeValidTo?: string | null;
  aadhaarNumber?: string | null;
  currentAddress?: string | null;

  // Step 3: Ops & HR
  ownershipType: string;
  availabilityStatus: string;
  status?: string; // fallback alias
  lastVerificationDate?: string | null;
  joiningDate?: string | null;
  joiningAdvance?: string | null;
  endingDateDeactivation?: string | null;
  monthlyBaseSalary?: string | null;
  monthlyLeaveQuota?: string | null;
  annualLeaveQuota?: string | null;
  incidentNotes?: string | null;

  // Linked Travel & Vehicle
  travelId?: string | null;
  travelName?: string | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  vehicleRegNumber?: string | null;

  // Step 4: Payout & Banking
  upiId?: string | null;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;

  // Step 5: Status
  isActive: boolean;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
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

const OWNERSHIP_TYPES = [
  "Owned (Aruna Cabs Staff)",
  "Vendor Attached",
  "Contract / Freelance",
  "Leased",
];

export const AVAILABILITY_STATUS_OPTIONS = [
  "Available (On Call)",
  "On Trip",
  "Off Duty",
  "On Leave",
  "Suspended",
];

// 50 Realistic Commercial Drivers Sample Dummy Generator
export function getSample50DriversList(): Partial<DriverItem>[] {
  const driverNames = [
    "Ramesh Kumar", "Suresh Reddy", "Mohammed Imran", "Venkat Rao", "Rajesh Sharma",
    "K. Srinivas", "Anand Verma", "Santosh Naik", "Ravi Teja", "Satish Goud",
    "Praveen Kumar", "Abdul Rahman", "Mahesh Babu", "Ch. Prasad", "Vijay Kumar",
    "G. Naresh", "Shiva Krishna", "Dileep Reddy", "Ashok Kumar", "Syed Farooq",
    "Sai Kumar", "Murali Krishna", "P. Jagadeesh", "Naveen Reddy", "Krishna Murthy",
    "Kalyan Chakravarthy", "R. Venkatesh", "B. Raju", "N. Chandra Sekhar", "Vinod Kumar",
    "Manoj Tiwari", "Harish Gowda", "Mohan Lal", "T. Prabhakar", "V. Govind",
    "Sunilkumar Yadav", "Sandeep Varma", "Ajay Rathod", "Kishore Kumar", "Dhanush N.",
    "Karthik Subramaniam", "L. Nagaraju", "Rohit Singh", "Jagannath Panda", "Deepak Patil",
    "B. Srinath", "M. Anji Reddy", "Salman Khan", "E. Madhusudhan", "K. Thirupathi Rao"
  ];

  const locations = [
    "Plot 12, Ameerpet, Hyderabad",
    "Flat 4B, Madhapur, Hyderabad",
    "H.No 5-21, Kukatpally, Hyderabad",
    "H.No 3-88, Dilsukhnagar, Hyderabad",
    "Block C, Miyapur, Hyderabad",
    "Plot 45, Gachibowli, Hyderabad",
    "H.No 7-104, Secunderabad",
    "Near Bus Depot, Uppal, Hyderabad",
    "Plot 18, Kondapur, Hyderabad",
    "H.No 2-34, Begumpet, Hyderabad"
  ];

  const banks = [
    { bank: "State Bank of India", ifsc: "SBIN0001234" },
    { bank: "HDFC Bank", ifsc: "HDFC0000240" },
    { bank: "ICICI Bank", ifsc: "ICIC0001020" },
    { bank: "Union Bank of India", ifsc: "UBIN0530123" },
    { bank: "Axis Bank", ifsc: "UTIB0000045" },
  ];

  const ownershipOptions = [
    "Owned (Aruna Cabs Staff)",
    "Vendor Attached",
    "Contract / Freelance",
    "Leased"
  ];

  const availabilityOptions = [
    "Available (On Call)",
    "On Trip",
    "Off Duty",
    "On Leave",
    "Suspended"
  ];

  return driverNames.map((name, i) => {
    const num = i + 1;
    const mobile = `98480${String(11200 + num)}`;
    const altMobile = `94401${String(22300 + num)}`;
    const dl = `TS092019${String(1000 + num)}`;
    const badge = `BDG-${5000 + num}`;
    const aadhaar = `4829-5920-${String(1200 + num)}`;
    const loc = locations[i % locations.length];
    const bnk = banks[i % banks.length];
    const ownership = ownershipOptions[i % ownershipOptions.length];
    // Include Suspended for diverse status representation
    let availability = availabilityOptions[i % availabilityOptions.length];
    if (i === 6 || i === 11 || i === 23 || i === 37) {
      availability = "Suspended";
    }

    const joiningYear = 2022 + (i % 3);
    const joiningMonth = String((i % 12) + 1).padStart(2, "0");
    const joinDate = `${joiningYear}-${joiningMonth}-15`;

    const dlExpiryYear = 2027 + (i % 4);
    const dlExpiryMonth = String(((i + 3) % 12) + 1).padStart(2, "0");
    const dlValidToDate = `${dlExpiryYear}-${dlExpiryMonth}-20`;

    const baseSalary = String(20000 + (i % 6) * 1500);
    const advance = i % 4 === 0 ? "5000" : i % 3 === 0 ? "3000" : "0";
    const isActive = availability !== "Suspended" && i !== 48;

    return {
      fullName: name,
      name: name,
      mobileNumber: mobile,
      mobile: mobile,
      alternateMobileNumber: altMobile,
      dlNumber: dl,
      licenseNumber: dl,
      dlValidFrom: "2021-04-10",
      dlValidTo: dlValidToDate,
      badgeNumber: badge,
      badgeValidTo: "2028-10-22",
      aadhaarNumber: aadhaar,
      currentAddress: loc,
      ownershipType: ownership,
      availabilityStatus: availability,
      status: availability,
      lastVerificationDate: "2026-08-15",
      joiningDate: joinDate,
      joiningAdvance: advance,
      endingDateDeactivation: "",
      monthlyBaseSalary: baseSalary,
      monthlyLeaveQuota: "2",
      annualLeaveQuota: "24",
      incidentNotes:
        availability === "Suspended"
          ? "Driver temporarily suspended pending review of road speed telemetry."
          : "Clean driving record, verified background check, polite and punctual.",
      upiId: `driver${num}@${i % 2 === 0 ? "ybl" : "okhdfcbank"}`,
      bankName: bnk.bank,
      accountHolderName: name,
      accountNumber: `308945${String(61000 + num)}`,
      ifscCode: bnk.ifsc,
      isActive: isActive,
    };
  });
}

export function generateSample50DriversCSV(): string {
  const headers = [
    "Full Name",
    "Mobile Number",
    "Alternate Mobile Number",
    "DL Number",
    "DL Valid From",
    "DL Valid To",
    "Badge Number",
    "Badge Valid To",
    "Masked Aadhaar",
    "Current Address",
    "Ownership Type",
    "Availability Status",
    "Last Verification Date",
    "Joining Date",
    "Joining Advance",
    "Ending Date",
    "Monthly Base Salary",
    "Monthly Leave Quota",
    "Annual Leave Quota",
    "Incident Notes",
    "UPI ID",
    "Bank Name",
    "Account Holder Name",
    "Account Number",
    "IFSC Code",
    "Status"
  ];

  const sampleList = getSample50DriversList();
  const rows = sampleList.map((d) => [
    d.fullName || "",
    d.mobileNumber || "",
    d.alternateMobileNumber || "",
    d.dlNumber || "",
    d.dlValidFrom || "",
    d.dlValidTo || "",
    d.badgeNumber || "",
    d.badgeValidTo || "",
    d.aadhaarNumber || "",
    d.currentAddress || "",
    d.ownershipType || "",
    d.availabilityStatus || "",
    d.lastVerificationDate || "",
    d.joiningDate || "",
    d.joiningAdvance || "",
    d.endingDateDeactivation || "",
    d.monthlyBaseSalary || "",
    d.monthlyLeaveQuota || "",
    d.annualLeaveQuota || "",
    d.incidentNotes || "",
    d.upiId || "",
    d.bankName || "",
    d.accountHolderName || "",
    d.accountNumber || "",
    d.ifscCode || "",
    d.isActive !== false ? "Active" : "Inactive"
  ]);

  const csvLines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
  ];

  return csvLines.join("\n");
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Pagination states (Limit: 24 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // OffCanvas Drawer states
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [unlockedTabs, setUnlockedTabs] = useState<number[]>([1]);

  // View Drawer state
  const [viewingDriver, setViewingDriver] = useState<DriverItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Tab 1 Form States (Core Profile)
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [alternateMobileNumber, setAlternateMobileNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab 2 Form States (Licensing)
  const [dlNumber, setDlNumber] = useState("");
  const [dlValidFrom, setDlValidFrom] = useState("");
  const [dlValidTo, setDlValidTo] = useState("");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [badgeValidTo, setBadgeValidTo] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");

  // Tab 3 Form States (Ops & HR)
  const [ownershipType, setOwnershipType] = useState(OWNERSHIP_TYPES[0]);
  const [availabilityStatus, setAvailabilityStatus] = useState(AVAILABILITY_STATUS_OPTIONS[0]);
  const [lastVerificationDate, setLastVerificationDate] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [joiningAdvance, setJoiningAdvance] = useState("");
  const [endingDateDeactivation, setEndingDateDeactivation] = useState("");
  const [monthlyBaseSalary, setMonthlyBaseSalary] = useState("");
  const [monthlyLeaveQuota, setMonthlyLeaveQuota] = useState("");
  const [annualLeaveQuota, setAnnualLeaveQuota] = useState("");
  const [incidentNotes, setIncidentNotes] = useState("");

  // Paired Travel & Vehicle
  const [selectedTravelId, setSelectedTravelId] = useState("");
  const [selectedTravelName, setSelectedTravelName] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicleName, setSelectedVehicleName] = useState("");
  const [selectedVehicleReg, setSelectedVehicleReg] = useState("");

  // Tab 4 Form States (Payout & Banking)
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  // Tab 5 Form States (Status)
  const [isActive, setIsActive] = useState(true);

  // Dynamic Options from Firestore
  const [travelsList, setTravelsList] = useState<TravelOption[]>([]);
  const [vehiclesList, setVehiclesList] = useState<VehicleOption[]>([]);

  // Deletion modal
  const [deletingDriver, setDeletingDriver] = useState<DriverItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Upload Modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedDrivers, setParsedDrivers] = useState<Partial<DriverItem>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Progress, Validation & Feedback
  const [tabError, setTabError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Travels Collection
  useEffect(() => {
    try {
      const q = query(collection(db, "travels"), orderBy("travelName", "asc"));
      const unsub = onSnapshot(q, (snapshot) => {
        const items: TravelOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          travelName: docSnap.data().travelName || "Unnamed Travel",
          mobileNumber: docSnap.data().mobileNumber || "",
        }));
        setTravelsList(items);
      });
      return () => unsub();
    } catch {
      // Ignored
    }
  }, []);

  // 2. Subscribe to Vehicles Collection
  useEffect(() => {
    try {
      const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snapshot) => {
        const items: VehicleOption[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          vehicleName: docSnap.data().vehicleName || "Unnamed Vehicle",
          regNumber: docSnap.data().regNumber || "",
          travelId: docSnap.data().travelId || "",
        }));
        setVehiclesList(items);
      });
      return () => unsub();
    } catch {
      // Ignored
    }
  }, []);

  // 3. Real-time Drivers Listener with 24 item pagination limit
  useEffect(() => {
    try {
      const fetchLimit = Math.max(240, currentPage * 24);
      const q = query(
        collection(db, "drivers"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: DriverItem[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const resolvedName = d.fullName || d.name || "Unnamed Driver";
            const resolvedMobile = d.mobileNumber || d.mobile || "";
            const resolvedDL = d.dlNumber || d.licenseNumber || "";

            return {
              id: docSnap.id,
              fullName: resolvedName,
              name: resolvedName,
              mobileNumber: resolvedMobile,
              mobile: resolvedMobile,
              alternateMobileNumber: d.alternateMobileNumber || null,
              photoUrl: d.photoUrl || null,

              dlNumber: resolvedDL,
              licenseNumber: resolvedDL,
              dlValidFrom: d.dlValidFrom || "",
              dlValidTo: d.dlValidTo || "",
              badgeNumber: d.badgeNumber || null,
              badgeValidTo: d.badgeValidTo || null,
              aadhaarNumber: d.aadhaarNumber || null,
              currentAddress: d.currentAddress || null,

              ownershipType: d.ownershipType || OWNERSHIP_TYPES[0],
              availabilityStatus: d.availabilityStatus || d.status || AVAILABILITY_STATUS_OPTIONS[0],
              status: d.availabilityStatus || d.status || "Available",
              lastVerificationDate: d.lastVerificationDate || null,
              joiningDate: d.joiningDate || null,
              joiningAdvance: d.joiningAdvance || null,
              endingDateDeactivation: d.endingDateDeactivation || null,
              monthlyBaseSalary: d.monthlyBaseSalary || null,
              monthlyLeaveQuota: d.monthlyLeaveQuota || null,
              annualLeaveQuota: d.annualLeaveQuota || null,
              incidentNotes: d.incidentNotes || null,

              travelId: d.travelId || null,
              travelName: d.travelName || null,
              vehicleId: d.vehicleId || null,
              vehicleName: d.vehicleName || null,
              vehicleRegNumber: d.vehicleRegNumber || null,

              upiId: d.upiId || null,
              bankName: d.bankName || null,
              accountHolderName: d.accountHolderName || null,
              accountNumber: d.accountNumber || null,
              ifscCode: d.ifscCode || null,

              isActive: d.isActive !== false,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            };
          });
          setDrivers(items);
          setLoading(false);
        },
        () => {
          const fallback = query(collection(db, "drivers"), limit(fetchLimit));
          onSnapshot(fallback, (snap) => {
            const items: DriverItem[] = snap.docs.map((docSnap) => ({
              id: docSnap.id,
              ...(docSnap.data() as any),
            }));
            setDrivers(items);
            setLoading(false);
          });
        }
      );

      return () => unsub();
    } catch (err) {
      console.error("Failed to load drivers:", err);
      setLoading(false);
    }
  }, [currentPage]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Image Selection Handler (local preview only; uploads to ImageKit on save)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setTabError("Photo size exceeds 8MB. Please choose a smaller photo.");
        return;
      }
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      setTabError(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setExistingPhotoUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Open Drawer in Add Mode
  const handleOpenAddDrawer = () => {
    setEditingDriverId(null);
    setActiveTab(1);
    setUnlockedTabs([1]);
    setTabError(null);

    // Reset Form
    setFullName("");
    setMobileNumber("");
    setAlternateMobileNumber("");
    setSelectedFile(null);
    setImagePreview(null);
    setExistingPhotoUrl("");

    setDlNumber("");
    setDlValidFrom("");
    setDlValidTo("");
    setBadgeNumber("");
    setBadgeValidTo("");
    setAadhaarNumber("");
    setCurrentAddress("");

    setOwnershipType(OWNERSHIP_TYPES[0]);
    setAvailabilityStatus(AVAILABILITY_STATUS_OPTIONS[0]);
    setLastVerificationDate("");
    setJoiningDate("");
    setJoiningAdvance("");
    setEndingDateDeactivation("");
    setMonthlyBaseSalary("");
    setMonthlyLeaveQuota("");
    setAnnualLeaveQuota("");
    setIncidentNotes("");

    setSelectedTravelId("");
    setSelectedTravelName("");
    setSelectedVehicleId("");
    setSelectedVehicleName("");
    setSelectedVehicleReg("");

    setUpiId("");
    setBankName("");
    setAccountHolderName("");
    setAccountNumber("");
    setIfscCode("");

    setIsActive(true);
    setIsOffCanvasOpen(true);
  };

  // Open Drawer in Edit Mode
  const handleOpenEditDrawer = (d: DriverItem) => {
    setEditingDriverId(d.id);
    setActiveTab(1);
    setUnlockedTabs([1, 2, 3, 4, 5]); // All tabs accessible when editing
    setTabError(null);

    setFullName(d.fullName || d.name || "");
    setMobileNumber(d.mobileNumber || d.mobile || "");
    setAlternateMobileNumber(d.alternateMobileNumber || "");
    setSelectedFile(null);
    setImagePreview(d.photoUrl || null);
    setExistingPhotoUrl(d.photoUrl || "");

    setDlNumber(d.dlNumber || d.licenseNumber || "");
    setDlValidFrom(d.dlValidFrom || "");
    setDlValidTo(d.dlValidTo || "");
    setBadgeNumber(d.badgeNumber || "");
    setBadgeValidTo(d.badgeValidTo || "");
    setAadhaarNumber(d.aadhaarNumber || "");
    setCurrentAddress(d.currentAddress || "");

    setOwnershipType(d.ownershipType || OWNERSHIP_TYPES[0]);
    setAvailabilityStatus(d.availabilityStatus || d.status || AVAILABILITY_STATUS_OPTIONS[0]);
    setLastVerificationDate(d.lastVerificationDate || "");
    setJoiningDate(d.joiningDate || "");
    setJoiningAdvance(d.joiningAdvance || "");
    setEndingDateDeactivation(d.endingDateDeactivation || "");
    setMonthlyBaseSalary(d.monthlyBaseSalary || "");
    setMonthlyLeaveQuota(d.monthlyLeaveQuota || "");
    setAnnualLeaveQuota(d.annualLeaveQuota || "");
    setIncidentNotes(d.incidentNotes || "");

    setSelectedTravelId(d.travelId || "");
    setSelectedTravelName(d.travelName || "");
    setSelectedVehicleId(d.vehicleId || "");
    setSelectedVehicleName(d.vehicleName || "");
    setSelectedVehicleReg(d.vehicleRegNumber || "");

    setUpiId(d.upiId || "");
    setBankName(d.bankName || "");
    setAccountHolderName(d.accountHolderName || "");
    setAccountNumber(d.accountNumber || "");
    setIfscCode(d.ifscCode || "");

    setIsActive(d.isActive !== false);
    setIsOffCanvasOpen(true);
  };

  // Step Validation before Continuing
  const validateTab = (tabIndex: number): boolean => {
    setTabError(null);

    // Tab 1: Core Profile
    if (tabIndex === 1) {
      if (!fullName.trim()) {
        setTabError("Please enter driver Full Name.");
        return false;
      }
      if (!mobileNumber.trim()) {
        setTabError("Please enter mobile phone number.");
        return false;
      }
      if (!/^[0-9+\-\s]{10,15}$/.test(mobileNumber.trim())) {
        setTabError("Please enter a valid 10-digit mobile number.");
        return false;
      }
      return true;
    }

    // Tab 2: Licensing
    if (tabIndex === 2) {
      if (!dlNumber.trim()) {
        setTabError("Please enter Driving License (DL) Number.");
        return false;
      }
      if (!dlValidFrom) {
        setTabError("Please specify Driving License 'DL Valid From' date.");
        return false;
      }
      if (!dlValidTo) {
        setTabError("Please specify Driving License 'DL Valid To (Expiry)' date.");
        return false;
      }
      return true;
    }

    // Tab 3: Ops & HR
    if (tabIndex === 3) {
      if (!ownershipType) {
        setTabError("Please select Driver Ownership Type.");
        return false;
      }
      if (!availabilityStatus) {
        setTabError("Please select Availability Status.");
        return false;
      }
      return true;
    }

    // Tab 4: Payout & Banking
    if (tabIndex === 4) {
      return true; // Optional banking details
    }

    return true;
  };

  // Handle Tab Progression
  const handleContinue = (nextTab: 2 | 3 | 4 | 5) => {
    const currentTab = (nextTab - 1) as 1 | 2 | 3 | 4;
    if (!validateTab(currentTab)) return;

    if (!unlockedTabs.includes(nextTab)) {
      setUnlockedTabs((prev) => [...prev, nextTab]);
    }
    setActiveTab(nextTab);
  };

  // Final Form Submit (Save / Update Driver)
  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setTabError(null);

    // Validate tabs 1, 2, 3
    if (!validateTab(1) || !validateTab(2) || !validateTab(3)) {
      return;
    }

    setIsSubmitting(true);
    let finalPhotoUrl = existingPhotoUrl;

    try {
      // Step 1: Upload photo to ImageKit if user selected a new file
      if (selectedFile) {
        setUploadProgressText("Uploading driver photo to ImageKit...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append(
          "fileName",
          `driver_${dlNumber.trim().replace(/\s+/g, "_")}_${Date.now()}`
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

      setUploadProgressText("Saving driver profile to Firestore...");

      const payload = {
        fullName: fullName.trim(),
        name: fullName.trim(), // backward-compatible alias
        mobileNumber: mobileNumber.trim(),
        mobile: mobileNumber.trim(), // backward-compatible alias
        alternateMobileNumber: alternateMobileNumber.trim() || null,
        photoUrl: finalPhotoUrl || null,

        dlNumber: dlNumber.trim().toUpperCase(),
        licenseNumber: dlNumber.trim().toUpperCase(), // backward-compatible alias
        dlValidFrom,
        dlValidTo,
        badgeNumber: badgeNumber.trim().toUpperCase() || null,
        badgeValidTo: badgeValidTo || null,
        aadhaarNumber: aadhaarNumber.trim() || null,
        currentAddress: currentAddress.trim() || null,

        ownershipType,
        availabilityStatus,
        status: availabilityStatus, // backward-compatible alias
        lastVerificationDate: lastVerificationDate || null,
        joiningDate: joiningDate || null,
        joiningAdvance: joiningAdvance.trim() || null,
        endingDateDeactivation: endingDateDeactivation || null,
        monthlyBaseSalary: monthlyBaseSalary.trim() || null,
        monthlyLeaveQuota: monthlyLeaveQuota.trim() || null,
        annualLeaveQuota: annualLeaveQuota.trim() || null,
        incidentNotes: incidentNotes.trim() || null,

        travelId: selectedTravelId || null,
        travelName: selectedTravelName || null,
        vehicleId: selectedVehicleId || null,
        vehicleName: selectedVehicleName || null,
        vehicleRegNumber: selectedVehicleReg || null,

        upiId: upiId.trim() || null,
        bankName: bankName.trim() || null,
        accountHolderName: accountHolderName.trim() || null,
        accountNumber: accountNumber.trim() || null,
        ifscCode: ifscCode.trim().toUpperCase() || null,

        isActive,
        updatedAt: serverTimestamp(),
      };

      if (editingDriverId) {
        await updateDoc(doc(db, "drivers", editingDriverId), payload);
        setFeedback({
          type: "success",
          message: `Driver "${payload.fullName}" updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "drivers"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Driver "${payload.fullName}" onboarded successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving driver:", err);
      const msg = err instanceof Error ? err.message : "Failed to save driver.";
      setTabError(`Save failed: ${msg}`);
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
      setUploadProgressText("");
    }
  };

  // Download Sample 50 Drivers CSV Template
  const handleDownloadSampleFile = () => {
    const csvContent = generateSample50DriversCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_50_drivers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Populate 50 Sample Drivers directly into preview
  const handleLoad50SampleDirectly = () => {
    const list = getSample50DriversList();
    setParsedDrivers(list);
    const dummyFile = new File([generateSample50DriversCSV()], "sample_50_drivers.csv", {
      type: "text/csv",
    });
    setBulkFile(dummyFile);
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

      const parsed: Partial<DriverItem>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[0]) continue;

        const fullName = cols[0];
        const mobileNumber = cols[1];
        const altMobile = cols[2] || null;
        const dl = cols[3] || "";
        const dlFrom = cols[4] || "";
        const dlTo = cols[5] || "";
        const badge = cols[6] || null;
        const badgeTo = cols[7] || null;
        const aadhaar = cols[8] || null;
        const address = cols[9] || null;
        const ownership = cols[10] || OWNERSHIP_TYPES[0];
        const avail = cols[11] || AVAILABILITY_STATUS_OPTIONS[0];
        const lastVerif = cols[12] || null;
        const joining = cols[13] || null;
        const advance = cols[14] || null;
        const ending = cols[15] || null;
        const baseSal = cols[16] || null;
        const mLeave = cols[17] || null;
        const aLeave = cols[18] || null;
        const incNotes = cols[19] || null;
        const upi = cols[20] || null;
        const bank = cols[21] || null;
        const accHolder = cols[22] || null;
        const accNum = cols[23] || null;
        const ifsc = cols[24] || null;
        const isActive = cols[25]?.toLowerCase() !== "inactive" && avail !== "Suspended";

        parsed.push({
          fullName,
          name: fullName,
          mobileNumber,
          mobile: mobileNumber,
          alternateMobileNumber: altMobile,
          photoUrl: null,
          dlNumber: dl,
          licenseNumber: dl,
          dlValidFrom: dlFrom,
          dlValidTo: dlTo,
          badgeNumber: badge,
          badgeValidTo: badgeTo,
          aadhaarNumber: aadhaar,
          currentAddress: address,
          ownershipType: ownership,
          availabilityStatus: avail,
          status: avail,
          lastVerificationDate: lastVerif,
          joiningDate: joining,
          joiningAdvance: advance,
          endingDateDeactivation: ending,
          monthlyBaseSalary: baseSal,
          monthlyLeaveQuota: mLeave,
          annualLeaveQuota: aLeave,
          incidentNotes: incNotes,
          upiId: upi,
          bankName: bank,
          accountHolderName: accHolder,
          accountNumber: accNum,
          ifscCode: ifsc,
          isActive,
        });
      }

      setParsedDrivers(parsed);
    };
    reader.readAsText(file);
  };

  // Execute Bulk Upload to Firestore
  const handleExecuteBulkImport = async () => {
    if (parsedDrivers.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    let count = 0;
    try {
      for (const item of parsedDrivers) {
        await addDoc(collection(db, "drivers"), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count++;
        setImportProgress(Math.round((count / parsedDrivers.length) * 100));
      }

      setFeedback({
        type: "success",
        message: `Successfully imported ${count} commercial drivers into roster!`,
      });
      setIsBulkModalOpen(false);
      setBulkFile(null);
      setParsedDrivers([]);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      console.error("Bulk upload error:", err);
      const msg = err instanceof Error ? err.message : "Bulk upload failed.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Delete Driver Handler
  const handleConfirmDelete = async () => {
    if (!deletingDriver) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "drivers", deletingDriver.id));
      setFeedback({
        type: "success",
        message: `Driver "${deletingDriver.fullName}" deleted.`,
      });
      setDeletingDriver(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting driver:", err);
      setFeedback({ type: "error", message: "Failed to delete driver." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Check if date is valid/future
  const isDateValid = (dateStr?: string | null) => {
    if (!dateStr) return false;
    let parsed: Date;
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const [d, m, y] = dateStr.split("-");
      parsed = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
    } else {
      parsed = new Date(dateStr + "T23:59:59");
    }
    return !isNaN(parsed.getTime()) && parsed >= new Date();
  };

  // Filtered drivers
  const filteredDrivers = drivers.filter((d) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.fullName?.toLowerCase().includes(q) ||
      d.mobileNumber?.includes(q) ||
      d.dlNumber?.toLowerCase().includes(q) ||
      (d.travelName && d.travelName.toLowerCase().includes(q)) ||
      (d.vehicleRegNumber && d.vehicleRegNumber.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
        ? d.isActive !== false
        : statusFilter === "INACTIVE"
        ? d.isActive === false
        : statusFilter === "SUSPENDED"
        ? d.availabilityStatus === "Suspended"
        : statusFilter === "AVAILABLE"
        ? d.availabilityStatus === "Available (On Call)" || d.status === "Available"
        : statusFilter === "ON_TRIP"
        ? d.availabilityStatus === "On Trip"
        : true;

    return matchesSearch && matchesStatus;
  });

  // Pagination calculations (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredDrivers.length);
  const paginatedDrivers = filteredDrivers.slice(startIndex, endIndex);

  // Stats
  const totalCount = drivers.length;
  const activeCount = drivers.filter((d) => d.isActive !== false).length;
  const availableCount = drivers.filter(
    (d) => d.availabilityStatus === "Available (On Call)" || d.status === "Available"
  ).length;

  return (
    <div className="space-y-4">
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-center gap-2 p-3 rounded-[6px] border text-xs font-normal transition-all duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center text-[#f16623]">
              <UserCheck className="w-4 h-4" />
            </div>
            <h1 className="text-base font-medium text-slate-900 tracking-tight">
              Driver Roster & Profiles
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5 ml-9">
            Manage commercial driver licensing credentials, duty shifts, payroll configuration, and banking settlement details.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Bulk Upload Button */}
          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Bulk Upload</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Driver</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Total Drivers</span>
            <span className="text-base font-semibold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Active Roster</span>
            <span className="text-base font-semibold text-emerald-600">{activeCount}</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Available On Call</span>
            <span className="text-base font-semibold text-blue-600">{availableCount}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Search & Filters Bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by driver name, mobile, DL number, plate..."
              className="w-full h-[32px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-48">
            <SearchableSelect
              options={[
                { value: "ALL", label: "All Status" },
                { value: "ACTIVE", label: "Active Only", badge: "Active", badgeColor: "green" },
                { value: "INACTIVE", label: "Inactive Only", badge: "Inactive", badgeColor: "slate" },
                { value: "AVAILABLE", label: "Available (On Call)", badge: "Available", badgeColor: "green" },
                { value: "ON_TRIP", label: "On Trip", badge: "In Trip", badgeColor: "amber" },
                { value: "SUSPENDED", label: "Suspended Only", badge: "Suspended", badgeColor: "red" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filter status..."
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading drivers from Firestore...</span>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
              <UserCheck className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery || statusFilter !== "ALL"
                ? "No matching drivers found"
                : "No drivers registered yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different driver name, phone number, or DL number."
                : "Add your first commercial driver or load the 50 sample dummy drivers list."}
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bulk Upload / 50 Dummy</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddDrawer}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Driver</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Driver Profile</th>
                  <th className="py-2.5 px-3">Mobile Contact</th>
                  <th className="py-2.5 px-3">DL Number & Expiry</th>
                  <th className="py-2.5 px-3">Ownership & Duty</th>
                  <th className="py-2.5 px-3">Assigned Vehicle</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDrivers.map((d, idx) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                      {startIndex + idx + 1}
                    </td>

                    {/* Driver Name & Photo */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        {d.photoUrl ? (
                          <img
                            src={d.photoUrl}
                            alt={d.fullName}
                            className="w-8 h-8 rounded-[4px] object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-[4px] bg-[#f16623]/10 text-[#f16623] border border-[#f16623]/20 flex items-center justify-center font-medium text-xs shrink-0">
                            {d.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-slate-900 block leading-tight text-xs">
                            {d.fullName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {d.travelName || "In-House Fleet"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Mobile Contact */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${d.mobileNumber}`}
                          className="font-mono text-slate-700 hover:text-[#f16623] transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{d.mobileNumber}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(d.mobileNumber, `mob-${d.id}`)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedId === `mob-${d.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* DL Number & Expiry */}
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-slate-800 bg-slate-100/90 border border-slate-200 px-1.5 py-0.5 rounded text-[11px] block w-fit">
                        {d.dlNumber}
                      </span>
                      {d.dlValidTo && (
                        <span
                          className={`text-[10px] block mt-0.5 font-normal ${
                            isDateValid(d.dlValidTo) ? "text-slate-400" : "text-rose-600 font-medium"
                          }`}
                        >
                          Exp: {d.dlValidTo}
                          {!isDateValid(d.dlValidTo) && " (Expired)"}
                        </span>
                      )}
                    </td>

                    {/* Ownership & Availability */}
                    <td className="py-2.5 px-3">
                      {d.availabilityStatus === "Suspended" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                          <span>Suspended</span>
                        </span>
                      ) : (
                        <span className="text-slate-700 font-medium block text-[11px]">
                          {d.availabilityStatus || "Available"}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 block truncate max-w-[130px] mt-0.5">
                        {d.ownershipType || "Staff"}
                      </span>
                    </td>

                    {/* Assigned Vehicle */}
                    <td className="py-2.5 px-3">
                      {d.vehicleRegNumber ? (
                        <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-800 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                          <Car className="w-3 h-3 text-[#f16623]" />
                          <span>{d.vehicleRegNumber}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unpaired</span>
                      )}
                    </td>

                    {/* Active/Inactive Status */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          d.isActive !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            d.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {d.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingDriver(d)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="View Driver Details"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(d)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="Edit Driver"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingDriver(d)}
                          className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete Driver"
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
        {filteredDrivers.length > 0 && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Showing <span className="font-medium text-slate-800">{startIndex + 1}</span> to{" "}
                <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                <span className="font-medium text-slate-800">{filteredDrivers.length}</span> drivers
              </span>
              <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                {pageSize} per page
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
                onClick={() => setCurrentPage((p) => Math.max(1, Math.min(totalPages, p + 1)))}
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

      {/* 5-Tab OffCanvas Drawer for Add & Edit (Wide: 5xl with 5-column grid) */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        size="2xl"
        widthClassName="max-w-3xl sm:max-w-4xl lg:max-w-5xl"
        title={editingDriverId ? "Edit Driver Profile" : "Add New Commercial Driver"}
        subtitle="Complete onboarding: Core Profile, Licensing, Ops & HR, Payout & Banking, and Status."
      >
        <div className="space-y-4">
          {/* Stepper Tabs Bar (No scroll, 5-column grid) */}
          <div className="border-b border-slate-200 pb-2">
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {[
                { step: 1, label: "Core Profile", icon: User },
                { step: 2, label: "Licensing", icon: IdCard },
                { step: 3, label: "Ops & HR", icon: Briefcase },
                { step: 4, label: "Payout & Banking", icon: CreditCard },
                { step: 5, label: "Status", icon: ShieldCheck },
              ].map(({ step, label, icon: TabIcon }) => {
                const isCurrent = activeTab === step;
                const isUnlocked = unlockedTabs.includes(step);

                return (
                  <button
                    key={step}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => setActiveTab(step as any)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-[6px] text-xs font-medium transition cursor-pointer text-center ${
                      isCurrent
                        ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                        : isUnlocked
                        ? "text-slate-700 hover:bg-slate-100 bg-slate-50 border border-slate-200/60"
                        : "text-slate-300 bg-slate-50/50 cursor-not-allowed"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${
                        isCurrent
                          ? "bg-white/20 text-white"
                          : isUnlocked
                          ? "bg-slate-200 text-slate-700"
                          : "bg-slate-100 text-slate-300"
                      }`}
                    >
                      {step}
                    </span>
                    <TabIcon className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Alert */}
          {tabError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium block">Required Information</span>
                <span className="font-normal">{tabError}</span>
              </div>
            </div>
          )}

          {uploadProgressText && (
            <div className="flex items-center gap-2 p-2.5 rounded-[6px] text-xs font-normal border bg-orange-50 text-[#f16623] border-[#f16623]/30">
              <Loader2 className="w-4 h-4 animate-spin text-[#f16623] shrink-0" />
              <span>{uploadProgressText}</span>
            </div>
          )}

          <form onSubmit={handleSaveDriver} className="space-y-4">
            {/* STEP 1: CORE PROFILE (From User Image 1) */}
            {activeTab === 1 && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Full Name <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Mobile Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Mobile Number (India) <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="9874589654"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Used for SMS assignment updates. Format: 10 digits.
                    </span>
                  </div>

                  {/* Alternate Mobile Number */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Alternate Mobile Number <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      value={alternateMobileNumber}
                      onChange={(e) => setAlternateMobileNumber(e.target.value)}
                      placeholder="Secondary contact number"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Driver Photo Upload */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                  <label className="block text-xs font-medium text-slate-700 mb-2 uppercase tracking-wide text-[10px]">
                    Driver Photo <span className="text-slate-400 font-normal lowercase">(ImageKit upload on save)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {imagePreview ? (
                      <div className="relative w-14 h-14 rounded-[6px] overflow-hidden border border-slate-300 shrink-0">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full p-0.5 cursor-pointer transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-[6px] bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-[4px] file:border-0 file:text-xs file:font-medium file:bg-[#f16623] file:text-white hover:file:bg-[#d95318] cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        JPG, PNG up to 8MB.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Continue button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleContinue(2)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <span>Continue to Licensing</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: LICENSING (From User Image 2) */}
            {activeTab === 2 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Safety Alert (From Image 2) */}
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-[6px] text-xs text-orange-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#f16623] shrink-0 mt-0.5" />
                  <span>
                    <strong>Document safety alert:</strong> Licensing checks are mandatory. Drivers with expired Driving Licenses (DL) cannot be scheduled for active trip bookings.
                  </span>
                </div>

                {/* Section Header: Driving Credentials */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 border-b border-slate-100 pb-1.5">
                  <IdCard className="w-4 h-4 text-[#f16623]" />
                  <span>Driving Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* DL Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Driving License (DL) Number <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={dlNumber}
                      onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. TS0920190012345"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* DL Valid From */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      DL Valid From <span className="text-[#f16623]">*</span>
                    </label>
                    <CustomDatePicker
                      value={dlValidFrom}
                      onChange={setDlValidFrom}
                      placeholder="Select DL valid from..."
                    />
                  </div>

                  {/* DL Valid To (Expiry) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      DL Valid To (Expiry) <span className="text-[#f16623]">*</span>
                    </label>
                    <CustomDatePicker
                      value={dlValidTo}
                      onChange={setDlValidTo}
                      placeholder="Select DL expiry..."
                    />
                    {dlValidTo && isDateValid(dlValidTo) && (
                      <span className="text-[10px] text-emerald-600 font-medium block mt-1">
                        Document is valid
                      </span>
                    )}
                  </div>

                  {/* Badge Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Badge Number (Commercial Taxi Badge)
                    </label>
                    <input
                      type="text"
                      value={badgeNumber}
                      onChange={(e) => setBadgeNumber(e.target.value)}
                      placeholder="e.g. BDG-9842"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Badge Valid To */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Badge Valid To
                    </label>
                    <CustomDatePicker
                      value={badgeValidTo}
                      onChange={setBadgeValidTo}
                      placeholder="Select badge expiry..."
                    />
                    {badgeValidTo && isDateValid(badgeValidTo) && (
                      <span className="text-[10px] text-emerald-600 font-medium block mt-1">
                        Document is valid
                      </span>
                    )}
                  </div>

                  {/* Aadhaar Card Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Aadhaar Card Number (Masked)
                    </label>
                    <input
                      type="text"
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value)}
                      placeholder="XXXX-XXXX-1234"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      For record safety. Format suggestion: XXXX-XXXX-1234.
                    </span>
                  </div>

                  {/* Current Address */}
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Current Address
                    </label>
                    <textarea
                      rows={2}
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      placeholder="Residential address, Landmark, City..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Continue button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab(1)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContinue(3)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <span>Continue to Ops & HR</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: OPS & HR (From User Image 3) */}
            {activeTab === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Ownership Type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Ownership Type <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={OWNERSHIP_TYPES.map((ot) => ({ value: ot, label: ot }))}
                      value={ownershipType}
                      onChange={setOwnershipType}
                      placeholder="Select Ownership..."
                    />
                  </div>

                  {/* Availability Status */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Availability Status <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={AVAILABILITY_STATUS_OPTIONS.map((as) => ({
                        value: as,
                        label: as,
                        badge: as,
                        badgeColor:
                          as === "Available"
                            ? ("green" as const)
                            : as === "In Trip"
                            ? ("amber" as const)
                            : ("red" as const),
                      }))}
                      value={availabilityStatus}
                      onChange={setAvailabilityStatus}
                      placeholder="Select Availability..."
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      System tracks driver status when assigned to bookings.
                    </span>
                  </div>

                  {/* Last Verification Date */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Last Verification Date
                    </label>
                    <CustomDatePicker
                      value={lastVerificationDate}
                      onChange={setLastVerificationDate}
                      placeholder="Select verification date..."
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      When documents were last manually verified.
                    </span>
                  </div>
                </div>

                {/* Paired Vehicle & Travel Assignment */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Assigned Vehicle <span className="text-slate-400 font-normal lowercase">(optional pairing)</span>
                    </label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "-- No vehicle assigned --" },
                        ...vehiclesList.map((veh) => ({
                          value: veh.id,
                          label: `${veh.regNumber} (${veh.vehicleName})`,
                          subLabel: veh.vehicleName,
                        })),
                      ]}
                      value={selectedVehicleId}
                      onChange={(vId) => {
                        setSelectedVehicleId(vId);
                        const found = vehiclesList.find((v) => v.id === vId);
                        setSelectedVehicleName(found?.vehicleName || "");
                        setSelectedVehicleReg(found?.regNumber || "");
                      }}
                      placeholder="Select Assigned Vehicle..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Assigned Travel / Agency
                    </label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "-- In-House Staff --" },
                        ...travelsList.map((tr) => ({
                          value: tr.id,
                          label: tr.travelName,
                          subLabel: tr.mobileNumber,
                        })),
                      ]}
                      value={selectedTravelId}
                      onChange={(tId) => {
                        setSelectedTravelId(tId);
                        const found = travelsList.find((t) => t.id === tId);
                        setSelectedTravelName(found?.travelName || "");
                      }}
                      placeholder="Select Travel / Agency..."
                    />
                  </div>
                </div>

                {/* Section Header: HR & Payroll Configuration (From Image 3) */}
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 border-b border-slate-100 pb-1.5">
                  <Briefcase className="w-4 h-4 text-[#f16623]" />
                  <span>HR & Payroll Configuration</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Joining Date */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Joining Date
                    </label>
                    <CustomDatePicker
                      value={joiningDate}
                      onChange={setJoiningDate}
                      placeholder="Select joining date..."
                    />
                  </div>

                  {/* Joining Advance (₹) (Plain number input, no arrows, scroll-blocked, starts empty) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Joining Advance (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={joiningAdvance}
                      onChange={(e) => setJoiningAdvance(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="e.g. 5000"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Ending Date (Deactivation) */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Ending Date (Deactivation)
                    </label>
                    <CustomDatePicker
                      value={endingDateDeactivation}
                      onChange={setEndingDateDeactivation}
                      placeholder="Select ending date..."
                      minDate={joiningDate}
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Setting this date auto-deactivates the driver.
                    </span>
                  </div>

                  {/* Monthly Base Salary */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Monthly Base Salary (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={monthlyBaseSalary}
                      onChange={(e) => setMonthlyBaseSalary(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="Salary contract"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Internal reference payroll salary baseline.
                    </span>
                  </div>

                  {/* Monthly Leave Quota */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Monthly Leave Quota (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={monthlyLeaveQuota}
                      onChange={(e) => setMonthlyLeaveQuota(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="e.g. 2"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Combined CL/SL monthly quota limit.
                    </span>
                  </div>

                  {/* Annual Leave Quota */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Annual Leave Quota (Days)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={annualLeaveQuota}
                      onChange={(e) => setAnnualLeaveQuota(e.target.value)}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      placeholder="e.g. 24"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Reset on April 1 (FY-based quota).
                    </span>
                  </div>
                </div>

                {/* Attendance Note (From Image 3) */}
                <div className="p-3 bg-orange-50/70 border border-orange-200 rounded-[6px] text-xs text-orange-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#f16623] shrink-0" />
                    <span>
                      <strong>Attendance Note:</strong> Daily attendance tracking, leave requests, and holiday calculations are managed separately.
                    </span>
                  </div>
                  <span className="text-[11px] text-[#f16623] font-medium shrink-0 ml-2">
                    View Attendance →
                  </span>
                </div>

                {/* Incident Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                    Incident Notes (Discipline Record & Safety Logs)
                  </label>
                  <textarea
                    rows={2}
                    value={incidentNotes}
                    onChange={(e) => setIncidentNotes(e.target.value)}
                    placeholder="Log incident notes, policy violations or performance comments..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>

                {/* Continue button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab(2)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContinue(4)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <span>Continue to Payout & Banking</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: PAYOUT & BANKING (From User Image 4) */}
            {activeTab === 4 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Alert banner from Image 4 */}
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-[6px] text-xs text-orange-900 flex items-start gap-2">
                  <CreditCard className="w-4 h-4 text-[#f16623] shrink-0 mt-0.5" />
                  <span>
                    <strong>Reconciliation reference:</strong> Payout details are used for driver settlement records and staff payments. Banking details never print on customer invoices.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* UPI ID */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      UPI ID for Quick Payout
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="e.g. ravikumar@ybl"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Bank Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Account Holder Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      placeholder="Name as in bank records"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Enter bank account number"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* IFSC Code */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      placeholder="11-DIGIT BANK IFSC"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Continue button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab(3)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContinue(5)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <span>Continue to Status</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: STATUS & SAVE (User: "in last Staus step there i need active or inactive toggle then save the details") */}
            {activeTab === 5 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Active / Inactive Status Toggle */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-800 block">
                      Driver Account Status
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Active drivers can be assigned to active passenger booking manifests and dispatches.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      isActive ? "bg-[#f16623]" : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                        isActive ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Profile Review Summary */}
                <div className="p-3.5 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
                  <span className="font-medium text-slate-800 block text-xs border-b border-slate-100 pb-1">
                    Onboarding Dossier Review
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Driver Name:</span>
                      <span className="font-medium text-slate-800">{fullName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Mobile:</span>
                      <span className="font-medium text-slate-800 font-mono">{mobileNumber || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">DL Number:</span>
                      <span className="font-medium text-slate-800 font-mono">{dlNumber || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">DL Expiry:</span>
                      <span className="font-medium text-slate-800">{dlValidTo || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Ownership:</span>
                      <span className="font-medium text-slate-800">{ownershipType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Duty Status:</span>
                      <span className="font-medium text-slate-800">{availabilityStatus}</span>
                    </div>
                  </div>
                </div>

                {/* Final Form Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTab(4)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] disabled:opacity-50 transition cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{editingDriverId ? "Update Driver Details" : "Save Driver"}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </OffCanvas>

      {/* View Details OffCanvas Drawer */}
      <OffCanvas
        isOpen={Boolean(viewingDriver)}
        onClose={() => setViewingDriver(null)}
        title="Driver Profile & Commercial Dossier"
        subtitle="Licensing credentials, duty status, payroll, and banking settlement records."
        size="md"
      >
        {viewingDriver && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[6px]">
              <div className="flex items-center gap-3">
                {viewingDriver.photoUrl ? (
                  <img
                    src={viewingDriver.photoUrl}
                    alt={viewingDriver.fullName}
                    className="w-12 h-12 rounded-[6px] object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[6px] bg-[#f16623]/10 text-[#f16623] border border-[#f16623]/20 flex items-center justify-center font-bold text-sm shrink-0">
                    {viewingDriver.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900 truncate">
                      {viewingDriver.fullName}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${
                        viewingDriver.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {viewingDriver.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                    {viewingDriver.ownershipType || "Staff"} • {viewingDriver.availabilityStatus}
                  </span>
                </div>
              </div>

              {/* Quick Contacts */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center gap-2 text-xs">
                <a
                  href={`tel:${viewingDriver.mobileNumber}`}
                  className="flex-1 p-2 rounded bg-white border border-slate-200 text-slate-700 hover:text-[#f16623] hover:border-[#f16623]/30 inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#f16623]" />
                  <span className="font-mono text-[11px] font-medium">{viewingDriver.mobileNumber}</span>
                </a>
                {viewingDriver.alternateMobileNumber && (
                  <a
                    href={`tel:${viewingDriver.alternateMobileNumber}`}
                    className="p-2 rounded bg-white border border-slate-200 text-slate-600 hover:text-[#f16623] inline-flex items-center gap-1 text-[11px] font-mono cursor-pointer"
                    title="Alternate number"
                  >
                    <span>Alt: {viewingDriver.alternateMobileNumber}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Licensing Credentials */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
              <span className="font-medium text-slate-800 block text-xs border-b border-slate-100 pb-1">
                Licensing & Badge Credentials
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">DL Number:</span>
                  <span className="font-mono font-medium text-slate-800">{viewingDriver.dlNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">DL Expiry:</span>
                  <span
                    className={`font-medium ${
                      isDateValid(viewingDriver.dlValidTo) ? "text-emerald-700" : "text-rose-600"
                    }`}
                  >
                    {viewingDriver.dlValidTo || "—"}
                  </span>
                </div>
                {viewingDriver.badgeNumber && (
                  <div>
                    <span className="text-slate-400 block">Badge No:</span>
                    <span className="font-mono font-medium text-slate-800">{viewingDriver.badgeNumber}</span>
                  </div>
                )}
                {viewingDriver.aadhaarNumber && (
                  <div>
                    <span className="text-slate-400 block">Aadhaar:</span>
                    <span className="font-mono text-slate-700">{viewingDriver.aadhaarNumber}</span>
                  </div>
                )}
              </div>
              {viewingDriver.currentAddress && (
                <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-600">
                  <span className="text-slate-400 block">Address:</span>
                  <span>{viewingDriver.currentAddress}</span>
                </div>
              )}
            </div>

            {/* HR & Payroll */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
              <span className="font-medium text-slate-800 block text-xs border-b border-slate-100 pb-1">
                HR & Payroll Details
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Monthly Base:</span>
                  <span className="font-medium text-slate-800">
                    {viewingDriver.monthlyBaseSalary ? `₹${viewingDriver.monthlyBaseSalary}` : "Contract"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Joining Advance:</span>
                  <span className="font-medium text-slate-800">
                    {viewingDriver.joiningAdvance ? `₹${viewingDriver.joiningAdvance}` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Leave Quota:</span>
                  <span className="text-slate-700">
                    {viewingDriver.monthlyLeaveQuota ? `${viewingDriver.monthlyLeaveQuota} days/mo` : "Standard"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Joining Date:</span>
                  <span className="text-slate-700">{viewingDriver.joiningDate || "—"}</span>
                </div>
              </div>
            </div>

            {/* Payout & Banking */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
              <span className="font-medium text-slate-800 block text-xs border-b border-slate-100 pb-1">
                Payout & Settlement Details
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="col-span-2">
                  <span className="text-slate-400 block">UPI ID:</span>
                  <span className="font-mono font-medium text-slate-800">{viewingDriver.upiId || "None"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Bank Name:</span>
                  <span className="text-slate-700">{viewingDriver.bankName || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">A/C Number:</span>
                  <span className="font-mono text-slate-800">{viewingDriver.accountNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC Code:</span>
                  <span className="font-mono text-slate-800">{viewingDriver.ifscCode || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">A/C Holder:</span>
                  <span className="text-slate-700">{viewingDriver.accountHolderName || "—"}</span>
                </div>
              </div>
            </div>

            {/* Close & Edit buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingDriver(null)}
                className="h-[32px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingDriver;
                  setViewingDriver(null);
                  handleOpenEditDrawer(target);
                }}
                className="h-[32px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1 hover:bg-[#d95318] transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Driver</span>
              </button>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* Bulk Upload Modal with Sample 50 Drivers Generator */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900">
                    Bulk Upload Commercial Drivers
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Import driver credentials, licensing, HR payroll, and payout details via CSV.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setParsedDrivers([]);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Download Sample File & Direct 50 Sample Loader */}
            <div className="p-3.5 bg-orange-50/70 border border-[#f16623]/20 rounded-[6px] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-medium text-slate-800 block">
                    Need a pre-filled Excel/CSV template?
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Includes 50 realistic Indian commercial drivers with DL credentials, payroll, and banking details.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadSampleFile}
                    className="h-[30px] px-3 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f16623]" />
                    <span>Download CSV (50)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLoad50SampleDirectly}
                    className="h-[30px] px-3 rounded-[6px] bg-[#f16623] text-white text-[11px] font-medium inline-flex items-center gap-1 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>Load 50 Sample Drivers</span>
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload Drop Zone */}
            <div className="border-2 border-dashed border-slate-200 rounded-[6px] p-5 text-center hover:border-[#f16623]/50 transition bg-slate-50/50">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
              <label className="text-xs font-medium text-slate-700 block cursor-pointer">
                <span className="text-[#f16623] hover:underline">Click to browse</span> or drag and drop your CSV file
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleBulkFileSelected}
                  className="hidden"
                />
              </label>
              <span className="text-[10px] text-slate-400 block mt-1">
                Supported formats: CSV with standard comma headers (Full Name, Mobile, DL Number, etc.)
              </span>
              {bulkFile && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selected: <strong>{bulkFile.name}</strong></span>
                </div>
              )}
            </div>

            {/* Parsed Preview Table */}
            {parsedDrivers.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-medium">
                    Ready to import ({parsedDrivers.length} drivers detected)
                  </span>
                  <span className="text-[11px] text-slate-400">Previewing first 5 rows</span>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2">Driver Name</th>
                        <th className="py-1.5 px-2">Mobile</th>
                        <th className="py-1.5 px-2">DL Number</th>
                        <th className="py-1.5 px-2">Ownership</th>
                        <th className="py-1.5 px-2">Duty Status</th>
                        <th className="py-1.5 px-2">DL Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {parsedDrivers.slice(0, 5).map((pd, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-medium">{pd.fullName}</td>
                          <td className="py-1.5 px-2 font-mono text-[10px]">{pd.mobileNumber}</td>
                          <td className="py-1.5 px-2 font-mono text-[10px]">{pd.dlNumber}</td>
                          <td className="py-1.5 px-2">{pd.ownershipType}</td>
                          <td className="py-1.5 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                pd.availabilityStatus === "Suspended"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : pd.availabilityStatus === "On Trip"
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {pd.availabilityStatus}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-[10px]">{pd.dlValidTo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedDrivers.length > 5 && (
                    <div className="p-1.5 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      ...and {parsedDrivers.length - 5} more drivers
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {isImporting && (
              <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-[6px]">
                <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f16623]" />
                    <span>Saving drivers to Firestore...</span>
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
                    setParsedDrivers([]);
                  }
                }}
                disabled={isImporting}
                className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkImport}
                disabled={isImporting || parsedDrivers.length === 0}
                className="h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>
                  {isImporting ? "Importing Drivers..." : `Import ${parsedDrivers.length} Drivers`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-900">Delete Driver Record?</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 font-medium">{deletingDriver.fullName}</strong>?
              This will remove their profile from the roster.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingDriver(null)}
                className="h-[32px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="h-[32px] px-3.5 rounded-[6px] bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-rose-700 transition cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
