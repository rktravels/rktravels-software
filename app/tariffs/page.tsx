"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import {
  Tags,
  Plus,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Copy,
  Calendar,
  AlertTriangle,
  ClipboardCheck,
  Building2,
  X,
  Edit2,
  Clock,
  Car,
  History,
  Plane,
  Train,
  Check,
  Settings,
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
  where,
  getDocs,
  setDoc,
  getDoc,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import {
  FuelChargesCard,
  type FuelChargesConfig,
  DEFAULT_FUEL_CHARGES_CONFIG,
} from "@/components/FuelChargesCard";

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
  includedHours?: number;
  includedKm?: number;
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
  fuelConfig?: FuelChargesConfig;
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
  fuelConfig?: FuelChargesConfig;
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
  fuelConfig?: FuelChargesConfig;
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
  fuelConfig?: FuelChargesConfig;
}

// 5. Overall Tariff Record
export interface TariffRecord {
  id: string;
  tariffName: string;
  customerName: string;
  validFrom: string;
  validTo?: string | null;
  status: "Active" | "Inactive";
  selectedCategories: string[];
  localDuty: LocalDutyConfig;
  pickupDropDuty: PickupDropDutyConfig;
  dayRentDuty: DayRentDutyConfig;
  outstationDuty: OutstationDutyConfig;
  // Legacy / Booking compatibility fields
  planName?: string;
  amount?: number;
  travelId?: string;
  travelName?: string;
  sourceCollection?: "tariffs" | "plans";
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

const ITEMS_PER_PAGE = 24;

export default function TariffsPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingTariffId, setEditingTariffId] = useState<string | null>(null);

  // --- Tariff Form State (clean empty defaults) ---
  const [customerName, setCustomerName] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");
  const [tariffStatus, setTariffStatus] = useState<"Active" | "Inactive">("Active");
  const [offerActivityLog, setOfferActivityLog] = useState(false);

  // Selected vehicle categories (loaded dynamically from database)
  const [allAvailableCategories, setAllAvailableCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "Local" | "Pickup & Drop" | "Day Rent" | "Outstation" | "Activity Log"
  >("Local");

  // --- 1. LOCAL DUTY STATE ---
  const [offerLocal, setOfferLocal] = useState(false);
  const [localPackages, setLocalPackages] = useState<TariffPackageBlock[]>([]);
  const [localExtraRates, setLocalExtraRates] = useState<ExtraRatesBlock>({
    extraPerHour: {},
    extraPerKm: {},
  });
  const [localFuelConfig, setLocalFuelConfig] = useState<FuelChargesConfig>(
    DEFAULT_FUEL_CHARGES_CONFIG
  );
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  // New Hours+KM package inputs
  const [newPkgHours, setNewPkgHours] = useState<number | "">("");
  const [newPkgKm, setNewPkgKm] = useState<number | "">("");

  // --- 2. PICKUP & DROP STATE ---
  const [offerAirport, setOfferAirport] = useState(false);
  const [offerRailway, setOfferRailway] = useState(false);
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
  const [pickupDropFuelConfig, setPickupDropFuelConfig] = useState<FuelChargesConfig>(
    DEFAULT_FUEL_CHARGES_CONFIG
  );

  // --- 3. DAY RENT STATE ---
  const [offerDayRent, setOfferDayRent] = useState(false);
  const [dayRentRates, setDayRentRates] = useState<DayRentParticulars>({
    dayRent12Hrs: {},
    dayRent24Hrs: {},
    fuelMileage: {},
    driverBata12Hrs: {},
    driverBata24Hrs: {},
    nightHaltPerNight: {},
  });
  const [dayRentFuelConfig, setDayRentFuelConfig] = useState<FuelChargesConfig>(
    DEFAULT_FUEL_CHARGES_CONFIG
  );

  // --- 4. OUTSTATION STATE ---
  const [offerOutstation, setOfferOutstation] = useState(false);
  const [outstationRates, setOutstationRates] = useState<OutstationParticulars>({
    baseKmSlab: {},
    perKmCharge: {},
    driverBataPerDay: {},
    nightHaltPerNight: {},
  });
  const [outstationFuelConfig, setOutstationFuelConfig] = useState<FuelChargesConfig>(
    DEFAULT_FUEL_CHARGES_CONFIG
  );

  // Page List & Search
  const [tariffsList, setTariffsList] = useState<TariffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Available Companies for dropdown
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);

  // --- Settings OffCanvas State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'local' | 'pickup' | 'dayrent' | 'outstation'>('dayrent');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Day Rent Settings
  const [dayRentDayMode, setDayRentDayMode] = useState<'24hour' | 'calendar'>('24hour');
  const [dayRentDayHours, setDayRentDayHours] = useState(24);
  const [nightChargeFrom, setNightChargeFrom] = useState('22:00');
  const [nightChargeTo, setNightChargeTo] = useState('06:00');
  const [overtimeGraceMinutes, setOvertimeGraceMinutes] = useState(30);

  // Outstation Settings
  const [outstationMinKmPerDay, setOutstationMinKmPerDay] = useState(300);
  const [outstationReturnTrip, setOutstationReturnTrip] = useState<'separate-day' | 'included'>('separate-day');

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
            if (prev.length === 0) return cats;
            const valid = prev.filter((c) => cats.includes(c));
            return valid.length > 0 ? valid : cats;
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

