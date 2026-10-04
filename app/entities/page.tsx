"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  ArrowLeft,
  Landmark,
  FileText,
  Fuel,
  Image as ImageIcon,
  Check,
  UploadCloud,
  X,
  MapPin,
  Calendar,
  Sparkles,
  Edit2,
  CheckCircle,
  Eye,
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
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";

// --- Types & Data Models ---

export interface BankAccountItem {
  id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  branchName?: string;
  accountType: "Current" | "Savings" | "Overdraft" | "Cash Credit";
  effectiveFrom: string;
  isDefault: boolean;
}

export interface NumberingSeriesItem {
  id: string;
  documentType: string;
  financialYear: string;
  prefix: string;
  suffix?: string;
  zeroPadWidth: number;
  nextNumber: number;
  resetRule: "Yearly" | "Monthly" | "Never";
  preview: string;
  isActive: boolean;
}

export interface FuelRatesVersionItem {
  id: string;
  petrolPrice: number | string;
  dieselPrice: number | string;
  cngPrice?: number | string;
  evRate: number | string;
  hybridRate?: number | string;
  effectiveFrom: string;
  effectiveTo?: string;
  revisionNotes?: string;
  isCurrentActive: boolean;
}

export interface EntityFullRecord {
  id: string;
  // Step 1: Profile (Identity & Address)
  entityCode: string;
  legalName: string;
  tradeName?: string;
  pan?: string;
  cin?: string;
  cgstRate: number | string;
  sgstRate: number | string;
  igstRate: number | string;
  emailForPrint?: string;
  phoneForPrint?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  pin: string;
  supplierState: string;

  // Step 2: Bank Accounts
  bankAccounts: BankAccountItem[];

  // Step 3: Invoice Setting & Numbering
  numberingSeries: NumberingSeriesItem[];

  // Step 4: Fuel Rates
  fuelRates: FuelRatesVersionItem[];

  // Step 5: Branding
  logoUrl?: string;
  signatureUrl?: string;

  // Step 6: Status
  isActive: boolean;

  // Compatibility fields for legacy queries (travels, mobileNumber, entityName)
  entityName: string;
  travelName: string;
  mobileNumber: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  _sourceCollection?: "entities" | "travels";
}

const ITEMS_PER_PAGE = 24;

export const INDIAN_STATES = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

type EntityTab =
  | "Profile"
  | "Bank Accounts"
  | "Numbering & Series"
  | "Fuel Rates"
  | "Branding"
  | "Status";

