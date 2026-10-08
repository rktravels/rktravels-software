"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  Tags,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Calendar,
  User,
  Users,
  X,
  Edit2,
  Clock,
  Car,
  History,
  Plane,
  Train,
  Check,
  RotateCcw,
  Receipt,
  CheckCheck,
  FileText,
  MapPin,
  ChevronRight,
} from "lucide-react";
import {
  collection,
  serverTimestamp,
  query,
  onSnapshot,
  doc,
  setDoc,
  getDocs,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";

// --- Types & Data Models ---

// 1. Local Duty Models
export interface TariffRateRow {
  baseFare: number | string;
  nightCharge: number | string;
  driverBata: number | string;
}

export interface TariffPackageBlock {
  id: string;
  packageName: string;
  rates: Record<string, TariffRateRow>;
}

export interface ExtraRatesBlock {
  extraPerHour: Record<string, number | string>;
  extraPerKm: Record<string, number | string>;
}

export interface LocalDutyConfig {
  enabled: boolean;
  packages: TariffPackageBlock[];
  extraRates: ExtraRatesBlock;
}

// 2. Pickup & Drop Models (Airport & Railway)
export interface TransferParticulars {
  includedHours: Record<string, number | string>;
  includedKm: Record<string, number | string>;
  fare: Record<string, number | string>;
  waitingPerHour: Record<string, number | string>;
  extraPerKm: Record<string, number | string>;
}

export interface PickupDropDutyConfig {
  offerAirport: boolean;
  offerRailway: boolean;
  airportRates: TransferParticulars;
  railwayRates: TransferParticulars;
}

// 3. Day Rent Models
export interface DayRentParticulars {
  dayRent12Hrs: Record<string, number | string>;
  dayRent24Hrs: Record<string, number | string>;
  fuelMileage: Record<string, number | string>;
  driverBata12Hrs: Record<string, number | string>;
  driverBata24Hrs: Record<string, number | string>;
  nightHaltPerNight: Record<string, number | string>;
}

export interface DayRentDutyConfig {
  enabled: boolean;
  rates: DayRentParticulars;
}

// 4. Outstation Models
export interface OutstationParticulars {
  baseKmSlab: Record<string, number | string>;
  perKmCharge: Record<string, number | string>;
  driverBataPerDay: Record<string, number | string>;
  nightHaltPerNight: Record<string, number | string>;
}

export interface OutstationDutyConfig {
  enabled: boolean;
  rates: OutstationParticulars;
}

// 5. Default Customer Tariff Record
export interface CustomerTariffRecord {
  id: string;
  tariffName: string;
  customerId?: string;
  customerName: string;
  isDefault?: boolean;
  validFrom: string;
  validTo?: string | null;
  status: "Active" | "Inactive";
  selectedCategories: string[];
  localDuty: LocalDutyConfig;
  pickupDropDuty: PickupDropDutyConfig;
  dayRentDuty: DayRentDutyConfig;
  outstationDuty: OutstationDutyConfig;
  planName?: string;
  amount?: number;
  tariffCategory?: "Customer";
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export default function CustomerTariffsPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);

  // Active view tab on the main page rate matrix preview
  const [mainPreviewTab, setMainPreviewTab] = useState<
    "Local" | "Pickup & Drop" | "Day Rent" | "Outstation"
  >("Local");

  // --- Tariff Form State (for the default customer tariff) ---
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");
  const [tariffStatus, setTariffStatus] = useState<"Active" | "Inactive">("Active");

  // Selected vehicle categories (loaded dynamically from database)
  const [allAvailableCategories, setAllAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  // Active Tab in Tariff Editor OffCanvas
  const [editorActiveTab, setEditorActiveTab] = useState<
    "Local" | "Pickup & Drop" | "Day Rent" | "Outstation"
  >("Local");

  // --- 1. LOCAL DUTY STATE ---
  const [offerLocal, setOfferLocal] = useState(true);
  const [localPackages, setLocalPackages] = useState<TariffPackageBlock[]>([]);
  const [localExtraRates, setLocalExtraRates] = useState<ExtraRatesBlock>({
    extraPerHour: {},
    extraPerKm: {},
  });
  const [newPackageName, setNewPackageName] = useState("");
  const [isAddingPackage, setIsAddingPackage] = useState(false);

  // --- 2. PICKUP & DROP STATE ---
  const [offerAirport, setOfferAirport] = useState(true);
  const [offerRailway, setOfferRailway] = useState(true);
  const [airportRates, setAirportRates] = useState<TransferParticulars>({
    includedHours: {},
    includedKm: {},
    fare: {},
    waitingPerHour: {},
    extraPerKm: {},
  });
  const [railwayRates, setRailwayRates] = useState<TransferParticulars>({
    includedHours: {},
    includedKm: {},
    fare: {},
    waitingPerHour: {},
    extraPerKm: {},
  });

  // --- 3. DAY RENT STATE ---
  const [offerDayRent, setOfferDayRent] = useState(true);
  const [dayRentRates, setDayRentRates] = useState<DayRentParticulars>({
    dayRent12Hrs: {},
    dayRent24Hrs: {},
    fuelMileage: {},
    driverBata12Hrs: {},
    driverBata24Hrs: {},
    nightHaltPerNight: {},
  });

  // --- 4. OUTSTATION STATE ---
  const [offerOutstation, setOfferOutstation] = useState(true);
  const [outstationRates, setOutstationRates] = useState<OutstationParticulars>({
    baseKmSlab: {},
    perKmCharge: {},
    driverBataPerDay: {},
    nightHaltPerNight: {},
  });

  // Data & Loading state
  const [tariffsList, setTariffsList] = useState<CustomerTariffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Subscribe to Vehicle Categories across Firestore collections
  useEffect(() => {
    const unsubList: (() => void)[] = [];
    try {
      const parseDocs = (docs: any[]) => {
        const catMap = new Map<string, string>();
        docs.forEach((d) => {
          const data = d.data();
          if (data.isActive !== false) {
            const rawName = (data.printName || data.categoryName || "").trim();
            if (rawName) {
              const nameUpper = rawName.toUpperCase();
              catMap.set(nameUpper.toLowerCase(), nameUpper);
            }
          }
        });
        return Array.from(catMap.values());
      };

      const unsub1 = onSnapshot(collection(db, "vehicle_categories"), (snap) => {
        const cats = parseDocs(snap.docs);
        if (cats.length === 0) {
          getDocs(collection(db, "vehicleCategories"))
            .then((vcSnap) => {
              const fallbackCats = parseDocs(vcSnap.docs);
              if (fallbackCats.length > 0) {
                setAllAvailableCategories(fallbackCats);
                setSelectedCategories((prev) => (prev.length === 0 ? fallbackCats : prev));
              }
            })
            .catch(() => {});
        } else {
          setAllAvailableCategories(cats);
          setSelectedCategories((prev) => {
            if (prev.length === 0) return cats.slice(0, 4);
            const valid = prev.filter((c) => cats.includes(c));
            return valid.length > 0 ? valid : cats.slice(0, 4);
          });
        }
      });
      unsubList.push(unsub1);
    } catch (err) {
      console.warn("Could not load dynamic vehicle categories:", err);
    }

    return () => {
      unsubList.forEach((u) => u());
    };
  }, []);

  // 2. Real-time Subscription to Customer Tariffs collection
  useEffect(() => {
    let unsubTariffs: (() => void) | null = null;
    try {
      unsubTariffs = onSnapshot(
        collection(db, "customer_tariffs"),
        (snap) => {
          const items: CustomerTariffRecord[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              tariffName: data.tariffName || "Default Customer Tariff",
              customerId: data.customerId || "default_customer",
              customerName: data.customerName || "Default Customer Tariff",
              isDefault: data.isDefault !== false,
              validFrom: data.validFrom || new Date().toISOString().split("T")[0],
              validTo: data.validTo || null,
              status: data.status || "Active",
              selectedCategories: data.selectedCategories || [
                "SEDAN (A/C)",
                "INNOVA (A/C)",
                "CRYSTA (A/C)",
                "HYCROSS (A/C)",
              ],
              localDuty: data.localDuty || {
                enabled: true,
                packages: [],
                extraRates: { extraPerHour: {}, extraPerKm: {} },
              },
              pickupDropDuty: data.pickupDropDuty || {
                offerAirport: true,
                offerRailway: true,
                airportRates: {
                  includedHours: {},
                  includedKm: {},
                  fare: {},
                  waitingPerHour: {},
                  extraPerKm: {},
                },
                railwayRates: {
                  includedHours: {},
                  includedKm: {},
                  fare: {},
                  waitingPerHour: {},
                  extraPerKm: {},
                },
              },
              dayRentDuty: data.dayRentDuty || {
                enabled: true,
                rates: {
                  dayRent12Hrs: {},
                  dayRent24Hrs: {},
                  fuelMileage: {},
                  driverBata12Hrs: {},
                  driverBata24Hrs: {},
                  nightHaltPerNight: {},
                },
              },
              outstationDuty: data.outstationDuty || {
                enabled: true,
                rates: {
                  baseKmSlab: {},
                  perKmCharge: {},
                  driverBataPerDay: {},
                  nightHaltPerNight: {},
                },
              },
              planName: data.planName,
              amount: data.amount,
              tariffCategory: "Customer",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          });

          setTariffsList(items);
          setLoading(false);
        },
        (error) => {
          console.warn("customer_tariffs listener error:", error);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Failed to initialize customer tariffs listener:", err);
      setLoading(false);
    }

    return () => {
      if (unsubTariffs) unsubTariffs();
    };
  }, []);

  // Resolved Common Default Tariff for all customers
  const defaultTariff: CustomerTariffRecord | null = useMemo(() => {
    if (tariffsList.length === 0) return null;
    const master = tariffsList.find(
      (t) => t.id === "default_customer_tariff" || t.isDefault
    );
    if (master) return master;
    const active = tariffsList.find((t) => t.status === "Active");
    return active || tariffsList[0];
  }, [tariffsList]);

  // Categories to display for rate tables
  const activeRateCategories = useMemo(() => {
    if (defaultTariff && defaultTariff.selectedCategories?.length > 0) {
      return defaultTariff.selectedCategories;
    }
    if (selectedCategories.length > 0) return selectedCategories;
    if (allAvailableCategories.length > 0) return allAvailableCategories.slice(0, 4);
    return ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"];
  }, [defaultTariff, selectedCategories, allAvailableCategories]);

  // --- Handlers for Category Selection inside Editor ---
  const toggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length <= 1) {
        alert("You must keep at least one category column.");
        return;
      }
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategoryInput.trim().toUpperCase();
    if (!trimmed) return;
    const catName = trimmed.includes("(A/C)") || trimmed.includes("AC") ? trimmed : `${trimmed} (A/C)`;
    if (!allAvailableCategories.includes(catName)) {
      setAllAvailableCategories([...allAvailableCategories, catName]);
    }
    if (!selectedCategories.includes(catName)) {
      setSelectedCategories([...selectedCategories, catName]);
    }
    setNewCategoryInput("");
    setShowAddCategoryInput(false);
  };

  // --- Seed Standard Baseline Rates State ---
  const populateStandardBaselineRates = (cats: string[]) => {
    const categoriesToUse = cats.length > 0 ? cats : ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"];
    setSelectedCategories(categoriesToUse);
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setTariffStatus("Active");

    // Local
    setOfferLocal(true);
    setLocalPackages([
      {
        id: "pkg-4h-40k",
        packageName: "4 HOURS 40 KM",
        rates: {
          "SEDAN (A/C)": { baseFare: 1600, nightCharge: 0, driverBata: 100 },
          "INNOVA (A/C)": { baseFare: 2200, nightCharge: 0, driverBata: 100 },
          "CRYSTA (A/C)": { baseFare: 3200, nightCharge: 0, driverBata: 100 },
          "HYCROSS (A/C)": { baseFare: 3800, nightCharge: 0, driverBata: 150 },
        },
      },
      {
        id: "pkg-8h-80k",
        packageName: "8 HOURS 80 KM",
        rates: {
          "SEDAN (A/C)": { baseFare: 2600, nightCharge: 0, driverBata: 200 },
          "INNOVA (A/C)": { baseFare: 3200, nightCharge: 0, driverBata: 200 },
          "CRYSTA (A/C)": { baseFare: 4200, nightCharge: 0, driverBata: 200 },
          "HYCROSS (A/C)": { baseFare: 5000, nightCharge: 0, driverBata: 250 },
        },
      },
    ]);
    setLocalExtraRates({
      extraPerHour: {
        "SEDAN (A/C)": 150,
        "INNOVA (A/C)": 220,
        "CRYSTA (A/C)": 260,
        "HYCROSS (A/C)": 320,
      },
      extraPerKm: {
        "SEDAN (A/C)": 14,
        "INNOVA (A/C)": 19,
        "CRYSTA (A/C)": 22,
        "HYCROSS (A/C)": 26,
      },
    });

    // Pickup & Drop
    setOfferAirport(true);
    setOfferRailway(true);
    setAirportRates({
      includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
      includedKm: { "SEDAN (A/C)": 40, "INNOVA (A/C)": 40, "CRYSTA (A/C)": 40, "HYCROSS (A/C)": 40 },
      fare: { "SEDAN (A/C)": 1500, "INNOVA (A/C)": 2300, "CRYSTA (A/C)": 2900, "HYCROSS (A/C)": 3500 },
      waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
      extraPerKm: { "SEDAN (A/C)": 15, "INNOVA (A/C)": 20, "CRYSTA (A/C)": 24, "HYCROSS (A/C)": 28 },
    });
    setRailwayRates({
      includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
      includedKm: { "SEDAN (A/C)": 30, "INNOVA (A/C)": 30, "CRYSTA (A/C)": 30, "HYCROSS (A/C)": 30 },
      fare: { "SEDAN (A/C)": 1000, "INNOVA (A/C)": 1500, "CRYSTA (A/C)": 2000, "HYCROSS (A/C)": 2500 },
      waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
      extraPerKm: { "SEDAN (A/C)": 15, "INNOVA (A/C)": 20, "CRYSTA (A/C)": 24, "HYCROSS (A/C)": 28 },
    });

    // Day Rent
    setOfferDayRent(true);
    setDayRentRates({
      dayRent12Hrs: { "SEDAN (A/C)": 3000, "INNOVA (A/C)": 4000, "CRYSTA (A/C)": 5000, "HYCROSS (A/C)": 6000 },
      dayRent24Hrs: { "SEDAN (A/C)": 4500, "INNOVA (A/C)": 5800, "CRYSTA (A/C)": 7200, "HYCROSS (A/C)": 8500 },
      fuelMileage: { "SEDAN (A/C)": 14, "INNOVA (A/C)": 10, "CRYSTA (A/C)": 9, "HYCROSS (A/C)": 12 },
      driverBata12Hrs: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 400, "CRYSTA (A/C)": 450, "HYCROSS (A/C)": 500 },
      driverBata24Hrs: { "SEDAN (A/C)": 500, "INNOVA (A/C)": 600, "CRYSTA (A/C)": 700, "HYCROSS (A/C)": 800 },
      nightHaltPerNight: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
    });

    // Outstation
    setOfferOutstation(true);
    setOutstationRates({
      baseKmSlab: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 300, "CRYSTA (A/C)": 300, "HYCROSS (A/C)": 300 },
      perKmCharge: { "SEDAN (A/C)": 13, "INNOVA (A/C)": 18, "CRYSTA (A/C)": 21, "HYCROSS (A/C)": 25 },
      driverBataPerDay: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
      nightHaltPerNight: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
    });
  };

  // --- Handlers for Local Duty Packages ---
  const handleAddPackage = () => {
    const trimmed = newPackageName.trim().toUpperCase();
    if (!trimmed) return;
    const newPkg: TariffPackageBlock = {
      id: `pkg-${Date.now()}`,
      packageName: trimmed,
      rates: selectedCategories.reduce((acc, cat) => {
        acc[cat] = { baseFare: 0, nightCharge: 0, driverBata: 0 };
        return acc;
      }, {} as Record<string, TariffRateRow>),
    };
    setLocalPackages([...localPackages, newPkg]);
    setNewPackageName("");
    setIsAddingPackage(false);
  };

  const handleDeletePackage = (pkgId: string) => {
    setLocalPackages(localPackages.filter((p) => p.id !== pkgId));
  };

  const updatePackageRate = (
    pkgId: string,
    cat: string,
    field: keyof TariffRateRow,
    value: string
  ) => {
    const val = value === "" ? "" : Number(value);
    setLocalPackages((prev) =>
      prev.map((pkg) => {
        if (pkg.id !== pkgId) return pkg;
        const currentCatRate = pkg.rates[cat] || { baseFare: 0, nightCharge: 0, driverBata: 0 };
        return {
          ...pkg,
          rates: {
            ...pkg.rates,
            [cat]: {
              ...currentCatRate,
              [field]: val,
            },
          },
        };
      })
    );
  };

  const updateLocalExtraRate = (
    type: "extraPerHour" | "extraPerKm",
    cat: string,
    value: string
  ) => {
    const val = value === "" ? "" : Number(value);
    setLocalExtraRates((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || {}),
        [cat]: val,
      },
    }));
  };

  // --- Handlers for Pickup & Drop ---
  const updateAirportRate = (field: keyof TransferParticulars, cat: string, value: string) => {
    const val = value === "" ? "" : Number(value);
    setAirportRates((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [cat]: val,
      },
    }));
  };

  const updateRailwayRate = (field: keyof TransferParticulars, cat: string, value: string) => {
    const val = value === "" ? "" : Number(value);
    setRailwayRates((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [cat]: val,
      },
    }));
  };

  // --- Handlers for Day Rent ---
  const updateDayRentRate = (field: keyof DayRentParticulars, cat: string, value: string) => {
    const val = value === "" ? "" : Number(value);
    setDayRentRates((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [cat]: val,
      },
    }));
  };

  // --- Handlers for Outstation ---
  const updateOutstationRate = (field: keyof OutstationParticulars, cat: string, value: string) => {
    const val = value === "" ? "" : Number(value);
    setOutstationRates((prev) => ({
      ...prev,
      [field]: {
        ...prev[field],
        [cat]: val,
      },
    }));
  };

  // --- Open Edit Tariff Drawer ---
  const handleOpenEditTariff = (targetDutyTab?: "Local" | "Pickup & Drop" | "Day Rent" | "Outstation") => {
    if (targetDutyTab) {
      setEditorActiveTab(targetDutyTab);
    }

    if (defaultTariff) {
      setValidFrom(defaultTariff.validFrom || new Date().toISOString().split("T")[0]);
      setValidTo(defaultTariff.validTo || "");
      setTariffStatus(defaultTariff.status || "Active");
      setSelectedCategories(
        defaultTariff.selectedCategories?.length > 0
          ? defaultTariff.selectedCategories
          : allAvailableCategories.length > 0
          ? allAvailableCategories.slice(0, 4)
          : ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"]
      );

      // Local
      setOfferLocal(defaultTariff.localDuty?.enabled !== false);
      setLocalPackages(defaultTariff.localDuty?.packages || []);
      setLocalExtraRates(defaultTariff.localDuty?.extraRates || { extraPerHour: {}, extraPerKm: {} });

      // Pickup & Drop
      setOfferAirport(defaultTariff.pickupDropDuty?.offerAirport !== false);
      setOfferRailway(defaultTariff.pickupDropDuty?.offerRailway !== false);
      setAirportRates(
        defaultTariff.pickupDropDuty?.airportRates || {
          includedHours: {},
          includedKm: {},
          fare: {},
          waitingPerHour: {},
          extraPerKm: {},
        }
      );
      setRailwayRates(
        defaultTariff.pickupDropDuty?.railwayRates || {
          includedHours: {},
          includedKm: {},
          fare: {},
          waitingPerHour: {},
          extraPerKm: {},
        }
      );

      // Day Rent
      setOfferDayRent(defaultTariff.dayRentDuty?.enabled !== false);
      setDayRentRates(
        defaultTariff.dayRentDuty?.rates || {
          dayRent12Hrs: {},
          dayRent24Hrs: {},
          fuelMileage: {},
          driverBata12Hrs: {},
          driverBata24Hrs: {},
          nightHaltPerNight: {},
        }
      );

      // Outstation
      setOfferOutstation(defaultTariff.outstationDuty?.enabled !== false);
      setOutstationRates(
        defaultTariff.outstationDuty?.rates || {
          baseKmSlab: {},
          perKmCharge: {},
          driverBataPerDay: {},
          nightHaltPerNight: {},
        }
      );
    } else {
      // Pre-fill baseline standard rates
      populateStandardBaselineRates(
        allAvailableCategories.length > 0
          ? allAvailableCategories.slice(0, 4)
          : ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"]
      );
    }

    setIsOffCanvasOpen(true);
  };

  // --- 1-Click Initialize Standard Baseline Rates to Firestore ---
  const handleQuickInitializeDefault = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const cats =
        allAvailableCategories.length > 0
          ? allAvailableCategories.slice(0, 4)
          : ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"];

      const defaultPayload = {
        id: "default_customer_tariff",
        tariffName: "Default Customer Tariff",
        customerId: "default_customer",
        customerName: "Default Customer Tariff",
        isDefault: true,
        validFrom: new Date().toISOString().split("T")[0],
        validTo: null,
        status: "Active",
        selectedCategories: cats,
        localDuty: {
          enabled: true,
          packages: [
            {
              id: "pkg-4h-40k",
              packageName: "4 HOURS 40 KM",
              rates: {
                "SEDAN (A/C)": { baseFare: 1600, nightCharge: 0, driverBata: 100 },
                "INNOVA (A/C)": { baseFare: 2200, nightCharge: 0, driverBata: 100 },
                "CRYSTA (A/C)": { baseFare: 3200, nightCharge: 0, driverBata: 100 },
                "HYCROSS (A/C)": { baseFare: 3800, nightCharge: 0, driverBata: 150 },
              },
            },
            {
              id: "pkg-8h-80k",
              packageName: "8 HOURS 80 KM",
              rates: {
                "SEDAN (A/C)": { baseFare: 2600, nightCharge: 0, driverBata: 200 },
                "INNOVA (A/C)": { baseFare: 3200, nightCharge: 0, driverBata: 200 },
                "CRYSTA (A/C)": { baseFare: 4200, nightCharge: 0, driverBata: 200 },
                "HYCROSS (A/C)": { baseFare: 5000, nightCharge: 0, driverBata: 250 },
              },
            },
          ],
          extraRates: {
            extraPerHour: { "SEDAN (A/C)": 150, "INNOVA (A/C)": 220, "CRYSTA (A/C)": 260, "HYCROSS (A/C)": 320 },
            extraPerKm: { "SEDAN (A/C)": 14, "INNOVA (A/C)": 19, "CRYSTA (A/C)": 22, "HYCROSS (A/C)": 26 },
          },
        },
        pickupDropDuty: {
          offerAirport: true,
          offerRailway: true,
          airportRates: {
            includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
            includedKm: { "SEDAN (A/C)": 40, "INNOVA (A/C)": 40, "CRYSTA (A/C)": 40, "HYCROSS (A/C)": 40 },
            fare: { "SEDAN (A/C)": 1500, "INNOVA (A/C)": 2300, "CRYSTA (A/C)": 2900, "HYCROSS (A/C)": 3500 },
            waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
            extraPerKm: { "SEDAN (A/C)": 15, "INNOVA (A/C)": 20, "CRYSTA (A/C)": 24, "HYCROSS (A/C)": 28 },
          },
          railwayRates: {
            includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
            includedKm: { "SEDAN (A/C)": 30, "INNOVA (A/C)": 30, "CRYSTA (A/C)": 30, "HYCROSS (A/C)": 30 },
            fare: { "SEDAN (A/C)": 1000, "INNOVA (A/C)": 1500, "CRYSTA (A/C)": 2000, "HYCROSS (A/C)": 2500 },
            waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
            extraPerKm: { "SEDAN (A/C)": 15, "INNOVA (A/C)": 20, "CRYSTA (A/C)": 24, "HYCROSS (A/C)": 28 },
          },
        },
        dayRentDuty: {
          enabled: true,
          rates: {
            dayRent12Hrs: { "SEDAN (A/C)": 3000, "INNOVA (A/C)": 4000, "CRYSTA (A/C)": 5000, "HYCROSS (A/C)": 6000 },
            dayRent24Hrs: { "SEDAN (A/C)": 4500, "INNOVA (A/C)": 5800, "CRYSTA (A/C)": 7200, "HYCROSS (A/C)": 8500 },
            fuelMileage: { "SEDAN (A/C)": 14, "INNOVA (A/C)": 10, "CRYSTA (A/C)": 9, "HYCROSS (A/C)": 12 },
            driverBata12Hrs: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 400, "CRYSTA (A/C)": 450, "HYCROSS (A/C)": 500 },
            driverBata24Hrs: { "SEDAN (A/C)": 500, "INNOVA (A/C)": 600, "CRYSTA (A/C)": 700, "HYCROSS (A/C)": 800 },
            nightHaltPerNight: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
          },
        },
        outstationDuty: {
          enabled: true,
          rates: {
            baseKmSlab: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 300, "CRYSTA (A/C)": 300, "HYCROSS (A/C)": 300 },
            perKmCharge: { "SEDAN (A/C)": 13, "INNOVA (A/C)": 18, "CRYSTA (A/C)": 21, "HYCROSS (A/C)": 25 },
            driverBataPerDay: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
            nightHaltPerNight: { "SEDAN (A/C)": 400, "INNOVA (A/C)": 500, "CRYSTA (A/C)": 600, "HYCROSS (A/C)": 700 },
          },
        },
        planName: "Default Customer Tariff",
        amount: 1600,
        tariffCategory: "Customer",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, "customer_tariffs", "default_customer_tariff"), defaultPayload, { merge: true });
      setFeedback({
        type: "success",
        message: "Standard Default Customer Tariff initialized successfully!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error("Error initializing default customer tariff:", err);
      setFeedback({
        type: "error",
        message: `Failed to initialize default tariff: ${err.message}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Save / Update Default Customer Tariff Submission ---
  const handleSaveTariffSubmit = async (statusToSave: "Active" | "Inactive") => {
    setFeedback(null);
    if (!validFrom) {
      alert("Please select a Valid From date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const docId = defaultTariff?.id || "default_customer_tariff";
      const tariffPayload = {
        id: docId,
        tariffName: "Default Customer Tariff",
        customerId: "default_customer",
        customerName: "Default Customer Tariff",
        isDefault: true,
        validFrom: validFrom,
        validTo: validTo.trim() || null,
        status: statusToSave,
        selectedCategories: selectedCategories,
        localDuty: {
          enabled: offerLocal,
          packages: localPackages,
          extraRates: localExtraRates,
        },
        pickupDropDuty: {
          offerAirport: offerAirport,
          offerRailway: offerRailway,
          airportRates: airportRates,
          railwayRates: railwayRates,
        },
        dayRentDuty: {
          enabled: offerDayRent,
          rates: dayRentRates,
        },
        outstationDuty: {
          enabled: offerOutstation,
          rates: outstationRates,
        },
        planName: "Default Customer Tariff",
        amount: Number(localPackages[0]?.rates[selectedCategories[0]]?.baseFare) || 0,
        tariffCategory: "Customer",
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "customer_tariffs", docId), tariffPayload, { merge: true });

      setFeedback({
        type: "success",
        message: "Default Customer Tariff rates saved successfully!",
      });
      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving customer tariff:", err);
      const msg = err instanceof Error ? err.message : "Failed to save customer tariff.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered categories for category selection pill list
  const displayedCategories = allAvailableCategories.filter((cat) =>
    cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  return (
    <div className="w-full space-y-4 font-sans pb-16 max-w-[1400px] mx-auto">
      {/* Breadcrumbs Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/dashboard" className="hover:text-slate-800 transition">
          Home
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">COMMERCIAL</span>
        <span className="text-slate-300">/</span>
        <span className="text-[#f16623] font-medium">Customer Tariff</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Customer Tariff (Default Rate Card)
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Common for All Customers
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Standard retail tariff automatically applied to all individual customer bookings (Local, Airport/Railway, Day Rent &amp; Outstation)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickInitializeDefault}
            disabled={isSubmitting}
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Reset standard baseline rates for RK Travels"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Baseline Rates</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenEditTariff()}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Edit Tariff Rates</span>
          </button>
        </div>
      </div>

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

      {loading ? (
        <div className="bg-white p-12 rounded-[6px] border border-slate-200/80 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#f16623]" />
          <span className="text-xs">Loading Default Customer Tariff...</span>
        </div>
      ) : !defaultTariff ? (
        /* Uninitialized State Banner */
        <div className="bg-white p-8 rounded-[6px] border border-slate-200/80 text-center space-y-3">
          <div className="w-12 h-12 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Default Customer Tariff Not Initialized
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Initialize the standard retail tariff card for individual customers. This rate card will automatically apply across all retail bookings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleQuickInitializeDefault}
            disabled={isSubmitting}
            className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Initialize Standard Retail Rates</span>
          </button>
        </div>
      ) : (
        /* Master Overview & Live Rate Matrix */
        <div className="space-y-4">
          {/* Overview Info Card */}
          <div className="bg-white p-4 rounded-[6px] border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-[3px] bg-[#f16623]"></span>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Master Retail Tariff Card
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{defaultTariff.status}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Universal baseline rates for all retail/individual customers. No customer-specific tariff configuration is required.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-2.5 py-1 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Valid From: <strong className="font-medium text-slate-900">{defaultTariff.validFrom || "Present"}</strong>
                    {defaultTariff.validTo ? ` to ${defaultTariff.validTo}` : " (Ongoing)"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEditTariff(mainPreviewTab)}
                  className="h-[30px] max-h-[34px] px-3 rounded-[4px] bg-orange-50 hover:bg-orange-100 text-[#f16623] border border-[#f16623]/30 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Rates</span>
                </button>
              </div>
            </div>

            {/* Configured Vehicle Categories */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider shrink-0">
                ENABLED CATEGORIES:
              </span>
              {activeRateCategories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200"
                >
                  <Car className="w-3.5 h-3.5 text-[#f16623]" />
                  <span>{cat}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Interactive Live Duty Rate Matrix Tabs */}
          <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
            {/* Tab Navigation Header */}
            <div className="px-3.5 pt-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:pb-0">
                {(["Local", "Pickup & Drop", "Day Rent", "Outstation"] as const).map(
                  (tab) => {
                    const isActive = mainPreviewTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setMainPreviewTab(tab)}
                        className={`px-3 py-1.5 text-xs rounded-[4px] transition cursor-pointer select-none shrink-0 ${
                          isActive
                            ? "bg-[#f16623] text-white font-medium shadow-xs shadow-[#f16623]/25"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-normal"
                        }`}
                      >
                        {tab} Rates
                      </button>
                    );
                  }
                )}
              </div>

              <div className="flex items-center gap-2 pb-2 sm:pb-0">
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Category columns: {activeRateCategories.length}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenEditTariff(mainPreviewTab)}
                  className="h-[28px] max-h-[34px] px-2.5 rounded-[4px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-normal transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-[#f16623]" />
                  <span>Modify {mainPreviewTab}</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: 1. LOCAL DUTY */}
            {mainPreviewTab === "Local" && (
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#f16623]" />
                      <span>Local Duty Hourly &amp; KM Packages</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      Standard base fare &amp; driver bata
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Package Name</th>
                          {activeRateCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 text-right">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {(defaultTariff.localDuty?.packages || []).length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeRateCategories.length + 1}
                              className="py-4 text-center text-slate-400 text-xs"
                            >
                              No local packages configured. Click &quot;Modify Local&quot; to add packages.
                            </td>
                          </tr>
                        ) : (
                          defaultTariff.localDuty?.packages?.map((pkg) => (
                            <tr key={pkg.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-medium text-slate-900">
                                {pkg.packageName}
                              </td>
                              {activeRateCategories.map((cat) => {
                                const rate = pkg.rates?.[cat];
                                return (
                                  <td key={cat} className="py-2.5 px-3 text-right font-mono">
                                    <div className="font-semibold text-slate-900">
                                      ₹{Number(rate?.baseFare || 0).toLocaleString("en-IN")}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Bata: ₹{Number(rate?.driverBata || 0).toLocaleString("en-IN")}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Extra Rates */}
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-semibold text-slate-900">
                    Local Duty Over-Limits &amp; Extra Charges
                  </h4>
                  <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Charge Particular</th>
                          {activeRateCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 text-right">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        <tr>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            Extra Rate Per Hour (₹/Hr)
                          </td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                              ₹{Number(defaultTariff.localDuty?.extraRates?.extraPerHour?.[cat] || 0).toLocaleString("en-IN")}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            Extra Rate Per KM (₹/KM)
                          </td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                              ₹{Number(defaultTariff.localDuty?.extraRates?.extraPerKm?.[cat] || 0).toLocaleString("en-IN")}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. PICKUP & DROP */}
            {mainPreviewTab === "Pickup & Drop" && (
              <div className="p-4 space-y-4">
                {/* Airport Transfers */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-[#f16623]" />
                      <span>Airport Transfer Particulars</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Fixed rate airport pickup / drop</span>
                  </div>

                  <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Particular</th>
                          {activeRateCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 text-right">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        <tr>
                          <td className="py-2.5 px-3 font-medium text-slate-800">Package Fare (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              ₹{Number(defaultTariff.pickupDropDuty?.airportRates?.fare?.[cat] || 0).toLocaleString("en-IN")}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Included Hours / KM</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              {defaultTariff.pickupDropDuty?.airportRates?.includedHours?.[cat] || 2} Hrs / {defaultTariff.pickupDropDuty?.airportRates?.includedKm?.[cat] || 40} KM
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Waiting Per Hour (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              ₹{defaultTariff.pickupDropDuty?.airportRates?.waitingPerHour?.[cat] || 0}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Extra Per KM (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              ₹{defaultTariff.pickupDropDuty?.airportRates?.extraPerKm?.[cat] || 0}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Railway Transfers */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Train className="w-3.5 h-3.5 text-[#f16623]" />
                      <span>Railway Station Transfer Particulars</span>
                    </h3>
                    <span className="text-[11px] text-slate-400">Fixed rate station pickup / drop</span>
                  </div>

                  <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Particular</th>
                          {activeRateCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 text-right">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        <tr>
                          <td className="py-2.5 px-3 font-medium text-slate-800">Package Fare (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                              ₹{Number(defaultTariff.pickupDropDuty?.railwayRates?.fare?.[cat] || 0).toLocaleString("en-IN")}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Included Hours / KM</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              {defaultTariff.pickupDropDuty?.railwayRates?.includedHours?.[cat] || 2} Hrs / {defaultTariff.pickupDropDuty?.railwayRates?.includedKm?.[cat] || 30} KM
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Waiting Per Hour (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              ₹{defaultTariff.pickupDropDuty?.railwayRates?.waitingPerHour?.[cat] || 0}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-slate-600">Extra Per KM (₹)</td>
                          {activeRateCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                              ₹{defaultTariff.pickupDropDuty?.railwayRates?.extraPerKm?.[cat] || 0}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. DAY RENT */}
            {mainPreviewTab === "Day Rent" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Day Rent Fares (12 Hours &amp; 24 Hours)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Driver allowances &amp; fuel rates</span>
                </div>

                <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Rent Particular</th>
                        {activeRateCategories.map((cat) => (
                          <th key={cat} className="py-2.5 px-3 text-right">
                            {cat}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800">12 Hours Day Rent Fare (₹)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            ₹{Number(defaultTariff.dayRentDuty?.rates?.dayRent12Hrs?.[cat] || 0).toLocaleString("en-IN")}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800">24 Hours Day Rent Fare (₹)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            ₹{Number(defaultTariff.dayRentDuty?.rates?.dayRent24Hrs?.[cat] || 0).toLocaleString("en-IN")}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Driver Bata (12 Hrs / 24 Hrs)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                            ₹{defaultTariff.dayRentDuty?.rates?.driverBata12Hrs?.[cat] || 0} / ₹{defaultTariff.dayRentDuty?.rates?.driverBata24Hrs?.[cat] || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Fuel Mileage (KM / Litre)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                            {defaultTariff.dayRentDuty?.rates?.fuelMileage?.[cat] || "-"} KM/L
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Night Halt Per Night (₹)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                            ₹{defaultTariff.dayRentDuty?.rates?.nightHaltPerNight?.[cat] || 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. OUTSTATION */}
            {mainPreviewTab === "Outstation" && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Outstation Long Distance Particulars</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">Base slab, per-km rate &amp; night halts</span>
                </div>

                <div className="border border-slate-200 rounded-[6px] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Outstation Particular</th>
                        {activeRateCategories.map((cat) => (
                          <th key={cat} className="py-2.5 px-3 text-right">
                            {cat}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800">Base KM Slab / Day</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            {defaultTariff.outstationDuty?.rates?.baseKmSlab?.[cat] || 300} KM
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-medium text-slate-800">Per KM Charge (₹/KM)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                            ₹{defaultTariff.outstationDuty?.rates?.perKmCharge?.[cat] || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Driver Bata Per Day (₹)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                            ₹{defaultTariff.outstationDuty?.rates?.driverBataPerDay?.[cat] || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2 px-3 text-slate-600">Night Halt Per Night (₹)</td>
                        {activeRateCategories.map((cat) => (
                          <td key={cat} className="py-2 px-3 text-right font-mono text-slate-700">
                            ₹{defaultTariff.outstationDuty?.rates?.nightHaltPerNight?.[cat] || 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* EDIT DEFAULT CUSTOMER TARIFF OFFCANVAS DRAWER */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title="Edit Default Customer Tariff"
        subtitle="Configure standard rate card, vehicle categories & duty slabs common for all individual customers"
        size="3xl"
        widthClassName="max-w-4xl"
      >
        <div className="space-y-4 text-xs font-normal">
          {/* Top Form Meta Card */}
          <div className="bg-slate-50/80 p-3 rounded-[6px] border border-slate-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
                <span className="font-medium text-slate-900 text-xs">
                  Default Customer Rate Specifications
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  populateStandardBaselineRates(
                    allAvailableCategories.length > 0
                      ? allAvailableCategories.slice(0, 4)
                      : ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"]
                  )
                }
                className="h-[28px] max-h-[34px] px-2.5 rounded-[4px] bg-orange-50 hover:bg-orange-100 text-[#f16623] border border-[#f16623]/30 text-[11px] font-medium transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Fill Standard Baseline Rates</span>
              </button>
            </div>

            {/* Scope notification */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-[6px] bg-orange-50/70 border border-orange-200/60 text-slate-800 text-xs">
              <Sparkles className="w-4 h-4 text-[#f16623] shrink-0" />
              <div>
                <span className="font-semibold text-slate-900 block">
                  Common Default Tariff for All Customers
                </span>
                <span className="text-[11px] text-slate-500">
                  These rates automatically apply to every individual customer trip booked in the system.
                </span>
              </div>
            </div>

            {/* Dates & Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  VALID FROM <span className="text-[#f16623]">*</span>
                </label>
                <CustomDatePicker
                  value={validFrom}
                  onChange={setValidFrom}
                  placeholder="Select valid from..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  VALID TO (OPTIONAL)
                </label>
                <CustomDatePicker
                  value={validTo}
                  onChange={setValidTo}
                  placeholder="Perpetual / ongoing"
                  minDate={validFrom}
                  align="right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  TARIFF STATUS
                </label>
                <SearchableSelect
                  options={[
                    { value: "Active", label: "Active", badge: "Live", badgeColor: "green" },
                    { value: "Inactive", label: "Inactive", badge: "Inactive", badgeColor: "slate" },
                  ]}
                  value={tariffStatus}
                  onChange={(val) => setTariffStatus(val as "Active" | "Inactive")}
                />
              </div>
            </div>
          </div>

          {/* Vehicle Category Selection Matrix */}
          <div className="bg-white p-3 rounded-[6px] border border-slate-200/90 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <span className="font-medium text-slate-900 text-xs">
                  Included Vehicle Categories
                </span>
                <p className="text-[10px] text-slate-400 font-normal">
                  Each selected category adds a dedicated rate column across Local, Airport, Day Rent and Outstation
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="h-[28px] max-h-[34px] px-2 text-[11px] bg-slate-50 border border-slate-200 rounded-[4px] w-36 focus:outline-none focus:border-[#f16623]"
                />
                <button
                  type="button"
                  onClick={() => setShowAddCategoryInput(!showAddCategoryInput)}
                  className="h-[28px] max-h-[34px] px-2 rounded-[4px] border border-dashed border-[#f16623]/40 text-[#f16623] hover:bg-orange-50 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Custom Category</span>
                </button>
              </div>
            </div>

            {/* Add Custom Category Inline Box */}
            {showAddCategoryInput && (
              <div className="p-2 rounded-[4px] bg-orange-50/50 border border-orange-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. LUXURY MERCEDES (A/C)"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  className="h-[28px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[4px] flex-1 focus:outline-none focus:border-[#f16623]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCategory}
                  className="h-[28px] max-h-[34px] px-3 rounded-[4px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryInput(false)}
                  className="h-[28px] max-h-[34px] px-2 rounded-[4px] text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Category Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {displayedCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] text-xs transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-[#f16623] text-white border-[#f16623] font-medium shadow-2xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-normal"
                    }`}
                  >
                    <Car className={`w-3 h-3 ${isSelected ? "text-white" : "text-slate-400"}`} />
                    <span>{cat}</span>
                    {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Navigation: Local, Pickup & Drop, Day Rent, Outstation */}
          <div className="flex items-center gap-1 border-b border-slate-200 pb-1 overflow-x-auto">
            {(["Local", "Pickup & Drop", "Day Rent", "Outstation"] as const).map(
              (tab) => {
                const isActive = editorActiveTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEditorActiveTab(tab)}
                    className={`px-3 py-1.5 text-xs rounded-[4px] transition cursor-pointer select-none shrink-0 ${
                      isActive
                        ? "bg-orange-50 text-[#f16623] font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal"
                    }`}
                  >
                    {tab}
                  </button>
                );
              }
            )}
          </div>

          {/* ================================================================= */}
          {/* TAB 1: LOCAL DUTY EDITOR */}
          {/* ================================================================= */}
          {editorActiveTab === "Local" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-2.5 rounded-[6px] bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="offerLocalDutyCheckbox"
                    checked={offerLocal}
                    onChange={(e) => setOfferLocal(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] cursor-pointer"
                  />
                  <label htmlFor="offerLocalDutyCheckbox" className="font-medium text-slate-800 text-xs cursor-pointer">
                    Enable Local Duty Rates
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingPackage(true)}
                  className="h-[28px] max-h-[34px] px-2.5 rounded-[4px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition flex items-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Package</span>
                </button>
              </div>

              {/* Add Package Inline */}
              {isAddingPackage && (
                <div className="p-2.5 rounded-[6px] bg-orange-50/60 border border-orange-200 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 10 HOURS 100 KM"
                    value={newPackageName}
                    onChange={(e) => setNewPackageName(e.target.value)}
                    className="h-[30px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[4px] flex-1 focus:outline-none focus:border-[#f16623]"
                  />
                  <button
                    type="button"
                    onClick={handleAddPackage}
                    className="h-[30px] max-h-[34px] px-3 rounded-[4px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] cursor-pointer"
                  >
                    Save Package
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingPackage(false)}
                    className="h-[30px] max-h-[34px] px-2 rounded-[4px] text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Local Packages List */}
              {localPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="font-semibold text-xs text-slate-900 font-mono">
                      {pkg.packageName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeletePackage(pkg.id)}
                      className="text-slate-400 hover:text-rose-600 text-xs transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-1 px-2">Field</th>
                          {selectedCategories.map((c) => (
                            <th key={c} className="py-1 px-2 text-right">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        <tr>
                          <td className="py-1.5 px-2 font-medium text-slate-700">Base Fare (₹)</td>
                          {selectedCategories.map((c) => (
                            <td key={c} className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                placeholder="0"
                                value={pkg.rates?.[c]?.baseFare ?? ""}
                                onChange={(e) => updatePackageRate(pkg.id, c, "baseFare", e.target.value)}
                                className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-1.5 px-2 text-slate-500">Driver Bata (₹)</td>
                          {selectedCategories.map((c) => (
                            <td key={c} className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                placeholder="0"
                                value={pkg.rates?.[c]?.driverBata ?? ""}
                                onChange={(e) => updatePackageRate(pkg.id, c, "driverBata", e.target.value)}
                                className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Extra KM / Extra Hour Rates */}
              <div className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-2 shadow-2xs">
                <span className="font-semibold text-xs text-slate-900 block border-b border-slate-100 pb-1.5">
                  Local Duty Extra Rates (Per Hour / Per KM)
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-1 px-2">Charge Type</th>
                        {selectedCategories.map((c) => (
                          <th key={c} className="py-1 px-2 text-right">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr>
                        <td className="py-1.5 px-2 font-medium text-slate-700">Extra Per Hour (₹/Hr)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={localExtraRates.extraPerHour?.[c] ?? ""}
                              onChange={(e) => updateLocalExtraRate("extraPerHour", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-medium text-slate-700">Extra Per KM (₹/KM)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={localExtraRates.extraPerKm?.[c] ?? ""}
                              onChange={(e) => updateLocalExtraRate("extraPerKm", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: PICKUP & DROP EDITOR */}
          {/* ================================================================= */}
          {editorActiveTab === "Pickup & Drop" && (
            <div className="space-y-4">
              {/* Airport Duty Card */}
              <div className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <input
                    type="checkbox"
                    id="offerAirportCheckbox"
                    checked={offerAirport}
                    onChange={(e) => setOfferAirport(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] cursor-pointer"
                  />
                  <label htmlFor="offerAirportCheckbox" className="font-semibold text-xs text-slate-900 flex items-center gap-1.5 cursor-pointer">
                    <Plane className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Airport Transfer Rates</span>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-1 px-2">Particular</th>
                        {selectedCategories.map((c) => (
                          <th key={c} className="py-1 px-2 text-right">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr>
                        <td className="py-1.5 px-2 font-medium text-slate-800">Package Fare (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={airportRates.fare?.[c] ?? ""}
                              onChange={(e) => updateAirportRate("fare", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Included Hours</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="2"
                              value={airportRates.includedHours?.[c] ?? ""}
                              onChange={(e) => updateAirportRate("includedHours", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Included KM</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="40"
                              value={airportRates.includedKm?.[c] ?? ""}
                              onChange={(e) => updateAirportRate("includedKm", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Waiting Per Hour (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={airportRates.waitingPerHour?.[c] ?? ""}
                              onChange={(e) => updateAirportRate("waitingPerHour", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Extra Per KM (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={airportRates.extraPerKm?.[c] ?? ""}
                              onChange={(e) => updateAirportRate("extraPerKm", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Railway Duty Card */}
              <div className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <input
                    type="checkbox"
                    id="offerRailwayCheckbox"
                    checked={offerRailway}
                    onChange={(e) => setOfferRailway(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] cursor-pointer"
                  />
                  <label htmlFor="offerRailwayCheckbox" className="font-semibold text-xs text-slate-900 flex items-center gap-1.5 cursor-pointer">
                    <Train className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Railway Station Transfer Rates</span>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-1 px-2">Particular</th>
                        {selectedCategories.map((c) => (
                          <th key={c} className="py-1 px-2 text-right">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      <tr>
                        <td className="py-1.5 px-2 font-medium text-slate-800">Package Fare (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={railwayRates.fare?.[c] ?? ""}
                              onChange={(e) => updateRailwayRate("fare", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Included Hours</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="2"
                              value={railwayRates.includedHours?.[c] ?? ""}
                              onChange={(e) => updateRailwayRate("includedHours", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Included KM</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="30"
                              value={railwayRates.includedKm?.[c] ?? ""}
                              onChange={(e) => updateRailwayRate("includedKm", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Waiting Per Hour (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={railwayRates.waitingPerHour?.[c] ?? ""}
                              onChange={(e) => updateRailwayRate("waitingPerHour", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-slate-600">Extra Per KM (₹)</td>
                        {selectedCategories.map((c) => (
                          <td key={c} className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              placeholder="0"
                              value={railwayRates.extraPerKm?.[c] ?? ""}
                              onChange={(e) => updateRailwayRate("extraPerKm", c, e.target.value)}
                              className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: DAY RENT EDITOR */}
          {/* ================================================================= */}
          {editorActiveTab === "Day Rent" && (
            <div className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <input
                  type="checkbox"
                  id="offerDayRentCheckbox"
                  checked={offerDayRent}
                  onChange={(e) => setOfferDayRent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] cursor-pointer"
                />
                <label htmlFor="offerDayRentCheckbox" className="font-semibold text-xs text-slate-900 cursor-pointer">
                  Enable Day Rent Duties (12 &amp; 24 Hours)
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1 px-2">Day Rent Particular</th>
                      {selectedCategories.map((c) => (
                        <th key={c} className="py-1 px-2 text-right">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    <tr>
                      <td className="py-1.5 px-2 font-medium text-slate-800">12 Hours Day Rent Fare (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.dayRent12Hrs?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("dayRent12Hrs", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-medium text-slate-800">24 Hours Day Rent Fare (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.dayRent24Hrs?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("dayRent24Hrs", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Driver Bata (12 Hrs) (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.driverBata12Hrs?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("driverBata12Hrs", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Driver Bata (24 Hrs) (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.driverBata24Hrs?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("driverBata24Hrs", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Fuel Mileage (KM / Litre)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.fuelMileage?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("fuelMileage", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Night Halt Per Night (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={dayRentRates.nightHaltPerNight?.[c] ?? ""}
                            onChange={(e) => updateDayRentRate("nightHaltPerNight", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: OUTSTATION EDITOR */}
          {/* ================================================================= */}
          {editorActiveTab === "Outstation" && (
            <div className="p-3 rounded-[6px] border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <input
                  type="checkbox"
                  id="offerOutstationCheckbox"
                  checked={offerOutstation}
                  onChange={(e) => setOfferOutstation(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] cursor-pointer"
                />
                <label htmlFor="offerOutstationCheckbox" className="font-semibold text-xs text-slate-900 cursor-pointer">
                  Enable Outstation Duty Particulars
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1 px-2">Outstation Particular</th>
                      {selectedCategories.map((c) => (
                        <th key={c} className="py-1 px-2 text-right">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    <tr>
                      <td className="py-1.5 px-2 font-medium text-slate-800">Base KM Slab / Day</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="300"
                            value={outstationRates.baseKmSlab?.[c] ?? ""}
                            onChange={(e) => updateOutstationRate("baseKmSlab", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 font-medium text-slate-800">Per KM Charge (₹/KM)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={outstationRates.perKmCharge?.[c] ?? ""}
                            onChange={(e) => updateOutstationRate("perKmCharge", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Driver Bata Per Day (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={outstationRates.driverBataPerDay?.[c] ?? ""}
                            onChange={(e) => updateOutstationRate("driverBataPerDay", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1.5 px-2 text-slate-600">Night Halt Per Night (₹)</td>
                      {selectedCategories.map((c) => (
                        <td key={c} className="py-1.5 px-2 text-right">
                          <input
                            type="number"
                            placeholder="0"
                            value={outstationRates.nightHaltPerNight?.[c] ?? ""}
                            onChange={(e) => updateOutstationRate("nightHaltPerNight", c, e.target.value)}
                            className="w-24 h-[28px] max-h-[34px] text-right px-2 bg-slate-50 border border-slate-200 rounded-[4px] focus:outline-none focus:border-[#f16623] focus:bg-white font-mono text-xs"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Drawer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveTariffSubmit("Inactive")}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-normal transition cursor-pointer disabled:opacity-50"
              >
                Save as Draft / Inactive
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveTariffSubmit("Active")}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Rates...</span>
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Save &amp; Activate Tariff</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </OffCanvas>
    </div>
  );
}