interface CompanyOptionItem {
  id: string;
  name: string;
  tradeName?: string;
  billingState?: string;
}

  // Available Companies for dropdown
  const [companiesList, setCompaniesList] = useState<CompanyOptionItem[]>([]);
  const [isCustomCompany, setIsCustomCompany] = useState(false);

  // 2. Fetch Companies / Corporate Clients for customer dropdown
  useEffect(() => {
    const unsubList: (() => void)[] = [];
    try {
      const companyMap = new Map<string, CompanyOptionItem>();

      const syncCompanies = () => {
        const list = Array.from(companyMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setCompaniesList(list);
      };

      // Listen to 'companies'
      const unsub1 = onSnapshot(collection(db, "companies"), (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const name = data.legalName || data.tradeName || data.name;
          if (name) {
            companyMap.set(d.id, {
              id: d.id,
              name: name,
              tradeName: data.tradeName,
              billingState: data.billingState,
            });
          }
        });
        syncCompanies();
      });
      unsubList.push(unsub1);

      // Listen to 'business_owners'
      const unsub2 = onSnapshot(collection(db, "business_owners"), (snap) => {
        snap.docs.forEach((d) => {
          const data = d.data();
          const name = data.companyName || data.name;
          if (name && !companyMap.has(d.id)) {
            companyMap.set(d.id, {
              id: d.id,
              name: name,
              tradeName: data.tradeName,
              billingState: data.billingState,
            });
          }
        });
        syncCompanies();
      });
      unsubList.push(unsub2);
    } catch (err) {
      console.warn("Could not load companies for tariff dropdown:", err);
    }

    return () => {
      unsubList.forEach((u) => u());
    };
  }, []);

  // 3. Real-time Tariffs collection listener (with legacy plans fallback)
  useEffect(() => {
    let unsubTariffs: (() => void) | null = null;
    let unsubPlans: (() => void) | null = null;

    try {
      const recordsMap = new Map<string, TariffRecord>();

      const syncState = () => {
        const list = Array.from(recordsMap.values()).sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });
        setTariffsList(list);
        setLoading(false);
      };

      // Listen to 'tariffs'
      const qTariffs = query(collection(db, "tariffs"), orderBy("createdAt", "desc"));
      unsubTariffs = onSnapshot(
        qTariffs,
        (snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            recordsMap.set(docSnap.id, {
              id: docSnap.id,
              tariffName: data.tariffName || data.planName || "Standard Tariff",
              customerName: data.customerName || data.tariffName || "Standard",
              validFrom: data.validFrom || "Open-ended",
              validTo: data.validTo || null,
              status: (data.status as "Active" | "Inactive") || "Active",
              selectedCategories: data.selectedCategories || ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)"],
              localDuty: data.localDuty || { enabled: true, packages: [], extraRates: { extraPerHour: {}, extraPerKm: {} } },
              pickupDropDuty: data.pickupDropDuty || {
                offerAirport: true,
                offerRailway: true,
                airportRates: airportRates,
                railwayRates: railwayRates,
              },
              dayRentDuty: data.dayRentDuty || {
                enabled: true,
                rates: dayRentRates,
              },
              outstationDuty: data.outstationDuty || {
                enabled: true,
                rates: outstationRates,
              },
              planName: data.planName,
              amount: data.amount,
              travelName: data.travelName,
              sourceCollection: "tariffs",
              createdAt: data.createdAt || null,
              updatedAt: data.updatedAt || null,
            });
          });
          syncState();
        },
        (err) => {
          console.warn("Tariffs fallback check:", err);
          const fallback = query(collection(db, "tariffs"));
          unsubTariffs = onSnapshot(fallback, (snap) => {
            snap.docs.forEach((docSnap) => {
              const data = docSnap.data();
              recordsMap.set(docSnap.id, {
                id: docSnap.id,
                tariffName: data.tariffName || data.planName || "Standard Tariff",
                customerName: data.customerName || data.tariffName || "Standard",
                validFrom: data.validFrom || "Open-ended",
                validTo: data.validTo || null,
                status: (data.status as "Active" | "Inactive") || "Active",
                selectedCategories: data.selectedCategories || ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)"],
                localDuty: data.localDuty || { enabled: true, packages: [], extraRates: { extraPerHour: {}, extraPerKm: {} } },
                pickupDropDuty: data.pickupDropDuty || {
                  offerAirport: true,
                  offerRailway: true,
                  airportRates: airportRates,
                  railwayRates: railwayRates,
                },
                dayRentDuty: data.dayRentDuty || {
                  enabled: true,
                  rates: dayRentRates,
                },
                outstationDuty: data.outstationDuty || {
                  enabled: true,
                  rates: outstationRates,
                },
                planName: data.planName,
                amount: data.amount,
                travelName: data.travelName,
                sourceCollection: "tariffs",
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
              });
            });
            syncState();
          });
        }
      );

      // Listen to legacy 'plans' collection
      const qPlans = query(collection(db, "plans"), orderBy("createdAt", "desc"));
      unsubPlans = onSnapshot(
        qPlans,
        (snap) => {
          snap.docs.forEach((docSnap) => {
            if (!recordsMap.has(docSnap.id)) {
              const data = docSnap.data();
              recordsMap.set(docSnap.id, {
                id: docSnap.id,
                tariffName: data.planName || "Standard Plan",
                customerName: data.travelName || "Standard",
                validFrom: "Open-ended",
                validTo: null,
                status: "Active",
                selectedCategories: ["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)"],
                localDuty: {
                  enabled: true,
                  packages: [
                    {
                      id: "legacy-plan",
                      packageName: data.planName || "Fixed Package",
                      rates: {
                        "SEDAN (A/C)": { baseFare: data.amount || 0, nightCharge: 0, driverBata: 0 },
                        "INNOVA (A/C)": { baseFare: data.amount || 0, nightCharge: 0, driverBata: 0 },
                        "CRYSTA (A/C)": { baseFare: data.amount || 0, nightCharge: 0, driverBata: 0 },
                      },
                    },
                  ],
                  extraRates: { extraPerHour: {}, extraPerKm: {} },
                },
                pickupDropDuty: { offerAirport: false, offerRailway: false, airportRates, railwayRates },
                dayRentDuty: { enabled: false, rates: dayRentRates },
                outstationDuty: { enabled: false, rates: outstationRates },
                planName: data.planName,
                amount: data.amount,
                travelName: data.travelName,
                sourceCollection: "plans",
                createdAt: data.createdAt || null,
              });
            }
          });
          syncState();
        },
        (err) => {
          console.warn("Legacy plans notice:", err);
          syncState();
        }
      );
    } catch (err) {
      console.error("Error setting up tariffs listener:", err);
      setLoading(false);
    }

    return () => {
      if (unsubTariffs) unsubTariffs();
      if (unsubPlans) unsubPlans();
    };
  }, []);

  // 4. Load tariff settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, "tariff_settings", "global"));
        if (snap.exists()) {
          const data = snap.data();
          if (data.dayRentDayMode) setDayRentDayMode(data.dayRentDayMode);
          if (data.dayRentDayHours !== undefined) setDayRentDayHours(data.dayRentDayHours);
          if (data.nightChargeFrom) setNightChargeFrom(data.nightChargeFrom);
          if (data.nightChargeTo) setNightChargeTo(data.nightChargeTo);
          if (data.overtimeGraceMinutes !== undefined) setOvertimeGraceMinutes(data.overtimeGraceMinutes);
          if (data.outstationMinKmPerDay !== undefined) setOutstationMinKmPerDay(data.outstationMinKmPerDay);
          if (data.outstationReturnTrip) setOutstationReturnTrip(data.outstationReturnTrip);
        }
      } catch (err) {
        console.warn("Could not load tariff settings:", err);
      }
    };
    loadSettings();
  }, []);

  // --- Handlers for Category Selection ---
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

  // --- Copy Standard Baseline Rates ---
  const handleCopyStandard = () => {
    setCustomerName("Standard");
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setTariffStatus("Active");
    setSelectedCategories(["SEDAN (A/C)", "INNOVA (A/C)", "CRYSTA (A/C)", "HYCROSS (A/C)"]);

    // Local
    setLocalPackages([
      {
        id: "pkg-4h-40k",
        packageName: "4 HOURS 40 KM",
        includedHours: 4,
        includedKm: 40,
        rates: {
          "SEDAN (A/C)": { baseFare: 1500, nightCharge: 0, driverBata: 100 },
          "INNOVA (A/C)": { baseFare: 2000, nightCharge: 0, driverBata: 100 },
          "CRYSTA (A/C)": { baseFare: 3000, nightCharge: 0, driverBata: 100 },
          "HYCROSS (A/C)": { baseFare: 3500, nightCharge: 0, driverBata: 150 },
        },
      },
      {
        id: "pkg-8h-80k",
        packageName: "8 HOURS 80 KM",
        includedHours: 8,
        includedKm: 80,
        rates: {
          "SEDAN (A/C)": { baseFare: 2500, nightCharge: 0, driverBata: 200 },
          "INNOVA (A/C)": { baseFare: 3000, nightCharge: 0, driverBata: 200 },
          "CRYSTA (A/C)": { baseFare: 4000, nightCharge: 0, driverBata: 200 },
          "HYCROSS (A/C)": { baseFare: 4800, nightCharge: 0, driverBata: 250 },
        },
      },
    ]);
    setLocalExtraRates({
      extraPerHour: {
        "SEDAN (A/C)": 125,
        "INNOVA (A/C)": 200,
        "CRYSTA (A/C)": 250,
        "HYCROSS (A/C)": 300,
      },
      extraPerKm: {
        "SEDAN (A/C)": 13,
        "INNOVA (A/C)": 18,
        "CRYSTA (A/C)": 20,
        "HYCROSS (A/C)": 24,
      },
    });

    // Pickup & Drop
    setOfferAirport(true);
    setOfferRailway(true);
    setAirportRates({
      includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
      includedKm: { "SEDAN (A/C)": 40, "INNOVA (A/C)": 40, "CRYSTA (A/C)": 40, "HYCROSS (A/C)": 40 },
      fare: { "SEDAN (A/C)": 1400, "INNOVA (A/C)": 2200, "CRYSTA (A/C)": 2800, "HYCROSS (A/C)": 3400 },
      waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
      extraPerKm: { "SEDAN (A/C)": 14, "INNOVA (A/C)": 19, "CRYSTA (A/C)": 22, "HYCROSS (A/C)": 26 },
    });
    setRailwayRates({
      includedHours: { "SEDAN (A/C)": 2, "INNOVA (A/C)": 2, "CRYSTA (A/C)": 2, "HYCROSS (A/C)": 2 },
      includedKm: { "SEDAN (A/C)": 30, "INNOVA (A/C)": 30, "CRYSTA (A/C)": 30, "HYCROSS (A/C)": 30 },
      fare: { "SEDAN (A/C)": 900, "INNOVA (A/C)": 1400, "CRYSTA (A/C)": 1900, "HYCROSS (A/C)": 2400 },
      waitingPerHour: { "SEDAN (A/C)": 120, "INNOVA (A/C)": 180, "CRYSTA (A/C)": 220, "HYCROSS (A/C)": 260 },
      extraPerKm: { "SEDAN (A/C)": 14, "INNOVA (A/C)": 19, "CRYSTA (A/C)": 22, "HYCROSS (A/C)": 26 },
    });

    // Day Rent
    setOfferDayRent(true);
    setDayRentRates({
      dayRent12Hrs: { "SEDAN (A/C)": 3200, "INNOVA (A/C)": 4200, "CRYSTA (A/C)": 5200, "HYCROSS (A/C)": 6200 },
      dayRent24Hrs: { "SEDAN (A/C)": 4500, "INNOVA (A/C)": 6000, "CRYSTA (A/C)": 7500, "HYCROSS (A/C)": 8800 },
      fuelMileage: { "SEDAN (A/C)": 16, "INNOVA (A/C)": 12, "CRYSTA (A/C)": 11, "HYCROSS (A/C)": 14 },
      driverBata12Hrs: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 350, "CRYSTA (A/C)": 400, "HYCROSS (A/C)": 450 },
      driverBata24Hrs: { "SEDAN (A/C)": 500, "INNOVA (A/C)": 600, "CRYSTA (A/C)": 700, "HYCROSS (A/C)": 800 },
      nightHaltPerNight: { "SEDAN (A/C)": 300, "INNOVA (A/C)": 350, "CRYSTA (A/C)": 400, "HYCROSS (A/C)": 450 },
    });

    // Outstation
    setOfferOutstation(true);
    setOutstationRates({
      baseKmSlab: { "SEDAN (A/C)": 350, "INNOVA (A/C)": 450, "CRYSTA (A/C)": 450, "HYCROSS (A/C)": 450 },
      perKmCharge: { "SEDAN (A/C)": 13, "INNOVA (A/C)": 18, "CRYSTA (A/C)": 20, "HYCROSS (A/C)": 24 },
      driverBataPerDay: { "SEDAN (A/C)": 500, "INNOVA (A/C)": 700, "CRYSTA (A/C)": 700, "HYCROSS (A/C)": 800 },
      nightHaltPerNight: { "SEDAN (A/C)": 250, "INNOVA (A/C)": 250, "CRYSTA (A/C)": 250, "HYCROSS (A/C)": 300 },
    });

    setFeedback({
      type: "success",
      message: "Standard baseline market tariff rates copied across all duties!",
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // --- Handlers for Local Duty (new Hours+KM approach) ---
  const handleAddNewPackage = () => {
    if (!newPkgHours || !newPkgKm) {
      alert("Please enter both hours and kilometers for the package.");
      return;
    }
    const packageName = `${newPkgHours} HOURS ${newPkgKm} KM`;
    const newPkg: TariffPackageBlock = {
      id: `pkg-${Date.now()}`,
      packageName,
      includedHours: Number(newPkgHours),
      includedKm: Number(newPkgKm),
      rates: {},
    };
    selectedCategories.forEach((cat) => {
      newPkg.rates[cat] = { baseFare: "", nightCharge: "", driverBata: "" };
    });
    setLocalPackages([...localPackages, newPkg]);
    setNewPkgHours("");
    setNewPkgKm("");
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
              [field]: value === "" ? "" : Number(value),
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

  // --- Save Settings to Firestore ---
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsFeedback(null);
    try {
      await setDoc(doc(db, "tariff_settings", "global"), {
        dayRentDayMode,
        dayRentDayHours,
        nightChargeFrom,
        nightChargeTo,
        overtimeGraceMinutes,
        outstationMinKmPerDay,
        outstationReturnTrip,
        updatedAt: serverTimestamp(),
      });
      setSettingsFeedback({ type: "success", message: "Settings saved successfully!" });
      setTimeout(() => setSettingsFeedback(null), 3000);
    } catch (err) {
      console.error("Error saving tariff settings:", err);
      setSettingsFeedback({ type: "error", message: "Failed to save settings." });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --- Open Edit Tariff ---
  const handleEditTariff = (tariff: TariffRecord) => {
    setEditingTariffId(tariff.id);
    setCustomerName(tariff.customerName || "Standard");
    setValidFrom(tariff.validFrom || new Date().toISOString().split("T")[0]);
    setValidTo(tariff.validTo || "");
    setTariffStatus(tariff.status || "Active");
    setSelectedCategories(
      tariff.selectedCategories?.length > 0
        ? tariff.selectedCategories
        : allAvailableCategories.length > 0
        ? allAvailableCategories
        : []
    );

    // Local
    if (tariff.localDuty?.packages?.length > 0) {
      setLocalPackages(tariff.localDuty.packages);
      setLocalExtraRates(tariff.localDuty.extraRates || localExtraRates);
      setOfferLocal(tariff.localDuty.enabled ?? true);
      setLocalFuelConfig(tariff.localDuty.fuelConfig || DEFAULT_FUEL_CHARGES_CONFIG);
    } else {
      setLocalFuelConfig(tariff.localDuty?.fuelConfig || DEFAULT_FUEL_CHARGES_CONFIG);
    }

    // Pickup & Drop
    if (tariff.pickupDropDuty) {
      setOfferAirport(tariff.pickupDropDuty.offerAirport ?? true);
      setOfferRailway(tariff.pickupDropDuty.offerRailway ?? true);
      if (tariff.pickupDropDuty.airportRates) setAirportRates(tariff.pickupDropDuty.airportRates);
      if (tariff.pickupDropDuty.railwayRates) setRailwayRates(tariff.pickupDropDuty.railwayRates);
      setPickupDropFuelConfig(tariff.pickupDropDuty.fuelConfig || DEFAULT_FUEL_CHARGES_CONFIG);
    }

    // Day Rent
    if (tariff.dayRentDuty) {
      setOfferDayRent(tariff.dayRentDuty.enabled ?? true);
      if (tariff.dayRentDuty.rates) setDayRentRates(tariff.dayRentDuty.rates);
      setDayRentFuelConfig(tariff.dayRentDuty.fuelConfig || DEFAULT_FUEL_CHARGES_CONFIG);
    }

    // Outstation
    if (tariff.outstationDuty) {
      setOfferOutstation(tariff.outstationDuty.enabled ?? true);
      if (tariff.outstationDuty.rates) setOutstationRates(tariff.outstationDuty.rates);
      setOutstationFuelConfig(tariff.outstationDuty.fuelConfig || DEFAULT_FUEL_CHARGES_CONFIG);
    }

    setIsCustomCompany(false);
    setIsOffCanvasOpen(true);
  };

  // --- Open Add New Tariff ---
  const handleOpenAddTariff = () => {
    setEditingTariffId(null);
    setCustomerName("");
    setValidFrom(new Date().toISOString().split("T")[0]);
    setValidTo("");
    setTariffStatus("Active");
    setActiveTab("Local");
    setSelectedCategories(allAvailableCategories.length > 0 ? allAvailableCategories : []);
    setOfferLocal(false);
    setLocalPackages([]);
    setLocalExtraRates({ extraPerHour: {}, extraPerKm: {} });
    setLocalFuelConfig(DEFAULT_FUEL_CHARGES_CONFIG);
    setOfferAirport(false);
    setOfferRailway(false);
    setAirportRates({ includedHours: {}, includedKm: {}, fare: {}, waitingPerHour: {}, extraPerKm: {} });
    setRailwayRates({ includedHours: {}, includedKm: {}, fare: {}, waitingPerHour: {}, extraPerKm: {} });
    setPickupDropFuelConfig(DEFAULT_FUEL_CHARGES_CONFIG);
    setOfferDayRent(false);
    setDayRentRates({ dayRent12Hrs: {}, dayRent24Hrs: {}, fuelMileage: {}, driverBata12Hrs: {}, driverBata24Hrs: {}, nightHaltPerNight: {} });
    setDayRentFuelConfig(DEFAULT_FUEL_CHARGES_CONFIG);
    setOfferOutstation(false);
    setOutstationRates({ baseKmSlab: {}, perKmCharge: {}, driverBataPerDay: {}, nightHaltPerNight: {} });
    setOutstationFuelConfig(DEFAULT_FUEL_CHARGES_CONFIG);
    setOfferActivityLog(false);
    setIsCustomCompany(false);
    setIsAddingPackage(false);
    setNewPkgHours("");
    setNewPkgKm("");
    setIsOffCanvasOpen(true);
  };

  // --- Save / Activate Tariff Submission ---
  const handleSaveTariffSubmit = async (statusToSave: "Active" | "Inactive") => {
    setFeedback(null);

    const trimmedCust = customerName.trim();
    if (!trimmedCust) {
      alert("Please enter customer name or 'Standard'.");
      return;
    }
    if (!validFrom) {
      alert("Please select a Valid From date.");
      return;
    }

    setIsSubmitting(true);

    try {
      const tariffPayload = {
        tariffName: trimmedCust === "Standard" ? "Standard Tariff" : `${trimmedCust} Tariff`,
        customerName: trimmedCust,
        validFrom: validFrom,
        validTo: validTo.trim() || null,
        status: statusToSave,
        selectedCategories: selectedCategories,
        localDuty: {
          enabled: offerLocal,
          packages: localPackages,
          extraRates: localExtraRates,
          fuelConfig: localFuelConfig,
        },
        pickupDropDuty: {
          offerAirport: offerAirport,
          offerRailway: offerRailway,
          airportRates: airportRates,
          railwayRates: railwayRates,
          fuelConfig: pickupDropFuelConfig,
        },
        dayRentDuty: {
          enabled: offerDayRent,
          rates: dayRentRates,
          fuelConfig: dayRentFuelConfig,
        },
        outstationDuty: {
          enabled: offerOutstation,
          rates: outstationRates,
          fuelConfig: outstationFuelConfig,
        },
        // Compatibility fields for Bookings dropdown
        planName: `${trimmedCust} Tariff`,
        amount: Number(localPackages[0]?.rates[selectedCategories[0]]?.baseFare) || 0,
        updatedAt: serverTimestamp(),
      };

      // Auto-deactivate previous active tariffs for this customer if saving as Active
      if (statusToSave === "Active") {
        try {
          const qActive = query(
            collection(db, "tariffs"),
            where("customerName", "==", trimmedCust),
            where("status", "==", "Active")
          );
          const activeDocs = await getDocs(qActive);
          for (const d of activeDocs.docs) {
            if (editingTariffId && d.id === editingTariffId) continue;
            await updateDoc(doc(db, "tariffs", d.id), { status: "Inactive" });
          }
        } catch (err) {
          console.warn("Auto-deactivate notice:", err);
        }
      }

      if (editingTariffId) {
        await updateDoc(doc(db, "tariffs", editingTariffId), tariffPayload);
        setFeedback({
          type: "success",
          message: `Tariff for "${trimmedCust}" updated successfully as ${statusToSave}!`,
        });
      } else {
        await addDoc(collection(db, "tariffs"), {
          ...tariffPayload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `New Tariff for "${trimmedCust}" saved successfully as ${statusToSave}!`,
        });
      }

      setIsOffCanvasOpen(false);
      setEditingTariffId(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving tariff:", err);
      const msg = err instanceof Error ? err.message : "Failed to save tariff.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Tariff
  const handleDeleteTariff = async (id: string, name: string, collectionName = "tariffs") => {
    if (!confirm(`Are you sure you want to delete tariff for "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      setFeedback({ type: "success", message: `Tariff "${name}" deleted.` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting tariff:", err);
      setFeedback({ type: "error", message: "Failed to delete tariff." });
    }
  };

  // Filter Tariffs
  const filteredTariffs = tariffsList.filter(
    (t) =>
      t.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tariffName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.selectedCategories?.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Pagination (Strict 24 items limit)
  const totalPages = Math.max(1, Math.ceil(filteredTariffs.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const currentTariffs = filteredTariffs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filtered categories for category selection pill list
  const displayedCategories = allAvailableCategories.filter((cat) =>
    cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
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
        <span className="text-[#f16623] font-medium">Company Tariff</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <Tags className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Company Tariff &amp; Pricing Matrix
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {tariffsList.length} Total
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Customer contracts, Local duty, Airport &amp; Railway transfers, Day Rent, Outstation (24 items per page)
            </p>
          </div>
        </div>

        {/* Search & Add Tariff Button */}
        <div className="flex items-center gap-2">
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customer, tariff, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
            />
          </div>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-normal transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddTariff}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Tariff</span>
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

      {/* Tariffs Directory Table */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-[2px] bg-[#f16623]"></span>
            <h3 className="text-xs font-medium text-slate-900">
              Active Tariff Contracts &amp; Global Fallbacks
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            Showing {filteredTariffs.length > 0 ? startIndex + 1 : 0}-
            {Math.min(startIndex + ITEMS_PER_PAGE, filteredTariffs.length)} of{" "}
            {filteredTariffs.length} record{filteredTariffs.length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-1.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading tariffs matrix from Firestore...</span>
          </div>
        ) : filteredTariffs.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2">
              <Tags className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery ? "No matching tariffs found" : "No tariffs configured yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching for another customer name, category, or validity date."
                : "Click on 'Add Tariff' to configure multi-category rate slabs, duty packages, and extra rates."}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleOpenAddTariff}
                className="mt-3 h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Tariff</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center font-medium">#</th>
                  <th className="py-2.5 px-3 font-medium">Customer / Tariff</th>
                  <th className="py-2.5 px-3 font-medium">Vehicle Categories</th>
                  <th className="py-2.5 px-3 font-medium">Validity Period</th>
                  <th className="py-2.5 px-3 font-medium">Local 4H/40K Sample</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentTariffs.map((t, index) => {
                  const isFallback = t.customerName === "Standard";
                  const sampleRate =
                    t.localDuty?.packages?.[0]?.rates?.[t.selectedCategories?.[0]]?.baseFare ||
                    t.amount ||
                    "-";

                  return (
                    <tr key={t.id} className="hover:bg-orange-50/20 transition-colors group">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px] font-normal">
                        {startIndex + index + 1}
                      </td>

                      {/* Customer / Name */}
                      <td className="py-2 px-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 text-xs flex items-center gap-1.5">
                            {t.customerName}
                            {isFallback && (
                              <span className="px-1.5 py-0.2 rounded-[4px] text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Global Fallback
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {t.tariffName}
                          </span>
                        </div>
                      </td>

                      {/* Vehicle Categories */}
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {t.selectedCategories?.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-slate-700 text-[10px] font-normal border border-slate-200"
                            >
                              {cat}
                            </span>
                          ))}
                          {t.selectedCategories?.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded-[4px] bg-orange-50 text-[#f16623] text-[10px] font-normal border border-[#f16623]/20">
                              +{t.selectedCategories.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Validity Period */}
                      <td className="py-2 px-3 text-slate-500 font-normal text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{t.validFrom}</span>
                          <span className="text-slate-300">→</span>
                          <span>{t.validTo || "Open-ended"}</span>
                        </div>
                      </td>

                      {/* Base Sample Rate */}
                      <td className="py-2 px-3">
                        <span className="font-mono text-slate-900 font-medium text-xs bg-slate-100 px-2 py-0.5 rounded-[4px] border border-slate-200/70 inline-block">
                          {sampleRate !== "-" ? `₹${Number(sampleRate).toLocaleString("en-IN")}` : "-"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-medium border ${
                            t.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              t.status === "Active" ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {t.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditTariff(t)}
                            className="h-[28px] max-h-[34px] px-2 rounded-[6px] text-slate-600 hover:text-[#f16623] hover:bg-orange-50 border border-slate-200 hover:border-[#f16623]/30 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                            title="Edit tariff matrix"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteTariff(t.id, t.customerName, t.sourceCollection || "tariffs")
                            }
                            className="h-[28px] max-h-[34px] w-[28px] rounded-[6px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                            title="Delete tariff"
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

        {/* Pagination Bar */}
        {filteredTariffs.length > ITEMS_PER_PAGE && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 font-normal">
              Showing page <span className="font-medium">{safePage}</span> of{" "}
              <span className="font-medium">{totalPages}</span> ({filteredTariffs.length} total records)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-[28px] max-h-[34px] px-2 rounded-[6px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-normal inline-flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3 h-3" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;

                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-slate-300 text-xs px-0.5">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`h-[28px] max-h-[34px] min-w-[28px] px-2 rounded-[6px] text-xs font-medium transition cursor-pointer ${
                            safePage === p
                              ? "bg-[#f16623] text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-normal"
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-[28px] max-h-[34px] px-2 rounded-[6px] border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-normal inline-flex items-center gap-1 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* Off-Canvas Drawer: ADD / EDIT TARIFF MATRIX */}
      {/* ============================================================== */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        title={editingTariffId ? "Edit Tariff & Pricing Matrix" : "Add Tariff & Pricing Matrix"}
        subtitle="Configure corporate rate card, vehicle category columns, duty slabs & extra rates"
        widthClassName="w-screen max-w-5xl sm:max-w-6xl xl:max-w-7xl"
      >
        <div className="space-y-4">
          {/* Top Fields Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-slate-50/70 p-3.5 rounded-[6px] border border-slate-200">
            {/* Customer Dropdown */}
            <div className="md:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  CUSTOMER / COMPANY <span className="text-[#f16623]">*</span>
                </label>
                {companiesList.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    {companiesList.length} companies
                  </span>
                )}
              </div>

              {!isCustomCompany ? (
                <div className="relative">
                  <SearchableSelect
                    options={[
                      { value: "Standard", label: "Standard (Global Fallback)", badge: "Standard" },
                      { value: "HIMEROS PHARMA", label: "HIMEROS PHARMA" },
                      ...(customerName &&
                      customerName !== "Standard" &&
                      customerName !== "HIMEROS PHARMA" &&
                      !companiesList.some((c) => c.name === customerName)
                        ? [{ value: customerName, label: `${customerName} (Selected)` }]
                        : []),
                      ...companiesList
                        .filter((c) => c.name !== "Standard" && c.name !== "HIMEROS PHARMA")
                        .map((c) => ({
                          value: c.name,
                          label: c.name,
                          subLabel: c.billingState ? `State: ${c.billingState}` : undefined,
                        })),
                      {
                        value: "__custom__",
                        label: "+ Enter Custom Company Name...",
                        subLabel: "Type a new corporate entity name",
                      },
                    ]}
                    value={customerName}
                    onChange={(val) => {
                      if (val === "__custom__") {
                        setIsCustomCompany(true);
                        setCustomerName("");
                      } else {
                        setCustomerName(val);
                      }
                    }}
                    placeholder="Search & select company..."
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Enter company name..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCompany(false);
                      setCustomerName("Standard");
                    }}
                    className="h-[34px] max-h-[34px] px-2.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded-[6px] shrink-0 hover:bg-slate-50 transition cursor-pointer"
                  >
                    List
                  </button>
                </div>
              )}
              <span className="text-[10px] text-slate-400 font-normal block">
                Select from Companies list. Leave as Standard for global fallback.
              </span>
            </div>

            {/* Valid From * */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                VALID FROM <span className="text-[#f16623]">*</span>
              </label>
              <CustomDatePicker
                value={validFrom}
                onChange={setValidFrom}
                placeholder="Select start date..."
              />
            </div>

            {/* Valid To */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                VALID TO
              </label>
              <CustomDatePicker
                value={validTo}
                onChange={setValidTo}
                placeholder="Select end date..."
                minDate={validFrom}
              />
              <span className="text-[10px] text-slate-400 font-normal block">
                Blank = open-ended.
              </span>
            </div>

            {/* Tariff Status */}
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                TARIFF STATUS
              </label>
              <SearchableSelect
                options={[
                  { value: "Active", label: "Active", badge: "Active", badgeColor: "green" },
                  { value: "Inactive", label: "Inactive", badge: "Inactive", badgeColor: "slate" },
                ]}
                value={tariffStatus}
                onChange={(val) => setTariffStatus(val as "Active" | "Inactive")}
              />
            </div>

            {/* Copy Standard Button */}
            <div className="md:col-span-2 pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleCopyStandard}
                className="h-[34px] max-h-[34px] w-full px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-orange-50 hover:text-[#f16623] hover:border-[#f16623]/30 text-slate-700 text-xs font-normal transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#f16623]" />
                <span>Copy Standard</span>
              </button>
            </div>
          </div>

          {/* Yellow / Amber Warning Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-amber-50/70 border border-amber-200 text-amber-800 text-xs font-normal">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Saving as <strong className="font-medium">Active</strong> will auto-deactivate any
              previous active tariffs for the selected categories and customer.
            </span>
          </div>

          {/* Vehicle Categories In This Card */}
          <div className="space-y-2.5 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-[28px] h-[28px] rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                  <Car className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-900 font-medium">
                      Vehicle Categories in this card
                    </span>
                    <span className="text-slate-400 font-normal text-[10px]">
                      — each becomes a column
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal block">
                    All vehicle categories available. Click any pill to toggle its column in the pricing matrix below.
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-[#f16623] bg-orange-50 px-2 py-0.5 rounded-[4px] border border-[#f16623]/20">
                  {selectedCategories.length} Selected
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedCategories([...allAvailableCategories])}
                  className="h-[26px] max-h-[34px] px-2 rounded-[4px] text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                >
                  Select All
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedCategories([
                      "SEDAN (A/C)",
                      "INNOVA (A/C)",
                      "CRYSTA (A/C)",
                      "HYCROSS (A/C)",
                    ])
                  }
                  className="h-[26px] max-h-[34px] px-2 rounded-[4px] text-[10px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                >
                  Standard (4)
                </button>

                {!showAddCategoryInput ? (
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryInput(true)}
                    className="h-[26px] max-h-[34px] px-2.5 rounded-[4px] text-[11px] text-[#f16623] hover:text-[#d95318] hover:bg-orange-50 border border-[#f16623]/25 font-medium inline-flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add category</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="e.g. FORCE URBANIA"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="h-[26px] max-h-[34px] px-2 text-[11px] bg-white border border-slate-200 rounded-[4px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCategory}
                      className="h-[26px] max-h-[34px] px-2.5 rounded-[4px] bg-[#f16623] text-white text-[11px] font-medium cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCategoryInput("");
                        setShowAddCategoryInput(false);
                      }}
                      className="h-[26px] max-h-[34px] px-2 rounded-[4px] text-slate-400 hover:text-slate-700 text-[11px] font-normal"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick search input to filter category pills */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="relative w-full sm:w-64">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter categories (e.g. Innova, Bus, Tempo)..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full h-[26px] max-h-[34px] pl-7 pr-2 text-[11px] bg-slate-50 border border-slate-200 rounded-[4px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-normal">
                {displayedCategories.length} categories shown
              </span>
            </div>

            {/* Full List of Vehicle Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 max-h-48 overflow-y-auto scrollbar-thin">
              {displayedCategories.map((cat) => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`h-[28px] max-h-[34px] px-3 rounded-full text-[11px] transition cursor-pointer flex items-center gap-1.5 select-none ${
                      isSelected
                        ? "border border-[#f16623] bg-orange-50/80 text-[#f16623] font-medium shadow-2xs"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-[#f16623]" : "bg-slate-300"
                      }`}
                    />
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Navigation for Duty Types */}
          <div className="flex items-center gap-1 border-b border-slate-200 pt-1 overflow-x-auto">
            {(
              [
                "Local",
                "Pickup & Drop",
                "Day Rent",
                "Outstation",
                "Activity Log",
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 select-none ${
                    isActive
                      ? "text-[#f16623] border-b-2 border-[#f16623] -mb-[1px] bg-orange-50/40"
                      : "text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:bg-slate-50 font-normal"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isActive ? "bg-[#f16623]" : "bg-slate-300"
                    }`}
                  />
                  <span>{tab}</span>
                </button>
              );
            })}
          </div>

          {/* Paste from Excel Tip Banner */}
          <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-orange-50/40 border border-orange-200/60 text-slate-700 text-xs font-normal">
            <ClipboardCheck className="w-4 h-4 text-[#f16623] shrink-0" />
            <span>
              <strong className="font-medium">Paste from Excel:</strong> click any rate cell and press{" "}
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-white border border-slate-300 text-[10px] font-mono shadow-2xs">
                Ctrl
              </kbd>{" "}
              -{" "}
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-white border border-slate-300 text-[10px] font-mono shadow-2xs">
                V
              </kbd>{" "}
              — a copied block fills across categories and down particulars automatically.{" "}
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-white border border-slate-300 text-[10px] font-mono shadow-2xs">
                Tab
              </kbd>{" "}
              moves right,{" "}
              <kbd className="px-1.5 py-0.5 rounded-[4px] bg-white border border-slate-300 text-[10px] font-mono shadow-2xs">
                Enter
              </kbd>{" "}
              moves down.
            </span>
          </div>

          {/* ============================================================== */}
          {/* TAB 1: LOCAL DUTY */}
          {/* ============================================================== */}
          {activeTab === "Local" && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none mt-1">
                  <input
                    type="checkbox"
                    checked={offerLocal}
                    onChange={(e) => setOfferLocal(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                  />
                  <span>We offer Local duty</span>
                </label>

                <div className="flex items-center gap-2">
                  {isAddingPackage ? (
                    <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-[6px] w-full sm:w-auto">
                      <div className="flex items-center gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">Hours</label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            placeholder="e.g. 4"
                            value={newPkgHours}
                            onChange={(e) => setNewPkgHours(e.target.value === "" ? "" : Number(e.target.value))}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            className="w-20 h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">Kilometers</label>
                          <input
                            type="number"
                            min="1"
                            placeholder="e.g. 40"
                            value={newPkgKm}
                            onChange={(e) => setNewPkgKm(e.target.value === "" ? "" : Number(e.target.value))}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            className="w-24 h-[30px] px-2 text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                      {newPkgHours && newPkgKm && (
                        <div className="text-[10px] text-[#f16623] font-medium bg-orange-50 px-2 py-1 rounded-[4px] border border-[#f16623]/20">
                          Package: {newPkgHours} HOURS {newPkgKm} KM
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={handleAddNewPackage} className="h-[28px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium cursor-pointer">Add</button>
                        <button type="button" onClick={() => { setNewPkgHours(""); setNewPkgKm(""); setIsAddingPackage(false); }} className="h-[28px] px-2 rounded-[6px] text-slate-400 hover:text-slate-700 text-xs cursor-pointer">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingPackage(true)}
                      className="h-[30px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1 transition shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add package</span>
                    </button>
                  )}
                </div>
              </div>

              {offerLocal ? (
                <div className="border border-slate-200 rounded-[6px] overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-50/40 border-b border-slate-200 text-[11px] font-medium text-slate-700">
                          <th className="py-2.5 px-3.5 w-64 min-w-[220px]">Particulars</th>
                          {selectedCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 min-w-[130px] text-right font-medium text-slate-800">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {localPackages.length === 0 && (
                          <tr>
                            <td
                              colSpan={selectedCategories.length + 1}
                              className="py-5 px-4 text-center text-xs text-slate-400 bg-slate-50/40 font-normal"
                            >
                              No local packages added yet. Click &quot;Add package&quot; above to configure packages (e.g. 4 HOURS 40 KM, 8 HOURS 80 KM).
                            </td>
                          </tr>
                        )}
                        {localPackages.map((pkg) => (
                          <Fragment key={pkg.id}>
                            {/* Package Header Row */}
                            <tr className="bg-orange-50/20 border-t border-b border-orange-100">
                              <td colSpan={selectedCategories.length + 1} className="py-2 px-3.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 text-[#f16623] font-medium text-xs">
                                    <Tags className="w-3.5 h-3.5" />
                                    <span>{pkg.packageName}</span>
                                    {(pkg.includedHours || pkg.includedKm) && (
                                      <span className="text-[10px] text-slate-400 font-normal ml-1">
                                        ({pkg.includedHours ?? "?"}h / {pkg.includedKm ?? "?"}km included)
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePackage(pkg.id)}
                                    className="text-slate-400 hover:text-rose-600 transition p-1 rounded cursor-pointer"
                                    title="Remove this package"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Base Fare */}
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-1.5 px-3.5 pl-6 text-slate-700 font-normal">Base Fare ₹</td>
                              {selectedCategories.map((cat) => (
                                <td key={cat} className="py-1.5 px-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={pkg.rates[cat]?.baseFare ?? ""}
                                    onChange={(e) => updatePackageRate(pkg.id, cat, "baseFare", e.target.value)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </td>
                              ))}
                            </tr>

                            {/* Night Charge */}
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-1.5 px-3.5 pl-6 text-slate-700 font-normal">Night Charge ₹</td>
                              {selectedCategories.map((cat) => (
                                <td key={cat} className="py-1.5 px-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={pkg.rates[cat]?.nightCharge ?? ""}
                                    onChange={(e) => updatePackageRate(pkg.id, cat, "nightCharge", e.target.value)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </td>
                              ))}
                            </tr>

                            {/* Driver Bata */}
                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-1.5 px-3.5 pl-6 text-slate-700 font-normal">Driver Bata / Day ₹</td>
                              {selectedCategories.map((cat) => (
                                <td key={cat} className="py-1.5 px-3 text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    value={pkg.rates[cat]?.driverBata ?? ""}
                                    onChange={(e) => updatePackageRate(pkg.id, cat, "driverBata", e.target.value)}
                                    onWheel={(e) => (e.target as HTMLElement).blur()}
                                    className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                  />
                                </td>
                              ))}
                            </tr>
                          </Fragment>
                        ))}

                        {/* Extra Rates */}
                        <tr className="bg-slate-50 border-t-2 border-slate-200">
                          <td colSpan={selectedCategories.length + 1} className="py-2 px-3.5 text-[10px] uppercase font-medium text-slate-500 tracking-wider">
                            EXTRA RATES — APPLY TO ALL PACKAGES
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-1.5 px-3.5 pl-6 text-slate-700 font-normal">Extra per Hour ₹/hr</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-1.5 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={localExtraRates.extraPerHour[cat] ?? ""}
                                onChange={(e) => updateLocalExtraRate("extraPerHour", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-1.5 px-3.5 pl-6 text-slate-700 font-normal">Extra per KM ₹/km</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-1.5 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={localExtraRates.extraPerKm[cat] ?? ""}
                                onChange={(e) => updateLocalExtraRate("extraPerKm", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">Local duty is currently disabled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check &quot;We offer Local duty&quot; above or in the tab bar to configure local packages and extra rates.
                  </p>
                </div>
              )}

              {/* Fuel Charges Section */}
              <FuelChargesCard
                dutyTitle="Local"
                config={localFuelConfig}
                onChange={setLocalFuelConfig}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: PICKUP & DROP */}
          {/* ============================================================== */}
          {activeTab === "Pickup & Drop" && (
            <div className="space-y-4">
              {/* Airport & Railway Checkbox Toggles */}
              <div className="flex items-center gap-6 text-xs font-medium text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={offerAirport}
                    onChange={(e) => setOfferAirport(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                  />
                  <span>Airport transfers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={offerRailway}
                    onChange={(e) => setOfferRailway(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                  />
                  <span>Railway transfers</span>
                </label>
              </div>

              {/* Airport Section Table */}
              {offerAirport && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                    <Plane className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Airport</span>
                  </div>
                  <div className="border border-slate-200 rounded-[6px] overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50/40 border-b border-slate-200 text-[11px] font-medium text-slate-700">
                            <th className="py-2.5 px-3.5 w-64 min-w-[220px]">Particulars</th>
                            {selectedCategories.map((cat) => (
                              <th key={cat} className="py-2.5 px-3 min-w-[130px] text-right font-medium text-slate-800">
                                {cat}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Included Hours hrs</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={airportRates.includedHours[cat] ?? ""}
                                  onChange={(e) => updateAirportRate("includedHours", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Included KM km</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={airportRates.includedKm[cat] ?? ""}
                                  onChange={(e) => updateAirportRate("includedKm", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Fare ₹</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={airportRates.fare[cat] ?? ""}
                                  onChange={(e) => updateAirportRate("fare", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Waiting / Extra per Hour ₹/hr</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={airportRates.waitingPerHour[cat] ?? ""}
                                  onChange={(e) => updateAirportRate("waitingPerHour", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Extra per KM ₹/km</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={airportRates.extraPerKm[cat] ?? ""}
                                  onChange={(e) => updateAirportRate("extraPerKm", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
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

              {/* Railway Section Table */}
              {offerRailway && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                    <Train className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Railway</span>
                  </div>
                  <div className="border border-slate-200 rounded-[6px] overflow-hidden bg-white shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-50/40 border-b border-slate-200 text-[11px] font-medium text-slate-700">
                            <th className="py-2.5 px-3.5 w-64 min-w-[220px]">Particulars</th>
                            {selectedCategories.map((cat) => (
                              <th key={cat} className="py-2.5 px-3 min-w-[130px] text-right font-medium text-slate-800">
                                {cat}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Included Hours hrs</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={railwayRates.includedHours[cat] ?? ""}
                                  onChange={(e) => updateRailwayRate("includedHours", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Included KM km</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={railwayRates.includedKm[cat] ?? ""}
                                  onChange={(e) => updateRailwayRate("includedKm", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Fare ₹</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={railwayRates.fare[cat] ?? ""}
                                  onChange={(e) => updateRailwayRate("fare", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Waiting / Extra per Hour ₹/hr</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={railwayRates.waitingPerHour[cat] ?? ""}
                                  onChange={(e) => updateRailwayRate("waitingPerHour", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2 px-3.5 text-slate-700 font-normal">Extra per KM ₹/km</td>
                            {selectedCategories.map((cat) => (
                              <td key={cat} className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={railwayRates.extraPerKm[cat] ?? ""}
                                  onChange={(e) => updateRailwayRate("extraPerKm", cat, e.target.value)}
                                  onWheel={(e) => (e.target as HTMLElement).blur()}
                                  className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="0"
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

              {!offerAirport && !offerRailway && (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">Pickup &amp; Drop transfers are currently disabled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check &quot;Airport transfers&quot; or &quot;Railway transfers&quot; above to configure transfer rates.
                  </p>
                </div>
              )}

              {/* Fuel Charges Section */}
              <FuelChargesCard
                dutyTitle="Pickup & Drop"
                config={pickupDropFuelConfig}
                onChange={setPickupDropFuelConfig}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: DAY RENT */}
          {/* ============================================================== */}
          {activeTab === "Day Rent" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={offerDayRent}
                  onChange={(e) => setOfferDayRent(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                />
                <span>We offer Day Rent</span>
              </label>

              {offerDayRent ? (
                <div className="border border-slate-200 rounded-[6px] overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-50/40 border-b border-slate-200 text-[11px] font-medium text-slate-700">
                          <th className="py-2.5 px-3.5 w-64 min-w-[220px]">Particulars</th>
                          {selectedCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 min-w-[130px] text-right font-medium text-slate-800">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Day Rent (12 Hours) ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.dayRent12Hrs[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("dayRent12Hrs", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Day Rent (24 Hours) ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.dayRent24Hrs[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("dayRent24Hrs", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Fuel Mileage km/l or km/kWh</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.fuelMileage[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("fuelMileage", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Driver Bata (12 Hrs) ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.driverBata12Hrs[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("driverBata12Hrs", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Driver Bata (24 Hrs) ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.driverBata24Hrs[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("driverBata24Hrs", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Night Halt per Night ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={dayRentRates.nightHaltPerNight[cat] ?? ""}
                                onChange={(e) => updateDayRentRate("nightHaltPerNight", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">Day Rent duty is currently disabled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check &quot;We offer Day Rent&quot; above or in the tab bar to configure 12h, 24h, fuel mileage, and driver bata.
                  </p>
                </div>
              )}

              {/* Fuel Charges Section */}
              <FuelChargesCard
                dutyTitle="Day Rent"
                config={dayRentFuelConfig}
                onChange={setDayRentFuelConfig}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: OUTSTATION */}
          {/* ============================================================== */}
          {activeTab === "Outstation" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={offerOutstation}
                  onChange={(e) => setOfferOutstation(e.target.checked)}
                  className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                />
                <span>We offer Outstation</span>
              </label>

              {offerOutstation ? (
                <div className="border border-slate-200 rounded-[6px] overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-amber-50/40 border-b border-slate-200 text-[11px] font-medium text-slate-700">
                          <th className="py-2.5 px-3.5 w-64 min-w-[220px]">Particulars</th>
                          {selectedCategories.map((cat) => (
                            <th key={cat} className="py-2.5 px-3 min-w-[130px] text-right font-medium text-slate-800">
                              {cat}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {/* Base KM Slab km/day */}
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Base KM Slab km/day</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={outstationRates.baseKmSlab[cat] ?? ""}
                                onChange={(e) => updateOutstationRate("baseKmSlab", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>

                        {/* Per KM Charge ₹/km */}
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Per KM Charge ₹/km</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={outstationRates.perKmCharge[cat] ?? ""}
                                onChange={(e) => updateOutstationRate("perKmCharge", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>

                        {/* Driver Bata per Day ₹ */}
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Driver Bata per Day ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={outstationRates.driverBataPerDay[cat] ?? ""}
                                onChange={(e) => updateOutstationRate("driverBataPerDay", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>

                        {/* Night Halt per Night ₹ */}
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2 px-3.5 text-slate-700 font-normal">Night Halt per Night ₹</td>
                          {selectedCategories.map((cat) => (
                            <td key={cat} className="py-2 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                value={outstationRates.nightHaltPerNight[cat] ?? ""}
                                onChange={(e) => updateOutstationRate("nightHaltPerNight", cat, e.target.value)}
                                onWheel={(e) => (e.target as HTMLElement).blur()}
                                className="w-full max-w-[120px] h-[30px] max-h-[34px] px-2 text-right text-xs bg-white border border-slate-200 rounded-[4px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">Outstation duty is currently disabled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check &quot;We offer Outstation&quot; above or in the tab bar to configure base km, per km charge, and bata.
                  </p>
                </div>
              )}

              {/* Fuel Charges Section */}
              <FuelChargesCard
                dutyTitle="Outstation"
                config={outstationFuelConfig}
                onChange={setOutstationFuelConfig}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: ACTIVITY LOG */}
          {/* ============================================================== */}
          {activeTab === "Activity Log" && (
            <div className="bg-white p-4 rounded-[6px] border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
                  <History className="w-4 h-4 text-[#f16623]" />
                  <span>Tariff Audit Trail &amp; Version History</span>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={offerActivityLog}
                    onChange={(e) => setOfferActivityLog(e.target.checked)}
                    className="w-4 h-4 rounded text-[#f16623] focus:ring-[#f16623] accent-[#f16623] cursor-pointer"
                  />
                  <span>Track Activity Log</span>
                </label>
              </div>

              {offerActivityLog ? (
                <div className="space-y-2 text-xs text-slate-600 font-normal">
                  {editingTariffId ? (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] bg-slate-50 border border-slate-200">
                      <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <span className="font-medium text-slate-900">
                          Active Tariff Matrix
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Assigned to {customerName || "Customer"} covering {selectedCategories.join(", ")}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 py-6 text-center">
                      No prior activity logs. An audit trail entry will be recorded when you save this tariff.
                    </p>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-[6px] bg-slate-50/50">
                  <p className="text-xs text-slate-500 font-medium">Activity log tracking is currently disabled</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Check &quot;Track Activity Log&quot; above to enable audit logging for this tariff.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* Drawer Bottom Actions */}
          {/* ============================================================== */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveTariffSubmit("Inactive")}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer shadow-2xs"
              >
                Save as Draft
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveTariffSubmit("Active")}
                className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Tariff...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{editingTariffId ? "Update & Activate Card" : "Save & Activate Card"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </OffCanvas>

      {/* ============================================================== */}
      {/* Settings OffCanvas */}
      {/* ============================================================== */}
      <OffCanvas
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Tariff Calculation Settings"
        subtitle="Configure how days, hours, and kilometers are counted across duty types"
        widthClassName="w-screen max-w-xl"
      >
        <div className="space-y-5">
          {/* Settings Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
            {(
              [
                { key: "local", label: "Local Duty" },
                { key: "pickup", label: "Pickup & Drop" },
                { key: "dayrent", label: "Day Rent" },
                { key: "outstation", label: "Outstation" },
              ] as const
            ).map(({ key, label }) => {
              const isActive = settingsActiveTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSettingsActiveTab(key)}
                  className={`px-4 py-2 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "text-[#f16623] border-b-2 border-[#f16623] -mb-[1px] bg-orange-50/40"
                      : "text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:bg-slate-50 font-normal"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Section A: Local Duty Settings */}
          {settingsActiveTab === "local" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-[6px] bg-blue-50 border border-blue-200">
                <span className="text-xs text-blue-800 font-normal">
                  <strong className="font-medium">Local Duty</strong> uses packages defined per tariff (e.g. 4 HOURS 40 KM). Extra charges apply when actual hours or km exceed the package limits. No global settings required here — configure per tariff card.
                </span>
              </div>
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">How extra charges work:</p>
                <p>• If actual hours &gt; package hours → (actualHours − packageHours) × extraPerHour rate</p>
                <p>• If actual km &gt; package km → (actualKm − packageKm) × extraPerKm rate</p>
                <p className="text-slate-400 text-[11px] mt-1">Both includedHours and includedKm are stored per package for calculation use.</p>
              </div>
            </div>
          )}

          {/* Section B: Pickup & Drop Settings */}
          {settingsActiveTab === "pickup" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-[6px] bg-blue-50 border border-blue-200">
                <span className="text-xs text-blue-800 font-normal">
                  <strong className="font-medium">Pickup &amp; Drop</strong> transfers (Airport &amp; Railway) use fixed fares with included hours and km. Extra waiting charges apply after the included hours. Configure rates per tariff card.
                </span>
              </div>
              <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">Fare calculation:</p>
                <p>• Fixed fare applies for the journey up to includedHours and includedKm</p>
                <p>• Waiting per hour kicks in after the included hours are exceeded</p>
                <p>• Extra per km applies if actual km exceeds included km</p>
              </div>
            </div>
          )}

          {/* Section C: Day Rent Settings */}
          {settingsActiveTab === "dayrent" && (
            <div className="space-y-5">
              {/* Day Counting Mode */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Day Counting Mode
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition ${dayRentDayMode === '24hour' ? 'border-[#f16623] bg-orange-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="dayMode"
                      value="24hour"
                      checked={dayRentDayMode === '24hour'}
                      onChange={() => setDayRentDayMode('24hour')}
                      className="mt-0.5 accent-[#f16623]"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-900">24-Hour Rolling</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">A day = exactly 24 hours from booking start. e.g. 10AM to 10AM next day = 1 day.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition ${dayRentDayMode === 'calendar' ? 'border-[#f16623] bg-orange-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="dayMode"
                      value="calendar"
                      checked={dayRentDayMode === 'calendar'}
                      onChange={() => setDayRentDayMode('calendar')}
                      className="mt-0.5 accent-[#f16623]"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Calendar Day</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">A day changes at midnight. e.g. 10PM Day 1 to 2AM Day 2 = 2 days.</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Day Rate Hours Threshold */}
              {dayRentDayMode === '24hour' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                    Day Rate Hours Threshold
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={dayRentDayHours}
                      onChange={(e) => setDayRentDayHours(Number(e.target.value))}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className="w-24 h-[34px] px-2.5 text-sm bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-xs text-slate-500">hours per day (default: 24)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Maximum hours included in one &quot;day&quot; before the next day rate kicks in.</p>
                </div>
              )}

              {/* Night Charge Time Range */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Night Charge Time Range
                </label>
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block">From</label>
                    <input
                      type="time"
                      value={nightChargeFrom}
                      onChange={(e) => setNightChargeFrom(e.target.value)}
                      className="h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 block">To</label>
                    <input
                      type="time"
                      value={nightChargeTo}
                      onChange={(e) => setNightChargeTo(e.target.value)}
                      className="h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">Bookings starting or falling within this window incur the night charge.</p>
              </div>

              {/* Overtime Grace Period */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Overtime Grace Period
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={overtimeGraceMinutes}
                    onChange={(e) => setOvertimeGraceMinutes(Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-24 h-[34px] px-2.5 text-sm bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-500">minutes (default: 30)</span>
                </div>
                <p className="text-[11px] text-slate-400">Minutes over the included time before extra overtime charges apply.</p>
              </div>
            </div>
          )}

          {/* Section D: Outstation Settings */}
          {settingsActiveTab === "outstation" && (
            <div className="space-y-5">
              {/* Minimum KM per Day */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Minimum KM per Day
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={outstationMinKmPerDay}
                    onChange={(e) => setOutstationMinKmPerDay(Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-28 h-[34px] px-2.5 text-sm bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs text-slate-500">km/day (default: 300)</span>
                </div>
                <p className="text-[11px] text-slate-400">Minimum guaranteed km charged per day, even if actual km driven is less.</p>
              </div>

              {/* Return Trip */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium text-slate-700 uppercase tracking-wider block">
                  Return Trip Counting
                </label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition ${outstationReturnTrip === 'separate-day' ? 'border-[#f16623] bg-orange-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="returnTrip"
                      value="separate-day"
                      checked={outstationReturnTrip === 'separate-day'}
                      onChange={() => setOutstationReturnTrip('separate-day')}
                      className="mt-0.5 accent-[#f16623]"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Separate Day</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Return trip counts as an additional day with its own km/bata charges.</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-[6px] border cursor-pointer transition ${outstationReturnTrip === 'included' ? 'border-[#f16623] bg-orange-50/40' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="returnTrip"
                      value="included"
                      checked={outstationReturnTrip === 'included'}
                      onChange={() => setOutstationReturnTrip('included')}
                      className="mt-0.5 accent-[#f16623]"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-900">Included in Trip</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Return trip km are included in total km calculation, not counted as extra day.</p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Settings Feedback */}
          {settingsFeedback && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs border ${settingsFeedback.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}`}>
              {settingsFeedback.type === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span>{settingsFeedback.message}</span>
            </div>
          )}

          {/* Settings Bottom Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isSavingSettings}
              onClick={handleSaveSettings}
              className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </OffCanvas>
    </div>
  );
}