export default function EntitiesPage() {
  // Mode: "list" | "create" | "edit"
  const [viewMode, setViewMode] = useState<"list" | "create" | "edit">("list");
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [viewingEntity, setViewingEntity] = useState<EntityFullRecord | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<EntityTab>("Profile");

  // Step 1: Profile State
  const [entityCode, setEntityCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [pan, setPan] = useState("");
  const [cin, setCin] = useState("");
  const [cgstRate, setCgstRate] = useState<number | string>("2.50");
  const [sgstRate, setSgstRate] = useState<number | string>("2.50");
  const [igstRate, setIgstRate] = useState<number | string>("5.00");
  const [emailForPrint, setEmailForPrint] = useState("");
  const [phoneForPrint, setPhoneForPrint] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [pin, setPin] = useState("");
  const [supplierState, setSupplierState] = useState("04 — Chandigarh");

  // Step 2: Bank Accounts State
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [modalBankName, setModalBankName] = useState("");
  const [modalAccountHolder, setModalAccountHolder] = useState("");
  const [modalAccountNumber, setModalAccountNumber] = useState("");
  const [modalIfscCode, setModalIfscCode] = useState("");
  const [modalBranchName, setModalBranchName] = useState("");
  const [modalAccountType, setModalAccountType] = useState<
    "Current" | "Savings" | "Overdraft" | "Cash Credit"
  >("Current");
  const [modalEffectiveFrom, setModalEffectiveFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [modalIsDefault, setModalIsDefault] = useState(true);

  // Step 3: Numbering & Series State
  const [numberingSeries, setNumberingSeries] = useState<NumberingSeriesItem[]>([]);
  const [showSeriesModal, setShowSeriesModal] = useState(false);
  const [modalDocType, setModalDocType] = useState("Invoice");
  const [modalFinancialYear, setModalFinancialYear] = useState("2026-27");
  const [modalPrefix, setModalPrefix] = useState("");
  const [modalSuffix, setModalSuffix] = useState("");
  const [modalZeroPadWidth, setModalZeroPadWidth] = useState<number>(4);
  const [modalNextNumber, setModalNextNumber] = useState<number>(1);
  const [modalResetRule, setModalResetRule] = useState<"Yearly" | "Monthly" | "Never">(
    "Yearly"
  );

  // Step 4: Fuel Rates State
  const [fuelRates, setFuelRates] = useState<FuelRatesVersionItem[]>([]);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [modalPetrolPrice, setModalPetrolPrice] = useState<number | string>("");
  const [modalDieselPrice, setModalDieselPrice] = useState<number | string>("");
  const [modalCngPrice, setModalCngPrice] = useState<number | string>("");
  const [modalEvRate, setModalEvRate] = useState<number | string>("");
  const [modalHybridRate, setModalHybridRate] = useState<number | string>("");
  const [modalFuelEffectiveFrom, setModalFuelEffectiveFrom] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [modalFuelEffectiveTo, setModalFuelEffectiveTo] = useState("");
  const [modalRevisionNotes, setModalRevisionNotes] = useState("");
  const [modalFuelIsCurrentActive, setModalFuelIsCurrentActive] = useState(true);

  // Step 5: Branding State (Files held locally until final Save)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>("");
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string>("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Step 6: Status State
  const [isActiveEntity, setIsActiveEntity] = useState(true);

  // General list, search, pagination & feedback
  const [entitiesMap, setEntitiesMap] = useState<Map<string, EntityFullRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Real-time Firestore synchronization for "entities" & legacy "travels"
  useEffect(() => {
    let unsubs: Array<() => void> = [];

    try {
      // 1. Primary "entities" collection
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
              const rec: EntityFullRecord = {
                id: docSnap.id,
                entityCode: data.entityCode || "",
                legalName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                tradeName: data.tradeName || "",
                pan: data.pan || "",
                cin: data.cin || "",
                cgstRate: data.cgstRate ?? "2.50",
                sgstRate: data.sgstRate ?? "2.50",
                igstRate: data.igstRate ?? "5.00",
                emailForPrint: data.emailForPrint || "",
                phoneForPrint: data.phoneForPrint || data.mobileNumber || "",
                addressLine1: data.addressLine1 || "",
                addressLine2: data.addressLine2 || "",
                city: data.city || "",
                pin: data.pin || "",
                supplierState: data.supplierState || "04 — Chandigarh",
                bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts : [],
                numberingSeries: Array.isArray(data.numberingSeries) ? data.numberingSeries : [],
                fuelRates: Array.isArray(data.fuelRates) ? data.fuelRates : [],
                logoUrl: data.logoUrl || "",
                signatureUrl: data.signatureUrl || "",
                isActive: data.isActive !== false,
                entityName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                travelName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                mobileNumber: data.phoneForPrint || data.mobileNumber || "",
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                _sourceCollection: "entities",
              };
              next.set(docSnap.id, rec);
            });
            return next;
          });
          setLoading(false);
        },
        (error) => {
          console.warn("Entities query error, falling back:", error);
          const fallbackQ = query(collection(db, "entities"));
          const unsubFallback = onSnapshot(fallbackQ, (snapshot) => {
            setEntitiesMap((prev) => {
              const next = new Map(prev);
              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const rec: EntityFullRecord = {
                  id: docSnap.id,
                  entityCode: data.entityCode || "",
                  legalName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                  tradeName: data.tradeName || "",
                  pan: data.pan || "",
                  cin: data.cin || "",
                  cgstRate: data.cgstRate ?? "2.50",
                  sgstRate: data.sgstRate ?? "2.50",
                  igstRate: data.igstRate ?? "5.00",
                  emailForPrint: data.emailForPrint || "",
                  phoneForPrint: data.phoneForPrint || data.mobileNumber || "",
                  addressLine1: data.addressLine1 || "",
                  addressLine2: data.addressLine2 || "",
                  city: data.city || "",
                  pin: data.pin || "",
                  supplierState: data.supplierState || "04 — Chandigarh",
                  bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts : [],
                  numberingSeries: Array.isArray(data.numberingSeries) ? data.numberingSeries : [],
                  fuelRates: Array.isArray(data.fuelRates) ? data.fuelRates : [],
                  logoUrl: data.logoUrl || "",
                  signatureUrl: data.signatureUrl || "",
                  isActive: data.isActive !== false,
                  entityName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                  travelName: data.legalName || data.entityName || data.travelName || "Unnamed Entity",
                  mobileNumber: data.phoneForPrint || data.mobileNumber || "",
                  createdAt: data.createdAt || null,
                  updatedAt: data.updatedAt || null,
                  _sourceCollection: "entities",
                };
                next.set(docSnap.id, rec);
              });
              return next;
            });
            setLoading(false);
          });
          unsubs.push(unsubFallback);
        }
      );
      unsubs.push(unsubEntities);

      // 2. Legacy "travels" collection to preserve existing records
      const qTravels = query(collection(db, "travels"), orderBy("createdAt", "desc"));
      const unsubTravels = onSnapshot(
        qTravels,
        (snapshot) => {
          setEntitiesMap((prev) => {
            const next = new Map(prev);
            snapshot.docs.forEach((docSnap) => {
              if (!next.has(docSnap.id)) {
                const data = docSnap.data();
                const name = data.entityName || data.travelName || "Unnamed Travel";
                const rec: EntityFullRecord = {
                  id: docSnap.id,
                  entityCode: data.entityCode || name.substring(0, 6).toUpperCase().replace(/\s/g, ""),
                  legalName: name,
                  tradeName: data.tradeName || "",
                  pan: data.pan || "",
                  cin: data.cin || "",
                  cgstRate: data.cgstRate ?? "2.50",
                  sgstRate: data.sgstRate ?? "2.50",
                  igstRate: data.igstRate ?? "5.00",
                  emailForPrint: data.emailForPrint || "",
                  phoneForPrint: data.mobileNumber || "",
                  addressLine1: data.addressLine1 || "",
                  addressLine2: data.addressLine2 || "",
                  city: data.city || "",
                  pin: data.pin || "",
                  supplierState: data.supplierState || "04 — Chandigarh",
                  bankAccounts: Array.isArray(data.bankAccounts) ? data.bankAccounts : [],
                  numberingSeries: Array.isArray(data.numberingSeries) ? data.numberingSeries : [],
                  fuelRates: Array.isArray(data.fuelRates) ? data.fuelRates : [],
                  logoUrl: data.logoUrl || "",
                  signatureUrl: data.signatureUrl || "",
                  isActive: data.isActive !== false,
                  entityName: name,
                  travelName: name,
                  mobileNumber: data.mobileNumber || "",
                  createdAt: data.createdAt || null,
                  _sourceCollection: "travels",
                };
                next.set(docSnap.id, rec);
              }
            });
            return next;
          });
          setLoading(false);
        },
        (err) => {
          console.warn("Legacy travels listener warning:", err);
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

  // Filtered & Paginated Entities
  const filteredEntities = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return entitiesList;
    return entitiesList.filter(
      (item) =>
        item.legalName?.toLowerCase().includes(q) ||
        item.entityCode?.toLowerCase().includes(q) ||
        item.phoneForPrint?.includes(q) ||
        item.mobileNumber?.includes(q) ||
        item.city?.toLowerCase().includes(q)
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

  // Open Create Entity Wizard
  const handleOpenCreate = () => {
    setEditingEntityId(null);
    setActiveTab("Profile");
    // Clear all fields
    setEntityCode("");
    setLegalName("");
    setTradeName("");
    setPan("");
    setCin("");
    setCgstRate("2.50");
    setSgstRate("2.50");
    setIgstRate("5.00");
    setEmailForPrint("");
    setPhoneForPrint("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setPin("");
    setSupplierState("04 — Chandigarh");

    setBankAccounts([]);
    setNumberingSeries([]);
    setFuelRates([]);

    setLogoFile(null);
    setLogoPreviewUrl("");
    setSignatureFile(null);
    setSignaturePreviewUrl("");

    setIsActiveEntity(true);
    setViewMode("create");
  };

  // Open Edit Entity Wizard
  const handleOpenEdit = (entity: EntityFullRecord) => {
    setEditingEntityId(entity.id);
    setActiveTab("Profile");

    setEntityCode(entity.entityCode || "");
    setLegalName(entity.legalName || entity.entityName || "");
    setTradeName(entity.tradeName || "");
    setPan(entity.pan || "");
    setCin(entity.cin || "");
    setCgstRate(entity.cgstRate ?? "2.50");
    setSgstRate(entity.sgstRate ?? "2.50");
    setIgstRate(entity.igstRate ?? "5.00");
    setEmailForPrint(entity.emailForPrint || "");
    setPhoneForPrint(entity.phoneForPrint || entity.mobileNumber || "");

    setAddressLine1(entity.addressLine1 || "");
    setAddressLine2(entity.addressLine2 || "");
    setCity(entity.city || "");
    setPin(entity.pin || "");
    setSupplierState(entity.supplierState || "04 — Chandigarh");

    setBankAccounts(entity.bankAccounts || []);
    setNumberingSeries(entity.numberingSeries || []);
    setFuelRates(entity.fuelRates || []);

    setLogoFile(null);
    setLogoPreviewUrl(entity.logoUrl || "");
    setSignatureFile(null);
    setSignaturePreviewUrl(entity.signatureUrl || "");

    setIsActiveEntity(entity.isActive !== false);
    setViewMode("edit");
  };

  // Handle Delete Entity
  const handleDelete = async (item: EntityFullRecord) => {
    if (!confirm(`Are you sure you want to remove entity "${item.legalName}"?`)) return;
    try {
      const colName = item._sourceCollection || "entities";
      await deleteDoc(doc(db, colName, item.id));
      setFeedback({
        type: "success",
        message: `Entity "${item.legalName}" was removed.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error("Error deleting entity:", err);
      setFeedback({
        type: "error",
        message: "Failed to delete entity record.",
      });
    }
  };

  // --- Sub-Modal: Add Bank Account ---
  const handleOpenAddBank = () => {
    setModalBankName("");
    setModalAccountHolder(legalName || "");
    setModalAccountNumber("");
    setModalIfscCode("");
    setModalBranchName("");
    setModalAccountType("Current");
    setModalEffectiveFrom(new Date().toISOString().split("T")[0]);
    // If no bank accounts exist yet, default it to true
    setModalIsDefault(bankAccounts.length === 0);
    setShowBankModal(true);
  };

  const handleSaveBankModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalBankName.trim() || !modalAccountNumber.trim() || !modalIfscCode.trim()) {
      alert("Please enter Bank Name, Account Number, and IFSC Code.");
      return;
    }

    const newAcc: BankAccountItem = {
      id: `bank-${Date.now()}`,
      bankName: modalBankName.trim(),
      accountHolderName: modalAccountHolder.trim() || legalName || "Authorized Account",
      accountNumber: modalAccountNumber.trim(),
      ifscCode: modalIfscCode.trim().toUpperCase(),
      branchName: modalBranchName.trim(),
      accountType: modalAccountType,
      effectiveFrom: modalEffectiveFrom,
      isDefault: modalIsDefault,
    };

    setBankAccounts((prev) => {
      let updated = [...prev];
      if (newAcc.isDefault) {
        updated = updated.map((acc) => ({ ...acc, isDefault: false }));
      }
      return [...updated, newAcc];
    });

    setShowBankModal(false);
  };

  const handleSetDefaultBank = (accountId: string) => {
    setBankAccounts((prev) =>
      prev.map((acc) => ({
        ...acc,
        isDefault: acc.id === accountId,
      }))
    );
  };

  const handleDeleteBank = (accountId: string) => {
    setBankAccounts((prev) => {
      const filtered = prev.filter((acc) => acc.id !== accountId);
      // If we deleted the default account, make the first one default
      if (filtered.length > 0 && !filtered.some((acc) => acc.isDefault)) {
        filtered[0].isDefault = true;
      }
      return filtered;
    });
  };

  // --- Sub-Modal: Add Numbering Series ---
  const handleOpenAddSeries = () => {
    setModalDocType("Invoice");
    setModalFinancialYear("2026-27");
    const autoPrefix = `${(entityCode || "RK").substring(0, 3).toUpperCase()}202627`;
    setModalPrefix(autoPrefix);
    setModalSuffix("Auto from entity code");
    setModalZeroPadWidth(4);
    setModalNextNumber(1);
    setModalResetRule("Yearly");
    setShowSeriesModal(true);
  };

  const computedSeriesPreview = useMemo(() => {
    const pad = Math.max(1, Math.min(8, modalZeroPadWidth || 4));
    const numStr = String(modalNextNumber || 1).padStart(pad, "0");
    const prefix = modalPrefix.trim();
    return `${prefix}${numStr}`;
  }, [modalPrefix, modalNextNumber, modalZeroPadWidth]);

  const handleSaveSeriesModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalDocType.trim() || !modalFinancialYear.trim()) {
      alert("Please fill in Document Type and Financial Year.");
      return;
    }

    const newSeries: NumberingSeriesItem = {
      id: `series-${Date.now()}`,
      documentType: modalDocType.trim(),
      financialYear: modalFinancialYear.trim(),
      prefix: modalPrefix.trim(),
      suffix: modalSuffix.trim(),
      zeroPadWidth: Number(modalZeroPadWidth) || 4,
      nextNumber: Number(modalNextNumber) || 1,
      resetRule: modalResetRule,
      preview: computedSeriesPreview,
      isActive: true,
    };

    setNumberingSeries((prev) => [...prev, newSeries]);
    setShowSeriesModal(false);
  };

  const handleDeleteSeries = (seriesId: string) => {
    setNumberingSeries((prev) => prev.filter((s) => s.id !== seriesId));
  };

  // --- Sub-Modal: Add Fuel Rates ---
  const handleOpenAddFuel = () => {
    setModalPetrolPrice("");
    setModalDieselPrice("");
    setModalCngPrice("");
    setModalEvRate("");
    setModalHybridRate("");
    setModalFuelEffectiveFrom(new Date().toISOString().split("T")[0]);
    setModalFuelEffectiveTo("");
    setModalRevisionNotes("Monthly Fuel Price Update, Q1 Revision");
    setModalFuelIsCurrentActive(true);
    setShowFuelModal(true);
  };

  const handleSaveFuelModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPetrolPrice || !modalDieselPrice || !modalEvRate) {
      alert("Please provide Petrol Price, Diesel Price, and EV Rate.");
      return;
    }

    const newVersion: FuelRatesVersionItem = {
      id: `fuel-${Date.now()}`,
      petrolPrice: modalPetrolPrice,
      dieselPrice: modalDieselPrice,
      cngPrice: modalCngPrice || "",
      evRate: modalEvRate,
      hybridRate: modalHybridRate || modalPetrolPrice,
      effectiveFrom: modalFuelEffectiveFrom,
      effectiveTo: modalFuelEffectiveTo.trim() || undefined,
      revisionNotes: modalRevisionNotes.trim(),
      isCurrentActive: modalFuelIsCurrentActive,
    };

    setFuelRates((prev) => {
      let updated = [...prev];
      if (newVersion.isCurrentActive) {
        updated = updated.map((v) => ({ ...v, isCurrentActive: false }));
      }
      return [...updated, newVersion];
    });

    setShowFuelModal(false);
  };

  const handleDeleteFuel = (fuelId: string) => {
    setFuelRates((prev) => prev.filter((f) => f.id !== fuelId));
  };

  // --- Step 5: Branding File Change Handlers ---
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreviewUrl(url);
    }
  };

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const url = URL.createObjectURL(file);
      setSignaturePreviewUrl(url);
    }
  };

  // Upload an image File to ImageKit via Next.js `/api/upload`
  const uploadImageToImageKit = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.error || "Failed to upload image to ImageKit");
    }

    return data.url;
  };

  // --- Step 6: Final Submission to ImageKit & Firestore ---
  const handleSaveEntityFinal = async () => {
    setFeedback(null);

    // Basic Validation
    const trimmedCode = entityCode.trim().toUpperCase();
    const trimmedLegal = legalName.trim();

    if (!trimmedCode) {
      setActiveTab("Profile");
      alert("Please enter Entity Code in the Profile tab.");
      return;
    }

    if (!trimmedLegal) {
      setActiveTab("Profile");
      alert("Please enter Legal Name in the Profile tab.");
      return;
    }

    if (!addressLine1.trim() || !city.trim() || !pin.trim()) {
      setActiveTab("Profile");
      alert("Please complete Address Line 1, City, and PIN in the Profile tab.");
      return;
    }

    setIsSaving(true);

    try {
      // 1. Upload Logo if a local File was selected
      let finalLogoUrl = logoPreviewUrl;
      if (logoFile) {
        try {
          finalLogoUrl = await uploadImageToImageKit(logoFile, "/entities/logos");
        } catch (uploadErr) {
          console.error("Logo upload failed, proceeding:", uploadErr);
        }
      }

      // 2. Upload Signature if a local File was selected
      let finalSignatureUrl = signaturePreviewUrl;
      if (signatureFile) {
        try {
          finalSignatureUrl = await uploadImageToImageKit(signatureFile, "/entities/signatures");
        } catch (uploadErr) {
          console.error("Signature upload failed, proceeding:", uploadErr);
        }
      }

      const entityPayload = {
        entityCode: trimmedCode,
        legalName: trimmedLegal,
        tradeName: tradeName.trim(),
        pan: pan.trim().toUpperCase(),
        cin: cin.trim().toUpperCase(),
        cgstRate: cgstRate || "2.50",
        sgstRate: sgstRate || "2.50",
        igstRate: igstRate || "5.00",
        emailForPrint: emailForPrint.trim(),
        phoneForPrint: phoneForPrint.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        pin: pin.trim(),
        supplierState: supplierState,

        bankAccounts: bankAccounts,
        numberingSeries: numberingSeries,
        fuelRates: fuelRates,

        logoUrl: finalLogoUrl,
        signatureUrl: finalSignatureUrl,

        isActive: isActiveEntity,

        // Compatibility aliases for legacy lookups
        entityName: trimmedLegal,
        travelName: trimmedLegal,
        mobileNumber: phoneForPrint.trim(),
      };

      if (viewMode === "edit" && editingEntityId) {
        await updateDoc(doc(db, "entities", editingEntityId), {
          ...entityPayload,
          updatedAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Entity "${trimmedLegal}" has been updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "entities"), {
          ...entityPayload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Entity "${trimmedLegal}" has been created successfully!`,
        });
      }

      setViewMode("list");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error saving entity:", err);
      setFeedback({
        type: "error",
        message: "Failed to save entity to Firestore. Please check your network connection.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // TAB ORDER DEFINITION
  const TABS: { id: EntityTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "Profile", label: "Profile", icon: Building },
    { id: "Bank Accounts", label: "Bank Accounts", icon: Landmark },
    { id: "Numbering & Series", label: "Numbering & Series", icon: FileText },
    { id: "Fuel Rates", label: "Fuel Rates", icon: Fuel },
    { id: "Branding", label: "Branding", icon: ImageIcon },
    { id: "Status", label: "Status", icon: CheckCircle },
  ];

  return (
    <div className="w-full space-y-3 font-normal">
      {/* Top Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">OPERATIONS</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Entities</span>
        {viewMode !== "list" && (
          <>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 font-medium">
              {viewMode === "create" ? "Add Entity" : "Edit Entity"}
            </span>
          </>
        )}
      </nav>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs font-normal border ${
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

      {/* ========================================================================= */}
      {/* 1. LIST VIEW: Entities Registry Table & Header Bar                        */}
      {/* ========================================================================= */}
      {viewMode === "list" && (
        <div className="space-y-3">
          {/* Header Bar */}
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
                  Manage operating entities, legal profiles, bank accounts, invoicing series & branding
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Search box */}
              <div className="relative sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code, entity, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                />
              </div>

              {/* Add Entity Button */}
              <button
                type="button"
                onClick={handleOpenCreate}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Add Entity</span>
              </button>
            </div>
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
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
                <span className="text-xs font-normal">Loading entities from Firestore...</span>
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
                  <Route className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-medium text-slate-800">
                  {searchQuery ? "No matching entities found" : "No entities added yet"}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
                  {searchQuery
                    ? "Try searching with a different entity name, code, or phone number."
                    : "Click '+ Add Entity' to create your first entity with profile, banks, series & fuel rates."}
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mt-3 inline-flex items-center gap-1.5 h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Entity</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center font-medium">#</th>
                      <th className="py-2.5 px-3 font-medium">Code</th>
                      <th className="py-2.5 px-3 font-medium">Entity & Legal Name</th>
                      <th className="py-2.5 px-3 font-medium">Phone & Email</th>
                      <th className="py-2.5 px-3 font-medium">State / Hub</th>
                      <th className="py-2.5 px-3 text-center font-medium">Bank / Series</th>
                      <th className="py-2.5 px-3 text-center font-medium">Status</th>
                      <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEntities.map((entity, index) => {
                      const absoluteIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                      const hasLogo = !!entity.logoUrl;

                      return (
                        <tr
                          key={entity.id}
                          className="hover:bg-orange-50/25 transition-colors group"
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                            {absoluteIndex}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] font-medium text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-[4px] border border-slate-200">
                              {entity.entityCode || "—"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {hasLogo ? (
                                <img
                                  src={entity.logoUrl}
                                  alt="Logo"
                                  className="w-6 h-6 rounded-[4px] object-contain border border-slate-200 bg-white shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-[4px] bg-[#f16623]/10 text-[#f16623] flex items-center justify-center font-medium text-[10px] shrink-0">
                                  {entity.legalName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-900 text-xs">
                                  {entity.legalName}
                                </div>
                                {entity.tradeName && (
                                  <div className="text-[10px] text-slate-400">
                                    Trade: {entity.tradeName}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              {entity.phoneForPrint || entity.mobileNumber ? (
                                <div className="font-mono text-[11px] text-slate-700">
                                  {entity.phoneForPrint || entity.mobileNumber}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                              {entity.emailForPrint && (
                                <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                  {entity.emailForPrint}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="text-xs text-slate-700">
                              {entity.city || "—"}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {entity.supplierState || "—"}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5 text-[10px]">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {entity.bankAccounts?.length || 0} Banks
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {entity.numberingSeries?.length || 0} Series
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                                entity.isActive !== false
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {entity.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setViewingEntity(entity)}
                                className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 text-[11px] inline-flex items-center gap-1 font-normal transition cursor-pointer"
                                title="View full entity details"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>View</span>
                              </button>

                              {(entity.phoneForPrint || entity.mobileNumber) && (
                                <a
                                  href={`tel:${entity.phoneForPrint || entity.mobileNumber}`}
                                  className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 text-[11px] inline-flex items-center gap-1 font-normal transition"
                                  title="Call entity"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span className="hidden sm:inline">Call</span>
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(entity)}
                                className="h-[28px] max-h-[34px] px-2 rounded-[6px] bg-slate-50 hover:bg-orange-50 text-slate-600 hover:text-[#f16623] border border-slate-200 hover:border-orange-200 text-[11px] inline-flex items-center gap-1 font-normal transition cursor-pointer"
                                title="Edit entity details"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

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

            {/* Pagination Controls */}
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

          {/* View Entity Details OffCanvas */}
          <OffCanvas
            isOpen={!!viewingEntity}
            onClose={() => setViewingEntity(null)}
            title={viewingEntity?.legalName || "Entity Details"}
            subtitle="Complete Entity Profile, Bank Accounts, Series, Fuel Rates & Branding"
            size="xl"
          >
            {viewingEntity && (
              <div className="space-y-4 text-xs font-normal">
                {/* Header Summary Card */}
                <div className="p-3.5 bg-slate-50 rounded-[6px] border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {viewingEntity.logoUrl ? (
                      <img
                        src={viewingEntity.logoUrl}
                        alt="Logo"
                        className="w-12 h-12 rounded-[6px] object-contain border border-slate-200 bg-white p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-[6px] bg-orange-50 border border-[#f16623]/25 text-[#f16623] flex items-center justify-center font-medium text-base shrink-0">
                        {viewingEntity.legalName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-slate-900 leading-tight">
                          {viewingEntity.legalName}
                        </h3>
                        <span className="font-mono text-[10px] font-medium text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {viewingEntity.entityCode}
                        </span>
                      </div>
                      {viewingEntity.tradeName && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Trade Name: {viewingEntity.tradeName}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hub: {viewingEntity.city}, {viewingEntity.supplierState}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                        viewingEntity.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {viewingEntity.isActive !== false ? "Active" : "Inactive"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const toEdit = viewingEntity;
                        setViewingEntity(null);
                        handleOpenEdit(toEdit);
                      }}
                      className="h-[30px] max-h-[34px] px-2.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Entity</span>
                    </button>
                  </div>
                </div>

                {/* 1. Identity & Tax Specifications */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-slate-900 font-medium text-xs uppercase tracking-wider">
                    <Building className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Identity & Tax Specifications</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">PAN</span>
                      <span className="font-mono text-slate-800 font-medium">{viewingEntity.pan || "—"}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">CIN</span>
                      <span className="font-mono text-slate-800">{viewingEntity.cin || "—"}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">CGST / SGST / IGST</span>
                      <span className="text-slate-800 font-medium">
                        {viewingEntity.cgstRate}% / {viewingEntity.sgstRate}% / {viewingEntity.igstRate}%
                      </span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">Print Email</span>
                      <span className="text-slate-800 truncate block">{viewingEntity.emailForPrint || "—"}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">Print Phone</span>
                      <span className="font-mono text-slate-800">{viewingEntity.phoneForPrint || viewingEntity.mobileNumber || "—"}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-[4px] border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase block">State Hub</span>
                      <span className="text-slate-700 truncate block">{viewingEntity.supplierState}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Supplier Address */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-slate-900 font-medium text-xs uppercase tracking-wider">
                    <MapPin className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Supplier Address</span>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed">
                    {viewingEntity.addressLine1}
                    {viewingEntity.addressLine2 ? `, ${viewingEntity.addressLine2}` : ""}
                    <br />
                    {viewingEntity.city}, PIN: {viewingEntity.pin}
                    <br />
                    <span className="text-slate-500 font-medium">State: {viewingEntity.supplierState}</span>
                  </p>
                </div>

                {/* 3. Bank Accounts */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-900 font-medium text-xs uppercase tracking-wider">
                      <Landmark className="w-3.5 h-3.5 text-[#f16623]" />
                      <span>Bank Accounts ({viewingEntity.bankAccounts?.length || 0})</span>
                    </div>
                  </div>

                  {(!viewingEntity.bankAccounts || viewingEntity.bankAccounts.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">No bank accounts registered for this entity.</p>
                  ) : (
                    <div className="space-y-2">
                      {viewingEntity.bankAccounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="p-2.5 rounded-[6px] border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 text-xs">{acc.bankName}</span>
                              {acc.isDefault && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-800">
                                  Default Account
                                </span>
                              )}
                              <span className="text-[10px] text-slate-500">({acc.accountType})</span>
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              A/C: <span className="font-mono font-medium text-slate-900">{acc.accountNumber}</span> | IFSC: <span className="font-mono text-slate-800">{acc.ifscCode}</span>
                            </div>
                            {acc.branchName && (
                              <div className="text-[10px] text-slate-400">Branch: {acc.branchName}</div>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 shrink-0">
                            Eff: {acc.effectiveFrom}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Numbering Series */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-slate-900 font-medium text-xs uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Numbering Series ({viewingEntity.numberingSeries?.length || 0})</span>
                  </div>

                  {(!viewingEntity.numberingSeries || viewingEntity.numberingSeries.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">No numbering series configured.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {viewingEntity.numberingSeries.map((s) => (
                        <div key={s.id} className="p-2.5 rounded-[6px] border border-slate-200 bg-slate-50/50 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-900">{s.documentType}</span>
                            <span className="font-mono text-[10px] text-slate-500">{s.financialYear}</span>
                          </div>
                          <div className="text-[11px] text-slate-600">
                            Preview: <span className="font-mono font-medium text-[#f16623]">{s.preview}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Prefix: {s.prefix}</span>
                            <span>Next: {s.nextNumber} (Pad: {s.zeroPadWidth})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Fuel Rates */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-slate-900 font-medium text-xs uppercase tracking-wider">
                    <Fuel className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Fuel Rates ({viewingEntity.fuelRates?.length || 0})</span>
                  </div>

                  {(!viewingEntity.fuelRates || viewingEntity.fuelRates.length === 0) ? (
                    <p className="text-[11px] text-slate-400 italic">No fuel rates registered.</p>
                  ) : (
                    <div className="space-y-2">
                      {viewingEntity.fuelRates.map((f) => (
                        <div key={f.id} className="p-2.5 rounded-[6px] border border-slate-200 bg-slate-50/50 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 font-medium">
                              {f.effectiveFrom} to {f.effectiveTo || "Present"}
                            </span>
                            {f.isCurrentActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-800">
                                Active Version
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-[11px] text-center">
                            <div className="p-1 rounded bg-white border border-slate-100">
                              <span className="text-[9px] text-slate-400 block">Petrol</span>
                              <span className="font-medium text-slate-900">₹{f.petrolPrice}</span>
                            </div>
                            <div className="p-1 rounded bg-white border border-slate-100">
                              <span className="text-[9px] text-slate-400 block">Diesel</span>
                              <span className="font-medium text-slate-900">₹{f.dieselPrice}</span>
                            </div>
                            <div className="p-1 rounded bg-white border border-slate-100">
                              <span className="text-[9px] text-slate-400 block">CNG</span>
                              <span className="text-slate-800">{f.cngPrice ? `₹${f.cngPrice}` : "—"}</span>
                            </div>
                            <div className="p-1 rounded bg-white border border-slate-100">
                              <span className="text-[9px] text-slate-400 block">EV</span>
                              <span className="text-slate-800">₹{f.evRate}</span>
                            </div>
                          </div>
                          {f.revisionNotes && (
                            <p className="text-[10px] text-slate-400 italic">{f.revisionNotes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 6. Branding & Signatures */}
                <div className="bg-white rounded-[6px] border border-slate-200/80 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100 text-slate-900 font-medium text-xs uppercase tracking-wider">
                    <ImageIcon className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Branding & Signatures</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-[6px] border border-slate-200 bg-slate-50/50 text-center">
                      <span className="text-[10px] uppercase font-medium text-slate-500 block mb-2">Company Logo</span>
                      {viewingEntity.logoUrl ? (
                        <img
                          src={viewingEntity.logoUrl}
                          alt="Company Logo"
                          className="max-h-24 max-w-full mx-auto object-contain bg-white p-2 rounded border border-slate-200"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-400 italic py-4">No logo uploaded</p>
                      )}
                    </div>

                    <div className="p-3 rounded-[6px] border border-slate-200 bg-slate-50/50 text-center">
                      <span className="text-[10px] uppercase font-medium text-slate-500 block mb-2">Authorised Signature</span>
                      {viewingEntity.signatureUrl ? (
                        <img
                          src={viewingEntity.signatureUrl}
                          alt="Authorised Signature"
                          className="max-h-24 max-w-full mx-auto object-contain bg-white p-2 rounded border border-slate-200"
                        />
                      ) : (
                        <p className="text-[11px] text-slate-400 italic py-4">No signature uploaded</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Drawer Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewingEntity(null)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const toEdit = viewingEntity;
                      setViewingEntity(null);
                      handleOpenEdit(toEdit);
                    }}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#f16623]/25"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit This Entity</span>
                  </button>
                </div>
              </div>
            )}
          </OffCanvas>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CREATE / EDIT VIEW: Tab-based Entity Configuration                     */}
      {/* ========================================================================= */}
      {viewMode !== "list" && (
        <div className="space-y-3 pb-8">
          {/* Header matching user screenshots: Back button, NEW ENTITY, Add Entity */}
          <div className="flex items-center justify-between bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] border border-slate-200 hover:border-[#f16623] hover:text-[#f16623] bg-slate-50 flex items-center justify-center transition cursor-pointer text-slate-600"
                title="Back to entities list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <span className="text-[10px] font-medium tracking-wider text-[#f16623] uppercase">
                  {viewMode === "create" ? "NEW ENTITY" : "EDIT ENTITY"}
                </span>
                <h1 className="text-base font-medium text-slate-900 leading-tight">
                  {viewMode === "create" ? "Add Entity" : `Edit Entity: ${legalName || entityCode}`}
                </h1>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEntityFinal}
                disabled={isSaving}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Save Details</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Stepper / Tab Bar matching User's Screenshots */}
          <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-1.5 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {TABS.map((tab, idx) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`h-[34px] max-h-[34px] px-3 rounded-[6px] text-xs font-medium flex items-center gap-2 transition cursor-pointer ${
                      isActive
                        ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.id === "Bank Accounts" && bankAccounts.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {bankAccounts.length}
                      </span>
                    )}
                    {tab.id === "Numbering & Series" && numberingSeries.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {numberingSeries.length}
                      </span>
                    )}
                    {tab.id === "Fuel Rates" && fuelRates.length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                          isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {fuelRates.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* TAB 1: Profile (Identity & Supplier Address - Matching Image 1)       */}
          {/* ===================================================================== */}
          {activeTab === "Profile" && (
            <div className="space-y-3">
              {/* Section 1: Identity */}
              <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <Building className="w-3 h-3" />
                  </div>
                  <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                    Identity
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Entity Code */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      ENTITY CODE <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AAARUNK"
                      value={entityCode}
                      onChange={(e) => setEntityCode(e.target.value.toUpperCase())}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* Legal Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      LEGAL NAME <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. RK Travels Private Limited"
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* Trade Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      TRADE NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RK Luxury Cabs"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* PAN */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      PAN
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KIUHJ7878R"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono font-normal transition"
                    />
                  </div>

                  {/* CIN */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      CIN
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. U63040TG2020PTC123456"
                      value={cin}
                      onChange={(e) => setCin(e.target.value.toUpperCase())}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* CGST Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      CGST RATE (%) <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="2.50"
                      value={cgstRate}
                      onChange={(e) => setCgstRate(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* SGST Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      SGST RATE (%) <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="2.50"
                      value={sgstRate}
                      onChange={(e) => setSgstRate(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* IGST Rate */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      IGST RATE (%) <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="5.00"
                      value={igstRate}
                      onChange={(e) => setIgstRate(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Email (for print) */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      EMAIL (FOR PRINT)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. accounts@rktravels.com"
                      value={emailForPrint}
                      onChange={(e) => setEmailForPrint(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* Phone (for print) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      PHONE (FOR PRINT)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9874589654"
                      value={phoneForPrint}
                      onChange={(e) => setPhoneForPrint(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Supplier Address */}
              <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-3.5">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <MapPin className="w-3 h-3" />
                  </div>
                  <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                    Supplier Address
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Address Line 1 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      ADDRESS LINE 1 <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Building, street, or plot number"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* Address Line 2 */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      ADDRESS LINE 2
                    </label>
                    <input
                      type="text"
                      placeholder="Landmark, area, or road"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* City */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      CITY <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hyderabad / Vijayawada"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* PIN */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      PIN <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 500081"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                    />
                  </div>

                  {/* Supplier State Dropdown */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                      SUPPLIER STATE <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={INDIAN_STATES.map((st) => ({
                        value: `${st.code} — ${st.name}`,
                        label: `${st.code} — ${st.name}`,
                      }))}
                      value={supplierState}
                      onChange={setSupplierState}
                      placeholder="Select State..."
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Bank Accounts")}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Bank Accounts</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 2: Bank Accounts (Multiple Accounts, Default Switch - Image 2)   */}
          {/* ===================================================================== */}
          {activeTab === "Bank Accounts" && (
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-3.5">
              {/* Info Notification Card matching Image 2 */}
              <div className="flex items-start gap-2.5 p-3 rounded-[6px] bg-orange-50/70 border border-[#f16623]/25 text-xs text-slate-700">
                <AlertCircle className="w-4 h-4 text-[#f16623] shrink-0 mt-0.5" />
                <span>
                  The <strong>default bank account</strong> prints automatically on GST tax invoices, billing vouchers, and client trip settlement manifests. You can add multiple banking profiles and toggle the default account at any time.
                </span>
              </div>

              {/* Header with "+ Add Bank Account" Button matching Image 2 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <Landmark className="w-3 h-3" />
                  </div>
                  <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                    Bank Accounts ({bankAccounts.length})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddBank}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] bg-white border border-slate-300 hover:border-[#f16623] hover:text-[#f16623] text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Bank Account</span>
                </button>
              </div>

              {/* Table of Bank Accounts */}
              {bankAccounts.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">No bank accounts added yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;+ Add Bank Account&quot; to configure your primary and secondary payout accounts.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Bank Name</th>
                        <th className="py-2.5 px-3 font-medium">Account Holder</th>
                        <th className="py-2.5 px-3 font-medium">Account Number</th>
                        <th className="py-2.5 px-3 font-medium">IFSC Code</th>
                        <th className="py-2.5 px-3 font-medium">Type / Branch</th>
                        <th className="py-2.5 px-3 text-center font-medium">Status / Default</th>
                        <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bankAccounts.map((acc) => (
                        <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {acc.bankName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {acc.accountHolderName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">
                            {acc.accountNumber}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {acc.ifscCode}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-slate-800 font-medium">{acc.accountType}</span>
                            {acc.branchName && (
                              <span className="text-[10px] text-slate-400 block">
                                {acc.branchName}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {acc.isDefault ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                <span>Default (Prints on Invoices)</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultBank(acc.id)}
                                className="px-2 py-0.5 rounded-[4px] text-[10px] font-normal text-slate-600 bg-slate-100 hover:bg-orange-50 hover:text-[#f16623] hover:border-orange-200 border border-slate-200 transition cursor-pointer"
                              >
                                Set as Default
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteBank(acc.id)}
                              className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                              title="Delete bank account"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Profile")}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back: Profile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Numbering & Series")}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Numbering & Series</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 3: Numbering & Series (Invoice Setting & Numbering - Image 3)      */}
          {/* ===================================================================== */}
          {activeTab === "Numbering & Series" && (
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-3.5">
              {/* Info Card matching Image 3 */}
              <div className="flex items-start gap-2.5 p-3 rounded-[6px] bg-orange-50/70 border border-[#f16623]/25 text-xs text-slate-700">
                <AlertCircle className="w-4 h-4 text-[#f16623] shrink-0 mt-0.5" />
                <span>
                  Invoice bill numbers use <strong>entity code + FY</strong> (e.g. <code>RK-HYD &rarr; RK2026270001</code>, <code>PRASAD-KAKINADA &rarr; PRA2026270001</code>). Sequence counter automatically increments and can reset every financial year.
                </span>
              </div>

              {/* Header with "+ Add Series" Button matching Image 3 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <FileText className="w-3 h-3" />
                  </div>
                  <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                    Numbering Series ({numberingSeries.length})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddSeries}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] bg-white border border-slate-300 hover:border-[#f16623] hover:text-[#f16623] text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Series</span>
                </button>
              </div>

              {/* Series Table */}
              {numberingSeries.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">No numbering series configured yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;+ Add Series&quot; to configure FY prefix, zero-pad width, and sequential invoice counter.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Doc Type</th>
                        <th className="py-2.5 px-3 font-medium">Financial Year</th>
                        <th className="py-2.5 px-3 font-medium">Prefix</th>
                        <th className="py-2.5 px-3 font-medium">Next Number</th>
                        <th className="py-2.5 px-3 font-medium">Pad</th>
                        <th className="py-2.5 px-3 font-medium">Sample Preview</th>
                        <th className="py-2.5 px-3 text-center font-medium">Reset Rule</th>
                        <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {numberingSeries.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            {s.documentType}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                            {s.financialYear}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-800">
                            {s.prefix}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#f16623] font-medium">
                            {s.nextNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {s.zeroPadWidth} digits
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] font-medium text-slate-900 bg-orange-50/80 px-2 py-0.5 rounded-[4px] border border-orange-200">
                              {s.preview}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
                              {s.resetRule}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteSeries(s.id)}
                              className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                              title="Delete series"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Bank Accounts")}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back: Bank Accounts</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Fuel Rates")}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Fuel Rates</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 4: Fuel Rates (Fuel Surcharges & Rates Versions - Image 4)        */}
          {/* ===================================================================== */}
          {activeTab === "Fuel Rates" && (
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-3.5">
              {/* Header with "+ Add Fuel Rates" Button matching Image 4 */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <Fuel className="w-3 h-3" />
                  </div>
                  <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                    Fuel Rates & Surcharges ({fuelRates.length})
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddFuel}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] bg-white border border-slate-300 hover:border-[#f16623] hover:text-[#f16623] text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Fuel Rates</span>
                </button>
              </div>

              {fuelRates.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <Fuel className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-600 font-medium">No fuel rate versions configured yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click &quot;+ Add Fuel Rates&quot; to specify Petrol, Diesel, CNG, EV rates and effective validity dates.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Effective Range</th>
                        <th className="py-2.5 px-3 font-medium">Petrol (₹/L)</th>
                        <th className="py-2.5 px-3 font-medium">Diesel (₹/L)</th>
                        <th className="py-2.5 px-3 font-medium">CNG (₹/KG)</th>
                        <th className="py-2.5 px-3 font-medium">EV (₹/KWH)</th>
                        <th className="py-2.5 px-3 font-medium">Hybrid (₹/L)</th>
                        <th className="py-2.5 px-3 text-center font-medium">Status</th>
                        <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fuelRates.map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[11px] text-slate-800">
                              {f.effectiveFrom}
                            </span>
                            <span className="text-slate-400 text-[10px] block">
                              to {f.effectiveTo || "Present (Current)"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            ₹{f.petrolPrice}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900">
                            ₹{f.dieselPrice}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {f.cngPrice ? `₹${f.cngPrice}` : "—"}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            ₹{f.evRate}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {f.hybridRate ? `₹${f.hybridRate}` : `₹${f.petrolPrice}`}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {f.isCurrentActive ? (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Current Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-[4px] text-[10px] text-slate-400 bg-slate-100">
                                Historical
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteFuel(f.id)}
                              className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                              title="Delete fuel rate"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Numbering & Series")}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back: Numbering & Series</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Branding")}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Branding</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 5: Branding (Company Logo & Authorised Signature - ImageKit Upload) */}
          {/* ===================================================================== */}
          {activeTab === "Branding" && (
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-4 space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-[6px] bg-orange-50/70 border border-[#f16623]/25 text-xs text-slate-700">
                <Sparkles className="w-4 h-4 text-[#f16623] shrink-0 mt-0.5" />
                <span>
                  Select your <strong>Company Logo</strong> and <strong>Authorised Signature</strong>. All images are securely processed and uploaded directly to ImageKit when you click <strong>&quot;Save Details&quot;</strong>, with high-resolution CDN URLs stored on the entity.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Company Logo */}
                <div className="border border-slate-200 rounded-[6px] p-4 space-y-3 bg-slate-50/30">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#f16623]" />
                      <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                        Company Logo
                      </h3>
                    </div>
                    {logoPreviewUrl && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 font-medium">
                        Image Attached
                      </span>
                    )}
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />

                  {logoPreviewUrl ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-40 bg-white border border-slate-200 rounded-[6px] flex items-center justify-center p-3 overflow-hidden shadow-2xs">
                        <img
                          src={logoPreviewUrl}
                          alt="Logo Preview"
                          className="max-h-full max-w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreviewUrl("");
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Remove logo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{logoFile ? logoFile.name : "Saved logo on file"}</span>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="text-[#f16623] hover:underline font-medium cursor-pointer"
                        >
                          Change Logo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-slate-200 hover:border-[#f16623] rounded-[6px] flex flex-col items-center justify-center p-4 bg-white hover:bg-orange-50/20 transition cursor-pointer text-center group"
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-50 group-hover:bg-orange-100 text-[#f16623] flex items-center justify-center mb-2 transition">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-medium text-slate-800">
                        Click to upload Company Logo
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                        PNG, JPG, or SVG. Min 300x100px recommended for crisp print on invoices.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Authorised Signature */}
                <div className="border border-slate-200 rounded-[6px] p-4 space-y-3 bg-slate-50/30">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#f16623]" />
                      <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                        Authorised Signature
                      </h3>
                    </div>
                    {signaturePreviewUrl && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200 font-medium">
                        Signature Attached
                      </span>
                    )}
                  </div>

                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSignatureFileChange}
                    className="hidden"
                  />

                  {signaturePreviewUrl ? (
                    <div className="space-y-3">
                      <div className="relative w-full h-40 bg-white border border-slate-200 rounded-[6px] flex items-center justify-center p-3 overflow-hidden shadow-2xs">
                        <img
                          src={signaturePreviewUrl}
                          alt="Signature Preview"
                          className="max-h-full max-w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSignatureFile(null);
                            setSignaturePreviewUrl("");
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                          title="Remove signature"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{signatureFile ? signatureFile.name : "Saved signature on file"}</span>
                        <button
                          type="button"
                          onClick={() => signatureInputRef.current?.click()}
                          className="text-[#f16623] hover:underline font-medium cursor-pointer"
                        >
                          Change Signature
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => signatureInputRef.current?.click()}
                      className="w-full h-40 border-2 border-dashed border-slate-200 hover:border-[#f16623] rounded-[6px] flex flex-col items-center justify-center p-4 bg-white hover:bg-orange-50/20 transition cursor-pointer text-center group"
                    >
                      <div className="w-10 h-10 rounded-full bg-orange-50 group-hover:bg-orange-100 text-[#f16623] flex items-center justify-center mb-2 transition">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-medium text-slate-800">
                        Click to upload Authorised Signature
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                        Transparent PNG recommended. Automatically prints at bottom of tax invoices & duty slips.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Nav */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Fuel Rates")}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back: Fuel Rates</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("Status")}
                  className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Next: Status</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* TAB 6: Status & Final Save (Active / Inactive Toggle Switch)           */}
          {/* ===================================================================== */}
          {activeTab === "Status" && (
            <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs p-5 space-y-5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                  <CheckCircle className="w-3 h-3" />
                </div>
                <h2 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                  Entity Operating Status
                </h2>
              </div>

              {/* Active / Inactive Toggle Switch Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[6px] bg-slate-50/70 border border-slate-200">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-slate-900">
                      Entity Operational State
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                        isActiveEntity
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {isActiveEntity ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md">
                    {isActiveEntity
                      ? "This entity is fully active and operational. It can be selected for corporate billing, tax invoices, employee assignments, and dispatch schedules."
                      : "This entity is currently deactivated. It will be hidden from new bookings, assignment dropdowns, and tariff allocations."}
                  </p>
                </div>

                {/* Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsActiveEntity((prev) => !prev)}
                  className={`w-14 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                    isActiveEntity ? "bg-[#f16623]" : "bg-slate-300"
                  }`}
                  role="switch"
                  aria-checked={isActiveEntity}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                      isActiveEntity ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Configuration Review Card */}
              <div className="p-4 rounded-[6px] border border-slate-200 space-y-3 bg-white">
                <h3 className="text-xs font-medium text-slate-900 uppercase tracking-wider">
                  Configuration Summary
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Entity Code</span>
                    <span className="font-mono font-medium text-slate-900">
                      {entityCode || "Not Set"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Legal Name</span>
                    <span className="font-medium text-slate-900 truncate block">
                      {legalName || "Not Set"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">State Hub</span>
                    <span className="font-medium text-slate-900 truncate block">
                      {supplierState || "Not Set"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Bank Accounts</span>
                    <span className="font-medium text-slate-900">
                      {bankAccounts.length} Account{bankAccounts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Numbering Series</span>
                    <span className="font-medium text-slate-900">
                      {numberingSeries.length} Configured
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Fuel Rates</span>
                    <span className="font-medium text-slate-900">
                      {fuelRates.length} Rate Version{fuelRates.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Company Logo</span>
                    <span className="font-medium text-slate-900">
                      {logoPreviewUrl ? "Attached" : "Not Provided"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 block uppercase">Signature</span>
                    <span className="font-medium text-slate-900">
                      {signaturePreviewUrl ? "Attached" : "Not Provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Nav & Save Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("Branding")}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Back: Branding</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEntityFinal}
                  disabled={isSaving}
                  className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-2 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading to ImageKit & Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Save Entity Details</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL: Add Bank Account (Matching User's Second Image)                  */}
      {/* ========================================================================= */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-medium text-slate-900">
                Add Bank Account
              </h3>
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="w-6 h-6 rounded-[4px] hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveBankModal} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    BANK NAME <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. State Bank of India"
                    value={modalBankName}
                    onChange={(e) => setModalBankName(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    ACCOUNT HOLDER NAME <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RK Travels Pvt Ltd"
                    value={modalAccountHolder}
                    onChange={(e) => setModalAccountHolder(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    ACCOUNT NUMBER <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10987654321"
                    value={modalAccountNumber}
                    onChange={(e) => setModalAccountNumber(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    IFSC CODE <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SBIN0001234"
                    value={modalIfscCode}
                    onChange={(e) => setModalIfscCode(e.target.value.toUpperCase())}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    BRANCH NAME
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Madhapur Branch"
                    value={modalBranchName}
                    onChange={(e) => setModalBranchName(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    ACCOUNT TYPE
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "Current", label: "Current" },
                      { value: "Savings", label: "Savings" },
                      { value: "Overdraft", label: "Overdraft" },
                      { value: "Cash Credit", label: "Cash Credit" },
                    ]}
                    value={modalAccountType}
                    onChange={(val) =>
                      setModalAccountType(
                        val as "Current" | "Savings" | "Overdraft" | "Cash Credit"
                      )
                    }
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    EFFECTIVE FROM <span className="text-[#f16623]">*</span>
                  </label>
                  <CustomDatePicker
                    value={modalEffectiveFrom}
                    onChange={setModalEffectiveFrom}
                    placeholder="Select effective date..."
                  />
                </div>
              </div>

              {/* Set as Default Checkbox matching Image 2 */}
              <div className="p-2.5 rounded-[6px] bg-orange-50/60 border border-orange-200/60 flex items-center gap-2">
                <input
                  id="modalIsDefault"
                  type="checkbox"
                  checked={modalIsDefault}
                  onChange={(e) => setModalIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] accent-[#f16623] focus:ring-0 cursor-pointer"
                />
                <label
                  htmlFor="modalIsDefault"
                  className="text-xs text-slate-800 font-medium cursor-pointer"
                >
                  Set as default account (prints on invoices)
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBankModal(false)}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-[32px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition cursor-pointer shadow-xs shadow-[#f16623]/25"
                >
                  Save Bank Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: Add Numbering Series (Matching User's Third Image)               */}
      {/* ========================================================================= */}
      {showSeriesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-medium text-slate-900">
                Add Numbering Series
              </h3>
              <button
                type="button"
                onClick={() => setShowSeriesModal(false)}
                className="w-6 h-6 rounded-[4px] hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSeriesModal} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    DOCUMENT TYPE <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Invoice / Bill / Receipt"
                    value={modalDocType}
                    onChange={(e) => setModalDocType(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    FINANCIAL YEAR <span className="text-[#f16623]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-27"
                    value={modalFinancialYear}
                    onChange={(e) => setModalFinancialYear(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    PREFIX
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AAA202627"
                    value={modalPrefix}
                    onChange={(e) => setModalPrefix(e.target.value.toUpperCase())}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    SUFFIX
                  </label>
                  <input
                    type="text"
                    placeholder="Auto from entity code"
                    value={modalSuffix}
                    onChange={(e) => setModalSuffix(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>
              </div>

              {/* Explanatory text from Image 3 */}
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Invoice bill numbers use entity code + FY: e.g. <span className="text-[#f16623]">RK-HYD &rarr; RK2026270001</span>, <span className="text-[#f16623]">PRASAD-KAKINADA &rarr; PRA2026270001</span>. Sequence resets when you add a new FY series.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    ZERO-PAD WIDTH
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={modalZeroPadWidth}
                    onChange={(e) => setModalZeroPadWidth(Number(e.target.value))}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    NEXT NUMBER
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={modalNextNumber}
                    onChange={(e) => setModalNextNumber(Number(e.target.value))}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    RESET RULE
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "Yearly", label: "Yearly" },
                      { value: "Monthly", label: "Monthly" },
                      { value: "Never", label: "Never" },
                    ]}
                    value={modalResetRule}
                    onChange={(val) =>
                      setModalResetRule(val as "Yearly" | "Monthly" | "Never")
                    }
                  />
                </div>
              </div>

              {/* Dynamic Live Preview Box matching Image 3 */}
              <div className="p-3 rounded-[6px] bg-orange-50/60 border border-orange-200/60">
                <span className="text-xs text-slate-600 font-normal">
                  Preview: <strong className="font-mono text-slate-900">{computedSeriesPreview}</strong>
                </span>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSeriesModal(false)}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-[32px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition cursor-pointer shadow-xs shadow-[#f16623]/25"
                >
                  Save Series
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: Add Fuel Rates Version (Matching User's Fourth Image)           */}
      {/* ========================================================================= */}
      {showFuelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-[2px]">
          <div className="w-full max-w-xl bg-white rounded-[8px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xs font-medium text-slate-900">
                Add Fuel Rates Version
              </h3>
              <button
                type="button"
                onClick={() => setShowFuelModal(false)}
                className="w-6 h-6 rounded-[4px] hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveFuelModal} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    PETROL PRICE (₹ / LITRE) <span className="text-[#f16623]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 102.50"
                      value={modalPetrolPrice}
                      onChange={(e) => setModalPetrolPrice(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    DIESEL PRICE (₹ / LITRE) <span className="text-[#f16623]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 92.80"
                      value={modalDieselPrice}
                      onChange={(e) => setModalDieselPrice(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    CNG PRICE (₹ / KG)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 88.00"
                      value={modalCngPrice}
                      onChange={(e) => setModalCngPrice(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    EV RATE (₹ / KWH) <span className="text-[#f16623]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 8.50"
                      value={modalEvRate}
                      onChange={(e) => setModalEvRate(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    HYBRID RATE (₹ / LITRE)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Leave empty to use Petrol rate"
                      value={modalHybridRate}
                      onChange={(e) => setModalHybridRate(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] pl-6 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    EFFECTIVE FROM <span className="text-[#f16623]">*</span>
                  </label>
                  <CustomDatePicker
                    value={modalFuelEffectiveFrom}
                    onChange={setModalFuelEffectiveFrom}
                    placeholder="Select effective date..."
                  />
                  <span className="text-[9px] text-slate-400 block">
                    Date from which these fuel rates become active.
                  </span>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                    EFFECTIVE TO (OPTIONAL)
                  </label>
                  <CustomDatePicker
                    value={modalFuelEffectiveTo}
                    onChange={setModalFuelEffectiveTo}
                    placeholder="Select effective to date..."
                    minDate={modalFuelEffectiveFrom}
                  />
                  <span className="text-[9px] text-slate-400 block">
                    Leave blank if this is the current active rate.
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider">
                  REVISION NOTES / REASON
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Fuel Price Update, Q1 Revision"
                  value={modalRevisionNotes}
                  onChange={(e) => setModalRevisionNotes(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
                />
              </div>

              {/* Checkbox matching Image 4 */}
              <div className="p-2.5 rounded-[6px] bg-orange-50/60 border border-orange-200/60 flex items-center gap-2">
                <input
                  id="modalFuelIsCurrentActive"
                  type="checkbox"
                  checked={modalFuelIsCurrentActive}
                  onChange={(e) => setModalFuelIsCurrentActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] accent-[#f16623] focus:ring-0 cursor-pointer"
                />
                <label
                  htmlFor="modalFuelIsCurrentActive"
                  className="text-xs text-slate-800 font-medium cursor-pointer"
                >
                  Set as current active version (deactivates / ends prior active version)
                </label>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="h-[32px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-normal transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-[32px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition cursor-pointer shadow-xs shadow-[#f16623]/25"
                >
                  Save Fuel Rates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
