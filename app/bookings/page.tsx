"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Plus,
  Search,
  MapPin,
  ArrowRight,
  User,
  Building2,
  Layers,
  IndianRupee,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  X,
  Clock,
  Banknote,
  QrCode,
  CreditCard,
  UserCheck,
  Calendar,
  Car,
  Navigation,
  ChevronRight,
  Eye,
  AlertTriangle,
  Check,
  History,
  Receipt,
  FileText,
  Info,
  DollarSign,
  Fuel,
  TrendingUp,
  Sparkles,
  MoreVertical,
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
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect, type SearchableSelectOption } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { CustomTimePicker } from "@/components/CustomTimePicker";
import { ALL_INDIA_STATES_DATA } from "@/app/locations/page";
import { TaxInvoiceModal } from "@/components/TaxInvoiceModal";
import { generateNextInvoiceNumber } from "@/lib/invoice-utils";

// --- Types & Data Models ---

export type BookingStatus =
  | "New"
  | "Trip In Progress"
  | "Trip Completed"
  | "Invoice Generated"
  | "Invoice Sent";

export type PaymentStatus = "Unpaid" | "Partial" | "Paid";

export interface PaymentHistoryItem {
  id: string;
  date: string;
  time?: string;
  amount: number;
  paymentMode: "Cash" | "Card" | "UPI" | "Advance";
  referenceNumber?: string;
  notes?: string;
  recordedAt?: string;
}

export interface BookingRecord {
  id: string;
  bookingNumber: string;

  // Client Type
  clientType?: "Company" | "Individual Customer";
  customerType?: "Company" | "Individual Customer";

  // Tab 1: Details
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  fromLocation: string;
  toLocation: string;
  entityId: string;
  entityName: string;
  customerId: string; // Company Id or Customer Id
  customerName: string; // Company Name or Customer Name
  vehicleCategory: string;
  tariffType: "Local" | "Pickup & Drop" | "Day Rent" | "Outstation";
  tariffPackageId?: string;
  tariffPackageName?: string;
  travelerName: string;
  travelerMobile: string;

  // Tab 2: Trip Assignment
  durationText: string;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  vehicleId?: string;
  vehicleRegNumber?: string;
  vehicleName?: string;
  driverId?: string;
  driverName?: string;
  driverMobile?: string;
  driverStatus?: string;
  startingKm: number;
  endingKm: number;
  totalKm: number;
  travelledPlaces: string[];
  notes?: string;

  // Tab 3: Charges (Pass-through + Advance + Discount)
  tolls: number;
  parking: number;
  statePermit: number;
  meals: number;
  interstateEntryTax: number;
  nightHalt: number;
  totalPassThrough: number;
  customerAdvance: number;
  discount?: number;

  // Tab 4: Invoice / Price Breakdown
  baseFare: number;
  extraKmRate: number;
  extraKmCost: number;
  extraHoursRate: number;
  extraHoursCost: number;
  driverBataCost: number;
  nightHaltCost: number;
  grossAmount: number;
  netAmount: number;
  receivedAmount: number;
  balanceAmount: number;

  // Invoice & Fuel Specifics
  invoiceNumber?: string;
  invoiceDate?: string;
  fuelChargesCost?: number;
  fuelRatePerKm?: number;
  showFuelInInvoice?: boolean;

  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentHistory: PaymentHistoryItem[];

  createdAt?: any;
  updatedAt?: any;
}

// Flat list of major cities for travelled places multi-select
const ALL_CITIES_LIST: string[] = Array.from(
  new Set(ALL_INDIA_STATES_DATA.flatMap((s) => s.cities))
).sort();

export default function BookingsPage() {
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "details" | "assignment" | "charges" | "invoice"
  >("details");

  // Collections data
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [rawEntities, setRawEntities] = useState<any[]>([]);
  const [companies, setCompanies] = useState<
    { id: string; name: string; contactPerson?: string; mobile?: string }[]
  >([]);
  const [rawCompanies, setRawCompanies] = useState<any[]>([]);
  const [individualCustomers, setIndividualCustomers] = useState<
    { id: string; name: string; mobile?: string; email?: string }[]
  >([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [customerTariffs, setCustomerTariffs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [clientTypeFilter, setClientTypeFilter] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAllocatingInvoice, setIsAllocatingInvoice] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // View Details Modal
  const [viewingBooking, setViewingBooking] = useState<BookingRecord | null>(null);

  // Invoice Modal
  const [invoiceBooking, setInvoiceBooking] = useState<BookingRecord | null>(null);

  // Collect Payment Modal
  const [collectingBooking, setCollectingBooking] = useState<BookingRecord | null>(
    null
  );
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [collectMode, setCollectMode] = useState<"Cash" | "Card" | "UPI">("Cash");
  const [collectRefNumber, setCollectRefNumber] = useState<string>("");
  const [collectNotes, setCollectNotes] = useState<string>("");
  const [isCollectingPayment, setIsCollectingPayment] = useState(false);

  // =========================================================================
  // TAB 1: DETAILS STATE
  // =========================================================================
  const [clientType, setClientType] = useState<"Company" | "Individual Customer">("Company");
  const [startDate, setStartDate] = useState<string>(() =>
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endDate, setEndDate] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [dbLocations, setDbLocations] = useState<
    { id: string; name: string; state?: string; stateCode?: string; isActive?: boolean }[]
  >([]);

  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [selectedEntityName, setSelectedEntityName] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedCustomerName, setSelectedCustomerName] = useState("");

  const [selectedVehicleCategory, setSelectedVehicleCategory] = useState("");
  const [selectedTariffType, setSelectedTariffType] = useState<
    "Local" | "Pickup & Drop" | "Day Rent" | "Outstation"
  >("Local");

  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [selectedPackageName, setSelectedPackageName] = useState("");

  const [travelerName, setTravelerName] = useState("");
  const [travelerMobile, setTravelerMobile] = useState("");

  // =========================================================================
  // TAB 2: TRIP ASSIGNMENT STATE
  // =========================================================================
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedVehicleReg, setSelectedVehicleReg] = useState("");
  const [selectedVehicleName, setSelectedVehicleName] = useState("");

  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedDriverName, setSelectedDriverName] = useState("");
  const [selectedDriverMobile, setSelectedDriverMobile] = useState("");

  const [startingKm, setStartingKm] = useState<string>("");
  const [endingKm, setEndingKm] = useState<string>("");

  const [travelledPlaces, setTravelledPlaces] = useState<string[]>([]);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [notes, setNotes] = useState("");

  // =========================================================================
  // TAB 3: CHARGES STATE (IMAGE REQUIREMENTS)
  // =========================================================================
  const [tolls, setTolls] = useState<string>("");
  const [parking, setParking] = useState<string>("");
  const [statePermit, setStatePermit] = useState<string>("");
  const [meals, setMeals] = useState<string>("");
  const [interstateEntryTax, setInterstateEntryTax] = useState<string>("");
  const [nightHalt, setNightHalt] = useState<string>("");
  const [customerAdvance, setCustomerAdvance] = useState<string>("");
  const [discount, setDiscount] = useState<string>("");

  // =========================================================================
  // TAB 4: INVOICE / STATUS
  // =========================================================================
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>("New");
  const [overridePaymentStatus, setOverridePaymentStatus] = useState<
    PaymentStatus | null
  >(null);

  // Action Popover Menu (3 vertical dots)
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Close popover when clicking anywhere outside
  useEffect(() => {
    if (!activeActionMenuId) return;
    const handleClickOutside = () => setActiveActionMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [activeActionMenuId]);

  // -------------------------------------------------------------------------
  // 1. Subscribe to Entities / Travels
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubEntities: (() => void) | null = null;
    let unsubTravels: (() => void) | null = null;
    try {
      const entMap = new Map<string, string>();
      const syncEnts = () => {
        setEntities(
          Array.from(entMap.entries()).map(([id, name]) => ({ id, name }))
        );
      };

      unsubEntities = onSnapshot(collection(db, "entities"), (snap) => {
        const rawList: any[] = [];
        snap.docs.forEach((d) => {
          const data = d.data();
          rawList.push({ id: d.id, ...data });
          const name = data.tradeName || data.legalName || data.entityName || "RK Travels";
          entMap.set(d.id, name);
        });
        setRawEntities(rawList);
        syncEnts();
      });

      unsubTravels = onSnapshot(collection(db, "travels"), (snap) => {
        snap.docs.forEach((d) => {
          if (!entMap.has(d.id)) {
            const data = d.data();
            entMap.set(d.id, data.travelName || data.name || "RK Travels");
          }
        });
        syncEnts();
      });
    } catch (err) {
      console.warn("Entities listener notice:", err);
    }
    return () => {
      if (unsubEntities) unsubEntities();
      if (unsubTravels) unsubTravels();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 2. Subscribe to Companies (Customers)
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubComps: (() => void) | null = null;
    try {
      const q = query(collection(db, "companies"), orderBy("createdAt", "desc"));
      unsubComps = onSnapshot(
        q,
        (snap) => {
          const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRawCompanies(rawList);
          const list = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.companyName || data.legalName || data.tradeName || "Unnamed Company",
              contactPerson: data.officeContactName || data.contactPerson || "",
              mobile: data.officeContactPhone || data.mobile || "",
            };
          });
          setCompanies(list);
        },
        (err) => {
          console.warn("Companies fallback:", err);
          getDocs(collection(db, "companies")).then((snap) => {
            const rawList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRawCompanies(rawList);
            const list = snap.docs.map((d) => ({
              id: d.id,
              name: d.data().companyName || d.data().legalName || "Unnamed Company",
              contactPerson: d.data().officeContactName || "",
              mobile: d.data().officeContactPhone || "",
            }));
            setCompanies(list);
          });
        }
      );
    } catch (err) {
      console.warn("Companies error:", err);
    }
    return () => {
      if (unsubComps) unsubComps();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 3. Subscribe to Tariffs
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubTariffs: (() => void) | null = null;
    try {
      const q = query(collection(db, "tariffs"), orderBy("createdAt", "desc"));
      unsubTariffs = onSnapshot(q, (snap) => {
        setTariffs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (err) {
      console.warn("Tariffs notice:", err);
    }
    return () => {
      if (unsubTariffs) unsubTariffs();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 3B. Subscribe to Individual Customers & Customer Tariffs
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubCustomers: (() => void) | null = null;
    let unsubCustTariffs: (() => void) | null = null;
    try {
      unsubCustomers = onSnapshot(collection(db, "customers"), (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || data.customerName || "Customer",
            mobile: data.mobile || data.phone || "",
            email: data.email || "",
          };
        });
        setIndividualCustomers(list);
      });

      unsubCustTariffs = onSnapshot(collection(db, "customer_tariffs"), (snap) => {
        setCustomerTariffs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (err) {
      console.warn("Customer data listeners notice:", err);
    }
    return () => {
      if (unsubCustomers) unsubCustomers();
      if (unsubCustTariffs) unsubCustTariffs();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 4. Subscribe to Vehicles
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubVehicles: (() => void) | null = null;
    try {
      const q = query(collection(db, "vehicles"), orderBy("createdAt", "desc"));
      unsubVehicles = onSnapshot(q, (snap) => {
        setVehicles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (err) {
      console.warn("Vehicles notice:", err);
    }
    return () => {
      if (unsubVehicles) unsubVehicles();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 5. Subscribe to Drivers
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubDrivers: (() => void) | null = null;
    try {
      const q = query(collection(db, "drivers"), orderBy("createdAt", "desc"));
      unsubDrivers = onSnapshot(q, (snap) => {
        setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    } catch (err) {
      console.warn("Drivers notice:", err);
    }
    return () => {
      if (unsubDrivers) unsubDrivers();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 6. Subscribe to Bookings
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubBookings: (() => void) | null = null;
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      unsubBookings = onSnapshot(
        q,
        (snap) => {
          const list: BookingRecord[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BookingRecord, "id">),
          }));
          setBookings(list);
          setLoading(false);
        },
        (err) => {
          console.warn("Bookings listener fallback:", err);
          getDocs(collection(db, "bookings")).then((snap) => {
            const list: BookingRecord[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<BookingRecord, "id">),
            }));
            setBookings(list);
            setLoading(false);
          });
        }
      );
    } catch (err) {
      console.warn("Bookings notice:", err);
      setLoading(false);
    }
    return () => {
      if (unsubBookings) unsubBookings();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 7. Subscribe to Locations
  // -------------------------------------------------------------------------
  useEffect(() => {
    let unsubLocations: (() => void) | null = null;
    try {
      const q = query(collection(db, "locations"), orderBy("name", "asc"));
      unsubLocations = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || data.cityName || "",
              state: data.state || data.stateName || "",
              stateCode: data.stateCode || "",
              isActive: data.isActive !== false,
            };
          });
          setDbLocations(list);
        },
        () => {
          getDocs(collection(db, "locations"))
            .then((snap) => {
              const list = snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  name: data.name || data.cityName || "",
                  state: data.state || data.stateName || "",
                  stateCode: data.stateCode || "",
                  isActive: data.isActive !== false,
                };
              });
              setDbLocations(list);
            })
            .catch((err) => console.warn("Locations fallback notice:", err));
        }
      );
    } catch (err) {
      console.warn("Locations query error:", err);
    }
    return () => {
      if (unsubLocations) unsubLocations();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Location Options for Dropdowns (From & To)
  // -------------------------------------------------------------------------
  const locationOptions = useMemo<SearchableSelectOption[]>(() => {
    const map = new Map<string, SearchableSelectOption>();

    // 1. All-India standard state cities from master data
    ALL_INDIA_STATES_DATA.forEach((st) => {
      st.cities.forEach((cityName) => {
        const key = cityName.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            value: cityName,
            label: cityName,
            subLabel: st.name,
            badge: st.code,
            badgeColor: st.code === "TS" || st.code === "AP" ? "amber" : "slate",
          });
        }
      });
    });

    // 2. Hub locations & popular local destinations (airports, stations, key hubs)
    const hubs = [
      { name: "RGIA Shamshabad Airport", sub: "Hyderabad, Telangana", code: "Airport" },
      { name: "Secunderabad Railway Station", sub: "Hyderabad, Telangana", code: "Station" },
      { name: "Hyderabad Deccan Nampally Station", sub: "Hyderabad, Telangana", code: "Station" },
      { name: "Kacheguda Railway Station", sub: "Hyderabad, Telangana", code: "Station" },
      { name: "Gachibowli Financial District", sub: "Hyderabad, Telangana", code: "IT Hub" },
      { name: "Hitec City / Madhapur", sub: "Hyderabad, Telangana", code: "IT Hub" },
      { name: "Banjara Hills", sub: "Hyderabad, Telangana", code: "City" },
      { name: "Jubilee Hills", sub: "Hyderabad, Telangana", code: "City" },
      { name: "Begumpet Airport", sub: "Hyderabad, Telangana", code: "Airport" },
      { name: "Miyapur Metro Station", sub: "Hyderabad, Telangana", code: "Metro" },
      { name: "LB Nagar Cross Roads", sub: "Hyderabad, Telangana", code: "Junction" },
    ];
    hubs.forEach((hub) => {
      map.set(hub.name.toLowerCase().trim(), {
        value: hub.name,
        label: hub.name,
        subLabel: hub.sub,
        badge: hub.code,
        badgeColor: "blue",
      });
    });

    // 3. User master locations from database
    dbLocations.forEach((loc) => {
      if (loc.name && loc.isActive !== false) {
        const key = loc.name.toLowerCase().trim();
        map.set(key, {
          value: loc.name,
          label: loc.name,
          subLabel: loc.state || undefined,
          badge: loc.stateCode || undefined,
          badgeColor: "green",
        });
      }
    });

    // 4. Preserve currently entered values if custom
    if (fromLocation && !map.has(fromLocation.toLowerCase().trim())) {
      map.set(fromLocation.toLowerCase().trim(), {
        value: fromLocation,
        label: fromLocation,
        subLabel: "Custom Location",
      });
    }
    if (toLocation && !map.has(toLocation.toLowerCase().trim())) {
      map.set(toLocation.toLowerCase().trim(), {
        value: toLocation,
        label: toLocation,
        subLabel: "Custom Location",
      });
    }

    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }, [dbLocations, fromLocation, toLocation]);

  // -------------------------------------------------------------------------
  // Auto-fill First Entity if None Selected
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedEntityId && entities.length > 0) {
      setSelectedEntityId(entities[0].id);
      setSelectedEntityName(entities[0].name);
    }
  }, [entities, selectedEntityId]);

  // -------------------------------------------------------------------------
  // Find Active Tariff for Selected Company or Individual Customer
  // -------------------------------------------------------------------------
  const activeCompanyTariff = useMemo(() => {
    if (!selectedCustomerName) return null;

    if (clientType === "Individual Customer") {
      // Common default customer tariff for ALL individual customers!
      const defaultCust =
        customerTariffs.find(
          (t) =>
            t.id === "default_customer_tariff" ||
            t.isDefault === true ||
            t.customerName?.toLowerCase().includes("default") ||
            t.tariffName?.toLowerCase().includes("default")
        ) ||
        customerTariffs.find((t) => t.status === "Active") ||
        customerTariffs[0];
      if (defaultCust) return defaultCust;

      // Fallback to standard tariff if customer tariffs collection not yet seeded
      const stdFallback = tariffs.find(
        (t) => t.customerName?.toLowerCase().includes("standard") && t.status === "Active"
      );
      return stdFallback || tariffs[0] || null;
    }

    // 1. Look for specific company tariff
    const matched = tariffs.find(
      (t) =>
        t.customerName?.toLowerCase() === selectedCustomerName.toLowerCase() &&
        t.status === "Active"
    );
    if (matched) return matched;

    // 2. Fallback to "Standard" active tariff
    const standard = tariffs.find(
      (t) =>
        t.customerName?.toLowerCase() === "standard" && t.status === "Active"
    );
    return standard || null;
  }, [selectedCustomerName, clientType, tariffs, customerTariffs]);

  // Vehicle Categories enabled in that Tariff
  const availableTariffCategories = useMemo(() => {
    if (!activeCompanyTariff) return [];
    if (Array.isArray(activeCompanyTariff.selectedCategories)) {
      return activeCompanyTariff.selectedCategories;
    }
    return [];
  }, [activeCompanyTariff]);

  // When Company changes, select first available vehicle category
  useEffect(() => {
    if (availableTariffCategories.length > 0) {
      if (
        !selectedVehicleCategory ||
        !availableTariffCategories.includes(selectedVehicleCategory)
      ) {
        setSelectedVehicleCategory(availableTariffCategories[0]);
      }
    } else {
      setSelectedVehicleCategory("");
    }
  }, [availableTariffCategories, selectedVehicleCategory]);

  // Available Tariff Types (Duty Types) enabled for this customer
  const availableTariffTypes = useMemo(() => {
    if (!activeCompanyTariff) return [];
    const types: ("Local" | "Pickup & Drop" | "Day Rent" | "Outstation")[] = [];

    if (activeCompanyTariff.localDuty?.enabled) types.push("Local");
    if (
      activeCompanyTariff.pickupDropDuty?.offerAirport ||
      activeCompanyTariff.pickupDropDuty?.offerRailway
    ) {
      types.push("Pickup & Drop");
    }
    if (activeCompanyTariff.dayRentDuty?.enabled) types.push("Day Rent");
    if (activeCompanyTariff.outstationDuty?.enabled) types.push("Outstation");

    return types;
  }, [activeCompanyTariff]);

  // When availableTariffTypes change, reset selectedTariffType if needed
  useEffect(() => {
    if (availableTariffTypes.length > 0) {
      if (!availableTariffTypes.includes(selectedTariffType)) {
        setSelectedTariffType(availableTariffTypes[0]);
      }
    }
  }, [availableTariffTypes, selectedTariffType]);

  // Packages list based on selectedTariffType
  const availablePackages = useMemo(() => {
    if (!activeCompanyTariff) return [];

    if (selectedTariffType === "Local") {
      const pkgs = activeCompanyTariff.localDuty?.packages || [];
      return pkgs.map((p: any) => ({
        id: p.id,
        name: p.packageName,
        rates: p.rates || {},
      }));
    }

    if (selectedTariffType === "Pickup & Drop") {
      const res: { id: string; name: string; rates: any }[] = [];
      if (activeCompanyTariff.pickupDropDuty?.offerAirport) {
        res.push({
          id: "airport-transfer",
          name: "Airport Transfer",
          rates: activeCompanyTariff.pickupDropDuty.airportRates || {},
        });
      }
      if (activeCompanyTariff.pickupDropDuty?.offerRailway) {
        res.push({
          id: "railway-transfer",
          name: "Railway Transfer",
          rates: activeCompanyTariff.pickupDropDuty.railwayRates || {},
        });
      }
      return res;
    }

    if (selectedTariffType === "Day Rent") {
      return [
        {
          id: "day-rent-12hrs",
          name: "12 Hours Day Rent",
          rates: activeCompanyTariff.dayRentDuty?.rates || {},
        },
        {
          id: "day-rent-24hrs",
          name: "24 Hours Day Rent",
          rates: activeCompanyTariff.dayRentDuty?.rates || {},
        },
      ];
    }

    if (selectedTariffType === "Outstation") {
      return [
        {
          id: "outstation-trip",
          name: "Outstation Trip",
          rates: activeCompanyTariff.outstationDuty?.rates || {},
        },
      ];
    }

    return [];
  }, [activeCompanyTariff, selectedTariffType]);

  // Automatically select first package when availablePackages change
  useEffect(() => {
    if (availablePackages.length > 0) {
      if (
        !selectedPackageId ||
        !availablePackages.some((p: any) => p.id === selectedPackageId)
      ) {
        setSelectedPackageId(availablePackages[0].id);
        setSelectedPackageName(availablePackages[0].name);
      }
    } else {
      setSelectedPackageId("");
      setSelectedPackageName("");
    }
  }, [availablePackages, selectedPackageId]);

  // -------------------------------------------------------------------------
  // Duration Calculation: Days, Hours, Minutes
  // -------------------------------------------------------------------------
  const calculatedDuration = useMemo(() => {
    if (!startDate || !startTime || !endDate || !endTime) {
      return { totalDays: 0, totalHours: 0, totalMinutes: 0, text: "0 Mins" };
    }
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    const totalMinutes = Math.floor(diffMs / (1000 * 60));

    const totalDays = Math.floor(totalMinutes / (24 * 60));
    const totalHours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    const parts: string[] = [];
    if (totalDays > 0) parts.push(`${totalDays} Day${totalDays > 1 ? "s" : ""}`);
    if (totalHours > 0) parts.push(`${totalHours} Hr${totalHours > 1 ? "s" : ""}`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins} Min${mins > 1 ? "s" : ""}`);

    return {
      totalDays,
      totalHours,
      totalMinutes,
      text: parts.join(", "),
    };
  }, [startDate, startTime, endDate, endTime]);

  // -------------------------------------------------------------------------
  // Total KM Calculation
  // -------------------------------------------------------------------------
  const startKmNum = Math.max(0, Number(startingKm) || 0);
  const endKmNum = Math.max(0, Number(endingKm) || 0);
  const calculatedTotalKm = useMemo(() => {
    if (endKmNum > 0 && endKmNum >= startKmNum) {
      return endKmNum - startKmNum;
    }
    return 0;
  }, [startKmNum, endKmNum]);

  // -------------------------------------------------------------------------
  // Vehicle & Driver Overlap / Occupancy Check
  // -------------------------------------------------------------------------
  const isTimeOverlapping = (
    bookingStart: string,
    bookingEnd: string,
    newStart: string,
    newEnd: string
  ) => {
    const bStart = new Date(bookingStart).getTime();
    const bEnd = new Date(bookingEnd).getTime();
    const nStart = new Date(newStart).getTime();
    const nEnd = new Date(newEnd).getTime();
    return nStart < bEnd && nEnd > bStart;
  };

  const newTripStartIso = `${startDate}T${startTime || "00:00"}:00`;
  const newTripEndIso = endDate
    ? `${endDate}T${endTime || "23:59"}:00`
    : newTripStartIso;

  // Occupied Vehicles & Drivers for this window
  const occupiedVehicleIds = useMemo(() => {
    const set = new Set<string>();
    if (!startDate || !endDate) return set;
    bookings.forEach((b) => {
      if (b.bookingStatus === "Trip Completed") return;
      if (b.vehicleId && b.startDate && b.endDate) {
        const bStart = `${b.startDate}T${b.startTime || "00:00"}:00`;
        const bEnd = `${b.endDate}T${b.endTime || "23:59"}:00`;
        if (isTimeOverlapping(bStart, bEnd, newTripStartIso, newTripEndIso)) {
          set.add(b.vehicleId);
        }
      }
    });
    return set;
  }, [bookings, newTripStartIso, newTripEndIso, startDate, endDate]);

  const occupiedDriverIds = useMemo(() => {
    const set = new Set<string>();
    if (!startDate || !endDate) return set;
    bookings.forEach((b) => {
      if (b.bookingStatus === "Trip Completed") return;
      if (b.driverId && b.startDate && b.endDate) {
        const bStart = `${b.startDate}T${b.startTime || "00:00"}:00`;
        const bEnd = `${b.endDate}T${b.endTime || "23:59"}:00`;
        if (isTimeOverlapping(bStart, bEnd, newTripStartIso, newTripEndIso)) {
          set.add(b.driverId);
        }
      }
    });
    return set;
  }, [bookings, newTripStartIso, newTripEndIso, startDate, endDate]);

  // Available vehicles in the selected vehicle category
  const filteredVehicles = useMemo(() => {
    if (!selectedVehicleCategory) return [];
    const catLower = selectedVehicleCategory.toLowerCase();
    return vehicles.filter((v) => {
      const vCat = String(v.category || "").toLowerCase();
      // Match category name ignoring whitespace & (A/C) suffix differences
      const match =
        catLower.includes(vCat) ||
        vCat.includes(catLower) ||
        vCat.replace(/\s+/g, "").includes(catLower.replace(/\s+/g, ""));
      return match;
    });
  }, [vehicles, selectedVehicleCategory]);

  // -------------------------------------------------------------------------
  // Pricing Calculation from Tariff
  // -------------------------------------------------------------------------
  const pricingBreakdown = useMemo(() => {
    let baseFare = 0;
    let includedHours = 0;
    let includedKm = 0;
    let extraKmRate = 0;
    let extraHoursRate = 0;
    let driverBataCost = 0;
    let nightHaltCost = 0;

    const cat = selectedVehicleCategory;

    if (activeCompanyTariff && cat) {
      if (selectedTariffType === "Local") {
        const pkg = activeCompanyTariff.localDuty?.packages?.find(
          (p: any) => p.id === selectedPackageId
        );
        if (pkg?.rates?.[cat]) {
          baseFare = Number(pkg.rates[cat].baseFare) || 0;
          driverBataCost = Number(pkg.rates[cat].driverBata) || 0;
        }
        // Parse included hours and km from package title (e.g. "4 HOURS 40 KM")
        if (selectedPackageName) {
          const hrMatch = selectedPackageName.match(/(\d+)\s*H/i);
          const kmMatch = selectedPackageName.match(/(\d+)\s*K/i);
          if (hrMatch) includedHours = parseInt(hrMatch[1], 10);
          if (kmMatch) includedKm = parseInt(kmMatch[1], 10);
        }
        extraKmRate =
          Number(activeCompanyTariff.localDuty?.extraRates?.extraPerKm?.[cat]) || 0;
        extraHoursRate =
          Number(activeCompanyTariff.localDuty?.extraRates?.extraPerHour?.[cat]) || 0;
      } else if (selectedTariffType === "Pickup & Drop") {
        const rateBlock =
          selectedPackageId === "airport-transfer"
            ? activeCompanyTariff.pickupDropDuty?.airportRates
            : activeCompanyTariff.pickupDropDuty?.railwayRates;
        if (rateBlock) {
          baseFare = Number(rateBlock.fare?.[cat]) || 0;
          includedHours = Number(rateBlock.includedHours?.[cat]) || 2;
          includedKm = Number(rateBlock.includedKm?.[cat]) || 30;
          extraKmRate = Number(rateBlock.extraPerKm?.[cat]) || 0;
          extraHoursRate = Number(rateBlock.waitingPerHour?.[cat]) || 0;
        }
      } else if (selectedTariffType === "Day Rent") {
        const drRates = activeCompanyTariff.dayRentDuty?.rates;
        if (drRates) {
          baseFare =
            selectedPackageId === "day-rent-24hrs"
              ? Number(drRates.dayRent24Hrs?.[cat]) || 0
              : Number(drRates.dayRent12Hrs?.[cat]) || 0;
          driverBataCost =
            selectedPackageId === "day-rent-24hrs"
              ? Number(drRates.driverBata24Hrs?.[cat]) || 0
              : Number(drRates.driverBata12Hrs?.[cat]) || 0;
          nightHaltCost = Number(drRates.nightHaltPerNight?.[cat]) || 0;
        }
      } else if (selectedTariffType === "Outstation") {
        const osRates = activeCompanyTariff.outstationDuty?.rates;
        if (osRates) {
          const slabKm = Number(osRates.baseKmSlab?.[cat]) || 300;
          const perKm = Number(osRates.perKmCharge?.[cat]) || 0;
          baseFare = slabKm * perKm;
          includedKm = slabKm;
          extraKmRate = perKm;
          driverBataCost = Number(osRates.driverBataPerDay?.[cat]) || 0;
          nightHaltCost = Number(osRates.nightHaltPerNight?.[cat]) || 0;
        }
      }
    }

    // Extra KM
    const extraKm = Math.max(0, calculatedTotalKm - includedKm);
    const extraKmCost = extraKm * extraKmRate;

    // Extra Hours
    const actualHours = calculatedDuration.totalDays * 24 + calculatedDuration.totalHours;
    const extraHours = Math.max(0, actualHours - includedHours);
    const extraHoursCost = extraHours * extraHoursRate;

    // Pass-through Charges (Matching user's Image)
    const tollVal = Math.max(0, Number(tolls) || 0);
    const parkVal = Math.max(0, Number(parking) || 0);
    const statePermitVal = Math.max(0, Number(statePermit) || 0);
    const mealsVal = Math.max(0, Number(meals) || 0);
    const interstateTaxVal = Math.max(0, Number(interstateEntryTax) || 0);
    const nightHaltVal = Math.max(0, Number(nightHalt) || 0);
    const totalPassThrough =
      tollVal + parkVal + statePermitVal + mealsVal + interstateTaxVal + nightHaltVal;

    // Fuel Charges policy calculation
    let dutyFuelConfig: any = null;
    if (activeCompanyTariff) {
      if (selectedTariffType === "Local") {
        dutyFuelConfig = activeCompanyTariff.localDuty?.fuelConfig;
      } else if (selectedTariffType === "Pickup & Drop") {
        dutyFuelConfig = activeCompanyTariff.pickupDropDuty?.fuelConfig;
      } else if (selectedTariffType === "Day Rent") {
        dutyFuelConfig = activeCompanyTariff.dayRentDuty?.fuelConfig;
      } else if (selectedTariffType === "Outstation") {
        dutyFuelConfig = activeCompanyTariff.outstationDuty?.fuelConfig;
      }
    }

    const isFuelExclusive = dutyFuelConfig?.fuelType === "Exclusive";
    const fuelRatePerKm = isFuelExclusive ? Number(dutyFuelConfig?.fuelRatePerKm) || 0 : 0;
    const fuelChargesCost = isFuelExclusive ? calculatedTotalKm * fuelRatePerKm : 0;
    const showFuelInInvoice = isFuelExclusive && !!dutyFuelConfig?.showFuelInInvoice;

    // Customer Advance & Discount
    const advanceVal = Math.max(0, Number(customerAdvance) || 0);
    const discountVal = Math.max(0, Number(discount) || 0);

    const grossAmount =
      baseFare +
      extraKmCost +
      extraHoursCost +
      driverBataCost +
      nightHaltCost +
      fuelChargesCost +
      totalPassThrough;

    const netBilled = Math.max(0, grossAmount - discountVal);
    const netAmount = Math.max(0, netBilled - advanceVal);

    return {
      baseFare,
      includedHours,
      includedKm,
      extraKmRate,
      extraKm,
      extraKmCost,
      extraHoursRate,
      extraHours,
      extraHoursCost,
      driverBataCost,
      nightHaltCost,
      fuelChargesCost,
      fuelRatePerKm,
      showFuelInInvoice,
      totalPassThrough,
      grossAmount,
      discount: discountVal,
      customerAdvance: advanceVal,
      netAmount,
    };
  }, [
    activeCompanyTariff,
    selectedVehicleCategory,
    selectedTariffType,
    selectedPackageId,
    selectedPackageName,
    calculatedTotalKm,
    calculatedDuration,
    tolls,
    parking,
    statePermit,
    meals,
    interstateEntryTax,
    nightHalt,
    customerAdvance,
    discount,
  ]);

  // Derived Payment Status
  const autoPaymentStatus: PaymentStatus = useMemo(() => {
    if (overridePaymentStatus) return overridePaymentStatus;
    const advance = pricingBreakdown.customerAdvance;
    const billedTotal = Math.max(0, pricingBreakdown.grossAmount - (pricingBreakdown.discount || 0));
    if (billedTotal === 0 && advance === 0) return "Unpaid";
    if (advance === 0) return "Unpaid";
    if (advance >= billedTotal && billedTotal > 0) return "Paid";
    return "Partial";
  }, [overridePaymentStatus, pricingBreakdown.customerAdvance, pricingBreakdown.grossAmount, pricingBreakdown.discount]);

  // -------------------------------------------------------------------------
  // Handle Open Add Booking OffCanvas
  // -------------------------------------------------------------------------
  const handleOpenAddBooking = () => {
    setEditingBookingId(null);
    setActiveTab("details");
    const today = new Date().toISOString().split("T")[0];
    setStartDate(today);
    setStartTime("09:00");
    setEndDate("");
    setEndTime("");
    setFromLocation("");
    setToLocation("");
    setClientType("Company");
    if (companies.length > 0) {
      setSelectedCustomerId(companies[0].id);
      setSelectedCustomerName(companies[0].name);
      setTravelerName(companies[0].contactPerson || "");
      setTravelerMobile(companies[0].mobile || "");
    } else {
      setSelectedCustomerId("");
      setSelectedCustomerName("");
      setTravelerName("");
      setTravelerMobile("");
    }
    setSelectedVehicleId("");
    setSelectedVehicleReg("");
    setSelectedVehicleName("");
    setSelectedDriverId("");
    setSelectedDriverName("");
    setSelectedDriverMobile("");
    setStartingKm("");
    setEndingKm("");
    setTravelledPlaces([]);
    setNotes("");
    setTolls("");
    setParking("");
    setStatePermit("");
    setMeals("");
    setInterstateEntryTax("");
    setNightHalt("");
    setCustomerAdvance("");
    setDiscount("");
    setBookingStatus("New");
    setOverridePaymentStatus(null);
    setIsOffCanvasOpen(true);
  };

  // -------------------------------------------------------------------------
  // Handle Open Edit Booking OffCanvas
  // -------------------------------------------------------------------------
  const handleOpenEditBooking = (booking: BookingRecord) => {
    setEditingBookingId(booking.id);
    setActiveTab("details");
    setStartDate(booking.startDate || "");
    setStartTime(booking.startTime || "09:00");
    setEndDate(booking.endDate || "");
    setEndTime(booking.endTime || "18:00");
    setFromLocation(booking.fromLocation || "");
    setToLocation(booking.toLocation || "");
    setClientType(booking.clientType || booking.customerType || "Company");
    setSelectedEntityId(booking.entityId || "");
    setSelectedEntityName(booking.entityName || "");
    setSelectedCustomerId(booking.customerId || "");
    setSelectedCustomerName(booking.customerName || "");
    setTravelerName(booking.travelerName || "");
    setTravelerMobile(booking.travelerMobile || "");
    setSelectedVehicleCategory(booking.vehicleCategory || "Sedan");
    setSelectedTariffType(booking.tariffType || "Local");
    setSelectedPackageId(booking.tariffPackageId || "");
    setSelectedPackageName(booking.tariffPackageName || "");
    setSelectedVehicleId(booking.vehicleId || "");
    setSelectedVehicleReg(booking.vehicleRegNumber || "");
    setSelectedVehicleName(booking.vehicleName || "");
    setSelectedDriverId(booking.driverId || "");
    setSelectedDriverName(booking.driverName || "");
    setSelectedDriverMobile(booking.driverMobile || "");
    setStartingKm(booking.startingKm !== undefined ? String(booking.startingKm) : "");
    setEndingKm(booking.endingKm !== undefined ? String(booking.endingKm) : "");
    setTravelledPlaces(booking.travelledPlaces || []);
    setNotes(booking.notes || "");
    setTolls(booking.tolls ? String(booking.tolls) : "");
    setParking(booking.parking ? String(booking.parking) : "");
    setStatePermit(booking.statePermit ? String(booking.statePermit) : "");
    setMeals(booking.meals ? String(booking.meals) : "");
    setInterstateEntryTax(booking.interstateEntryTax ? String(booking.interstateEntryTax) : "");
    setNightHalt(booking.nightHalt ? String(booking.nightHalt) : "");
    setCustomerAdvance(booking.customerAdvance ? String(booking.customerAdvance) : "");
    setDiscount(booking.discount ? String(booking.discount) : "");
    setBookingStatus(booking.bookingStatus || "New");
    setOverridePaymentStatus(booking.paymentStatus || null);
    setIsOffCanvasOpen(true);
  };

  // -------------------------------------------------------------------------
  // Delete Booking
  // -------------------------------------------------------------------------
  const handleDeleteBooking = async (booking: BookingRecord) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete booking ${booking.bookingNumber}? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "bookings", booking.id));
      setFeedback({
        type: "success",
        message: `Booking ${booking.bookingNumber} deleted successfully.`,
      });
      if (viewingBooking?.id === booking.id) {
        setViewingBooking(null);
      }
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error("Error deleting booking:", err);
      alert("Failed to delete booking: " + (err.message || "Unknown error"));
    }
  };

  // -------------------------------------------------------------------------
  // Step 1 Validation Helper
  // -------------------------------------------------------------------------
  const validateStep1Details = (): boolean => {
    if (!startDate) {
      setActiveTab("details");
      alert("Please select start date.");
      return false;
    }
    if (!startTime) {
      setActiveTab("details");
      alert("Please select start time.");
      return false;
    }
    if (!fromLocation.trim()) {
      setActiveTab("details");
      alert("Please enter From (pickup) location.");
      return false;
    }
    if (!selectedEntityId) {
      setActiveTab("details");
      alert("Please select an operating entity.");
      return false;
    }
    if (!clientType) {
      setActiveTab("details");
      alert("Please select a client type.");
      return false;
    }
    if (!selectedCustomerName) {
      setActiveTab("details");
      alert(`Please select a ${clientType === "Individual Customer" ? "individual customer" : "company"}.`);
      return false;
    }
    if (!selectedVehicleCategory) {
      setActiveTab("details");
      alert("Please select a vehicle category.");
      return false;
    }
    if (!travelerName.trim()) {
      setActiveTab("details");
      alert("Please enter passenger / traveler name.");
      return false;
    }
    return true;
  };

  // -------------------------------------------------------------------------
  // Save Booking Submission
  // -------------------------------------------------------------------------
  const handleSaveBookingSubmit = async () => {
    // Step 1: Mandatory core details validation
    if (!validateStep1Details()) {
      return;
    }

    // Step 2: Validate odometer only if both starting and ending KM are provided
    if (startingKm && endingKm) {
      const sKm = Number(startingKm);
      const eKm = Number(endingKm);
      if (!isNaN(sKm) && !isNaN(eKm) && eKm < sKm) {
        setActiveTab("assignment");
        alert("Ending KM cannot be less than Starting KM.");
        return;
      }
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const now = new Date();
      const bookingNumber = `BK-${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const initialPaymentHistory: PaymentHistoryItem[] = [];
      const advanceNum = pricingBreakdown.customerAdvance;

      // Handle UPDATE EXISTING BOOKING
      if (editingBookingId) {
        const updatePayload: Record<string, any> = {
          clientType,
          customerType: clientType,
          startDate,
          startTime,
          endDate: endDate || "",
          endTime: endTime || "",
          fromLocation: fromLocation.trim(),
          toLocation: toLocation.trim(),
          entityId: selectedEntityId,
          entityName: selectedEntityName,
          customerId: selectedCustomerId,
          customerName: selectedCustomerName,
          vehicleCategory: selectedVehicleCategory,
          tariffType: selectedTariffType,
          tariffPackageId: selectedPackageId || "",
          tariffPackageName: selectedPackageName || "",
          travelerName: (travelerName || selectedCustomerName || "").trim(),
          travelerMobile: (travelerMobile || "").trim(),

          durationText: calculatedDuration.text,
          totalDays: calculatedDuration.totalDays,
          totalHours: calculatedDuration.totalHours,
          totalMinutes: calculatedDuration.totalMinutes,

          vehicleId: selectedVehicleId || "",
          vehicleRegNumber: selectedVehicleReg || "",
          vehicleName: selectedVehicleName || "",
          driverId: selectedDriverId || "",
          driverName: selectedDriverName || "",
          driverMobile: selectedDriverMobile || "",
          driverStatus: selectedDriverId ? "Occupied for Trip" : "",
          startingKm: startKmNum,
          endingKm: endKmNum,
          totalKm: calculatedTotalKm,
          travelledPlaces,
          notes: notes.trim(),

          tolls: Math.max(0, Number(tolls) || 0),
          parking: Math.max(0, Number(parking) || 0),
          statePermit: Math.max(0, Number(statePermit) || 0),
          meals: Math.max(0, Number(meals) || 0),
          interstateEntryTax: Math.max(0, Number(interstateEntryTax) || 0),
          nightHalt: Math.max(0, Number(nightHalt) || 0),
          totalPassThrough: pricingBreakdown.totalPassThrough,
          customerAdvance: advanceNum,
          discount: pricingBreakdown.discount,

          baseFare: pricingBreakdown.baseFare,
          extraKmRate: pricingBreakdown.extraKmRate,
          extraKmCost: pricingBreakdown.extraKmCost,
          extraHoursRate: pricingBreakdown.extraHoursRate,
          extraHoursCost: pricingBreakdown.extraHoursCost,
          driverBataCost: pricingBreakdown.driverBataCost,
          nightHaltCost: pricingBreakdown.nightHaltCost,
          fuelChargesCost: pricingBreakdown.fuelChargesCost,
          fuelRatePerKm: pricingBreakdown.fuelRatePerKm,
          showFuelInInvoice: pricingBreakdown.showFuelInInvoice,
          grossAmount: pricingBreakdown.grossAmount,
          netAmount: pricingBreakdown.netAmount,
          receivedAmount: advanceNum,
          balanceAmount: pricingBreakdown.netAmount,

          bookingStatus: bookingStatus,
          paymentStatus: autoPaymentStatus,
          updatedAt: serverTimestamp(),
        };

        const cleanedUpdatePayload: Record<string, any> = {};
        for (const [key, val] of Object.entries(updatePayload)) {
          if (val !== undefined) {
            cleanedUpdatePayload[key] = val;
          }
        }

        await updateDoc(doc(db, "bookings", editingBookingId), cleanedUpdatePayload);

        setFeedback({
          type: "success",
          message: "Booking updated successfully!",
        });
        setIsOffCanvasOpen(false);
        setEditingBookingId(null);
        setTimeout(() => setFeedback(null), 4000);
        return;
      }
      if (advanceNum > 0) {
        initialPaymentHistory.push({
          id: `pay-${Date.now()}`,
          date: startDate,
          time: startTime,
          amount: advanceNum,
          paymentMode: "Advance",
          referenceNumber: "Customer Advance on Booking",
          notes: "Collected at time of booking creation",
          recordedAt: new Date().toISOString(),
        });
      }

      const bookingPayload: Record<string, any> = {
        bookingNumber,
        clientType,
        customerType: clientType,
        startDate,
        startTime,
        endDate: endDate || "",
        endTime: endTime || "",
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        entityId: selectedEntityId,
        entityName: selectedEntityName,
        customerId: selectedCustomerId,
        customerName: selectedCustomerName,
        vehicleCategory: selectedVehicleCategory,
        tariffType: selectedTariffType,
        tariffPackageId: selectedPackageId || "",
        tariffPackageName: selectedPackageName || "",
        travelerName: (travelerName || selectedCustomerName || "").trim(),
        travelerMobile: (travelerMobile || "").trim(),

        durationText: calculatedDuration.text,
        totalDays: calculatedDuration.totalDays,
        totalHours: calculatedDuration.totalHours,
        totalMinutes: calculatedDuration.totalMinutes,
        vehicleId: selectedVehicleId || "",
        vehicleRegNumber: selectedVehicleReg || "",
        vehicleName: selectedVehicleName || "",
        driverId: selectedDriverId || "",
        driverName: selectedDriverName || "",
        driverMobile: selectedDriverMobile || "",
        driverStatus: selectedDriverId ? "Occupied for Trip" : "",
        startingKm: startKmNum,
        endingKm: endKmNum,
        totalKm: calculatedTotalKm,
        travelledPlaces,
        notes: notes.trim(),

        tolls: Math.max(0, Number(tolls) || 0),
        parking: Math.max(0, Number(parking) || 0),
        statePermit: Math.max(0, Number(statePermit) || 0),
        meals: Math.max(0, Number(meals) || 0),
        interstateEntryTax: Math.max(0, Number(interstateEntryTax) || 0),
        nightHalt: Math.max(0, Number(nightHalt) || 0),
        totalPassThrough: pricingBreakdown.totalPassThrough,
        customerAdvance: advanceNum,
        discount: pricingBreakdown.discount,

        baseFare: pricingBreakdown.baseFare,
        extraKmRate: pricingBreakdown.extraKmRate,
        extraKmCost: pricingBreakdown.extraKmCost,
        extraHoursRate: pricingBreakdown.extraHoursRate,
        extraHoursCost: pricingBreakdown.extraHoursCost,
        driverBataCost: pricingBreakdown.driverBataCost,
        nightHaltCost: pricingBreakdown.nightHaltCost,
        fuelChargesCost: pricingBreakdown.fuelChargesCost,
        fuelRatePerKm: pricingBreakdown.fuelRatePerKm,
        showFuelInInvoice: pricingBreakdown.showFuelInInvoice,
        grossAmount: pricingBreakdown.grossAmount,
        netAmount: pricingBreakdown.netAmount,
        receivedAmount: advanceNum,
        balanceAmount: pricingBreakdown.netAmount,

        bookingStatus: bookingStatus,
        paymentStatus: autoPaymentStatus,
        paymentHistory: initialPaymentHistory,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const cleanedBookingPayload: Record<string, any> = {};
      for (const [key, val] of Object.entries(bookingPayload)) {
        if (val !== undefined) {
          cleanedBookingPayload[key] = val;
        }
      }

      // 1. Add to bookings collection
      const docRef = await addDoc(collection(db, "bookings"), cleanedBookingPayload);

      // 2. If advance > 0, also log in payments collection for ledger
      if (advanceNum > 0) {
        try {
          await addDoc(collection(db, "payments"), {
            bookingId: docRef.id,
            bookingNumber,
            clientType: "customer",
            clientName: selectedCustomerName,
            clientMobile: travelerMobile.trim(),
            companyName: selectedCustomerName,
            fromLocation: fromLocation.trim(),
            toLocation: toLocation.trim(),
            amountCollected: advanceNum,
            amount: advanceNum,
            paymentMode: "cash",
            note: `Advance collected for ${bookingNumber}`,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("Notice: payment record creation:", err);
        }
      }

      setFeedback({
        type: "success",
        message: `Booking ${bookingNumber} created successfully! Vehicle and driver assigned.`,
      });
      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error("Error creating booking:", err);
      setFeedback({
        type: "error",
        message: `Failed to create booking: ${err.message || "Unknown error"}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Generate Tax Invoice with sequential numbering: INV + YYYY + MM + NN
  // -------------------------------------------------------------------------
  const handleGenerateInvoice = async (bookingItem: BookingRecord) => {
    // If invoice is already generated, simply view it
    if (bookingItem.invoiceNumber) {
      setInvoiceBooking(bookingItem);
      return bookingItem.invoiceNumber;
    }

    setIsAllocatingInvoice(true);
    try {
      const nextInvNum = generateNextInvoiceNumber(bookings, new Date());
      const nowIso = new Date().toISOString();

      await updateDoc(doc(db, "bookings", bookingItem.id), {
        invoiceNumber: nextInvNum,
        invoiceDate: nowIso,
        bookingStatus: "Invoice Generated",
        updatedAt: serverTimestamp(),
      });

      const updatedRecord: BookingRecord = {
        ...bookingItem,
        invoiceNumber: nextInvNum,
        invoiceDate: nowIso,
        bookingStatus: "Invoice Generated",
      };

      setInvoiceBooking(updatedRecord);
      if (viewingBooking && viewingBooking.id === bookingItem.id) {
        setViewingBooking(updatedRecord);
      }
      setFeedback({
        type: "success",
        message: `Invoice ${nextInvNum} generated successfully!`,
      });
      setTimeout(() => setFeedback(null), 3500);
      return nextInvNum;
    } catch (err: any) {
      console.error("Error generating tax invoice:", err);
      alert(`Failed to allocate invoice number: ${err?.message || "Unknown error"}`);
    } finally {
      setIsAllocatingInvoice(false);
    }
  };

  // -------------------------------------------------------------------------
  // Quick Status Transition
  // -------------------------------------------------------------------------
  const handleUpdateBookingStatus = async (
    bookingId: string,
    newStatus: BookingStatus
  ) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        bookingStatus: newStatus,
        updatedAt: serverTimestamp(),
      });
      if (viewingBooking && viewingBooking.id === bookingId) {
        setViewingBooking((prev) =>
          prev ? { ...prev, bookingStatus: newStatus } : null
        );
      }
      setFeedback({
        type: "success",
        message: `Booking status updated to ${newStatus}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Record Payment / Collect Amount Submission
  // -------------------------------------------------------------------------
  const handleOpenCollectPayment = (b: BookingRecord) => {
    setCollectingBooking(b);
    setCollectAmount(String(b.balanceAmount || b.netAmount));
    setCollectMode("Cash");
    setCollectRefNumber("");
    setCollectNotes("");
  };

  const handleRecordPaymentSubmit = async () => {
    if (!collectingBooking) return;
    const amountNum = Number(collectAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    if (collectMode === "UPI" && !collectRefNumber.trim()) {
      alert("Please enter the UPI Reference Number (UTR / Ref #).");
      return;
    }

    setIsCollectingPayment(true);
    try {
      const now = new Date();
      const currentReceived = Number(collectingBooking.receivedAmount) || 0;
      const newReceived = currentReceived + amountNum;
      const totalPayable =
        Number(collectingBooking.grossAmount) || Number(collectingBooking.netAmount) || 0;
      const newBalance = Math.max(0, totalPayable - newReceived);

      let newPayStatus: PaymentStatus = "Partial";
      if (newBalance <= 0) newPayStatus = "Paid";
      else if (newReceived <= 0) newPayStatus = "Unpaid";

      const newHistoryItem: PaymentHistoryItem = {
        id: `pay-${Date.now()}`,
        date: now.toISOString().split("T")[0],
        time: `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`,
        amount: amountNum,
        paymentMode: collectMode,
        referenceNumber: collectRefNumber.trim() || undefined,
        notes: collectNotes.trim() || undefined,
        recordedAt: now.toISOString(),
      };

      const updatedHistory = [
        ...(collectingBooking.paymentHistory || []),
        newHistoryItem,
      ];

      // Update Booking
      await updateDoc(doc(db, "bookings", collectingBooking.id), {
        receivedAmount: newReceived,
        balanceAmount: newBalance,
        paymentStatus: newPayStatus,
        paymentHistory: updatedHistory,
        updatedAt: serverTimestamp(),
      });

      // Also log in payments collection
      await addDoc(collection(db, "payments"), {
        bookingId: collectingBooking.id,
        bookingNumber: collectingBooking.bookingNumber,
        clientType: "customer",
        clientName: collectingBooking.customerName,
        clientMobile: collectingBooking.travelerMobile || "",
        companyName: collectingBooking.customerName,
        fromLocation: collectingBooking.fromLocation,
        toLocation: collectingBooking.toLocation,
        amountCollected: amountNum,
        amount: amountNum,
        paymentMode: collectMode.toLowerCase(),
        referenceNumber: collectRefNumber.trim() || null,
        note: collectNotes.trim() || `Collected for ${collectingBooking.bookingNumber}`,
        createdAt: serverTimestamp(),
      });

      setFeedback({
        type: "success",
        message: `Payment of ₹${amountNum.toLocaleString(
          "en-IN"
        )} recorded via ${collectMode}!`,
      });
      setCollectingBooking(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error("Error recording payment:", err);
      alert("Failed to record payment.");
    } finally {
      setIsCollectingPayment(false);
    }
  };

  // -------------------------------------------------------------------------
  // Filtered Bookings Table
  // -------------------------------------------------------------------------
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.bookingNumber?.toLowerCase().includes(q) ||
        b.customerName?.toLowerCase().includes(q) ||
        b.travelerName?.toLowerCase().includes(q) ||
        b.fromLocation?.toLowerCase().includes(q) ||
        b.toLocation?.toLowerCase().includes(q) ||
        b.vehicleRegNumber?.toLowerCase().includes(q) ||
        b.driverName?.toLowerCase().includes(q);

      // Status
      const matchStatus =
        statusFilter === "all" || b.bookingStatus === statusFilter;

      // Payment
      const matchPayment =
        paymentFilter === "all" || b.paymentStatus === paymentFilter;

      // Client Type filter
      const isIndiv =
        b.clientType === "Individual Customer" ||
        b.customerType === "Individual Customer";
      const matchClientType =
        clientTypeFilter === "all" ||
        (clientTypeFilter === "Individual Customer" && isIndiv) ||
        (clientTypeFilter === "Company" && !isIndiv);

      return matchSearch && matchStatus && matchPayment && matchClientType;
    });
  }, [bookings, searchQuery, statusFilter, paymentFilter, clientTypeFilter]);

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-16 font-sans">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-normal">
        <Link href="/" className="hover:text-slate-800 transition">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-[#f16623] font-medium">Bookings</span>
      </nav>

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-orange-50 border border-[#f16623]/25 flex items-center justify-center text-[#f16623]">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-medium text-slate-900 leading-tight">
                Trips &amp; Bookings Manager
              </h1>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-medium bg-orange-50 text-[#f16623] border border-[#f16623]/20">
                {bookings.length} Total Trips
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Corporate contracts, Individual retail bookings, pass-through charges &amp; live invoice tracking
            </p>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/credit"
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition flex items-center gap-1.5 shadow-2xs"
          >
            <Banknote className="w-3.5 h-3.5 text-slate-500" />
            <span>Credit Outstandings</span>
          </Link>

          <Link
            href="/payments"
            className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition flex items-center gap-1.5 shadow-2xs"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-500" />
            <span>Payments Ledger</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenAddBooking}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition flex items-center gap-1.5 active:scale-[0.98] shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Booking</span>
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-[6px] border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search booking #, company, traveler, driver, vehicle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-[34px] max-h-[34px] pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-normal transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Client Type Filter (Company vs Individual Customer) */}
          <div className="flex items-center gap-1.5 text-xs w-48">
            <span className="text-[11px] text-slate-400 font-normal shrink-0">Client:</span>
            <SearchableSelect
              options={[
                { value: "all", label: "All Client Types" },
                { value: "Company", label: "Company", badge: "Corporate", badgeColor: "blue" },
                { value: "Individual Customer", label: "Individual Customer", badge: "Retail", badgeColor: "green" },
              ]}
              value={clientTypeFilter}
              onChange={setClientTypeFilter}
              placeholder="Filter Client..."
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs w-48">
            <span className="text-[11px] text-slate-400 font-normal shrink-0">Status:</span>
            <SearchableSelect
              options={[
                { value: "all", label: "All Trip Statuses" },
                { value: "New", label: "New" },
                { value: "Trip In Progress", label: "Trip In Progress" },
                { value: "Trip Completed", label: "Trip Completed" },
                { value: "Invoice Generated", label: "Invoice Generated" },
                { value: "Invoice Sent", label: "Invoice Sent" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="Filter Status..."
            />
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5 text-xs w-44">
            <span className="text-[11px] text-slate-400 font-normal shrink-0">Payment:</span>
            <SearchableSelect
              options={[
                { value: "all", label: "All Payments" },
                { value: "Unpaid", label: "Unpaid", badge: "Unpaid", badgeColor: "red" },
                { value: "Partial", label: "Partial", badge: "Partial", badgeColor: "amber" },
                { value: "Paid", label: "Paid", badge: "Paid", badgeColor: "green" },
              ]}
              value={paymentFilter}
              onChange={setPaymentFilter}
              placeholder="Filter Payment..."
            />
          </div>
        </div>
      </div>

      {/* Bookings Table Directory */}
      <div className="bg-white rounded-[6px] border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[320px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-medium text-slate-600">
                <th className="py-2.5 px-3">Booking #</th>
                <th className="py-2.5 px-3">Client &amp; Traveler</th>
                <th className="py-2.5 px-3">Trip Dates &amp; Duration</th>
                <th className="py-2.5 px-3">Vehicle &amp; Category</th>
                <th className="py-2.5 px-3">Driver</th>
                <th className="py-2.5 px-3 text-right">Gross Amount</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Payment</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#f16623]" />
                    <span className="font-normal text-xs">Loading trips...</span>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-medium text-slate-600">No bookings found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click &quot;+ Add Booking&quot; above to create your first trip.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b, idx) => {
                  const isIndiv =
                    b.clientType === "Individual Customer" ||
                    b.customerType === "Individual Customer";
                  const isNearBottom =
                    idx >= Math.max(0, filteredBookings.length - 3) &&
                    filteredBookings.length > 3;

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-slate-50/60 transition-colors group"
                    >
                      {/* Booking # & Route */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 font-mono text-[11px]">
                          {b.bookingNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>{b.fromLocation}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                          <span>{b.toLocation}</span>
                        </div>
                        {b.totalKm > 0 && (
                          <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                            {b.totalKm} KM
                          </span>
                        )}
                      </td>

                      {/* Client (Company vs Individual) & Traveler */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          {isIndiv ? (
                            <User className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-[#f16623] shrink-0" />
                          )}
                          <span className="truncate max-w-[130px]">
                            {b.customerName}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                              isIndiv
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {isIndiv ? "Individual" : "Company"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span className="text-slate-400 text-[10px]">Pax:</span>
                          <span>{b.travelerName}</span>
                          {b.travelerMobile && (
                            <span className="text-[10px] text-slate-400">
                              ({b.travelerMobile})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Dates & Duration */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 text-[11px] font-normal flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{b.startDate}</span>
                          <span className="text-slate-400">to</span>
                          <span>{b.endDate}</span>
                        </div>
                        <div className="text-[10px] text-[#f16623] font-medium mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{b.durationText || "1 Day"}</span>
                        </div>
                      </td>

                      {/* Vehicle & Category */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 flex items-center gap-1">
                          <Car className="w-3 h-3 text-slate-500" />
                          <span>{b.vehicleCategory || "Sedan"}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {b.vehicleRegNumber ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              {b.vehicleRegNumber}
                            </span>
                          ) : (
                            <span className="text-amber-600">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* Driver */}
                      <td className="py-2.5 px-3">
                        {b.driverName ? (
                          <div>
                            <div className="font-medium text-slate-900">
                              {b.driverName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                              <PhoneCall className="w-2.5 h-2.5" />
                              <span>{b.driverMobile || "—"}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            No driver
                          </span>
                        )}
                      </td>

                      {/* Gross Amount */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-medium text-slate-900 font-mono">
                          ₹{(b.grossAmount || 0).toLocaleString("en-IN")}
                        </div>
                        {b.discount && b.discount > 0 ? (
                          <div className="text-[10px] text-rose-600 font-mono">
                            Disc: − ₹{b.discount.toLocaleString("en-IN")}
                          </div>
                        ) : null}
                        {b.customerAdvance > 0 && (
                          <div className="text-[10px] text-emerald-600 font-mono">
                            Adv: ₹{b.customerAdvance.toLocaleString("en-IN")}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            b.bookingStatus === "New"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : b.bookingStatus === "Trip In Progress"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : b.bookingStatus === "Trip Completed"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : b.bookingStatus === "Invoice Generated"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {b.bookingStatus}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            b.paymentStatus === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : b.paymentStatus === "Partial"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>

                      {/* Actions (3 Vertical Dots Popover) */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="relative inline-block text-left group/action">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId((prev) =>
                                prev === b.id ? null : b.id
                              );
                            }}
                            className={`w-7 h-7 flex items-center justify-center rounded-[6px] transition cursor-pointer border ${
                              activeActionMenuId === b.id
                                ? "bg-slate-100 text-slate-900 border-slate-300"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200"
                            }`}
                            title="Trip actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Action Popover Menu (Triggered on Click or Hover) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 z-40 w-44 bg-white rounded-[8px] border border-slate-200/90 shadow-lg p-1 text-xs text-left transition-all ${
                              isNearBottom
                                ? "bottom-full mb-1.5 origin-bottom-right"
                                : "top-full mt-1.5 origin-top-right"
                            } ${
                              activeActionMenuId === b.id
                                ? "block"
                                : "hidden group-hover/action:block"
                            }`}
                          >
                            <div className="space-y-0.5">
                              {/* 1. View Details */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setViewingBooking(b);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>View Details</span>
                              </button>

                              {/* 2. Edit Booking */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleOpenEditBooking(b);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-slate-700 hover:bg-orange-50 hover:text-[#f16623] transition cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Edit Booking</span>
                              </button>

                              {/* 3. Invoice View / Generate */}
                              {b.invoiceNumber ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    setInvoiceBooking(b);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-slate-700 hover:bg-orange-50 hover:text-[#f16623] transition cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#f16623] shrink-0" />
                                  <span>View Invoice</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isAllocatingInvoice}
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    handleGenerateInvoice(b);
                                  }}
                                  className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-slate-700 hover:bg-orange-50 hover:text-[#f16623] disabled:opacity-50 transition cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-[#f16623] shrink-0" />
                                  <span>Generate Invoice</span>
                                </button>
                              )}

                              {/* 4. Collect Payment */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleOpenCollectPayment(b);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition cursor-pointer"
                              >
                                <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Collect Payment</span>
                              </button>
                            </div>

                            {/* 5. Delete Action */}
                            <div className="pt-1 mt-1 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleDeleteBooking(b);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-[5px] flex items-center gap-2.5 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Delete Booking</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4-TAB ADD / EDIT BOOKING OFFCANVAS DRAWER */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          setIsOffCanvasOpen(false);
          setEditingBookingId(null);
        }}
        title={
          editingBookingId
            ? `Edit Booking — ${
                bookings.find((b) => b.id === editingBookingId)?.bookingNumber || ""
              }`
            : "Add Booking"
        }
        subtitle={
          editingBookingId
            ? "Update trip schedule, assignment, pass-through charges, and billing breakdown"
            : "Step-by-step trip configuration, vehicle & driver assignment, pass-through charges, and pricing"
        }
        size="3xl"
        widthClassName="max-w-3xl"
      >
        <div className="space-y-4">
          {/* Tab Navigation Headers */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 pb-2.5">
            {[
              { id: "details", label: "1. Details" },
              { id: "assignment", label: "2. Trip Assignment" },
              { id: "charges", label: "3. Charges" },
              { id: "invoice", label: "4. Invoice Preview" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-[6px] transition cursor-pointer select-none shrink-0 ${
                    isActive
                      ? "bg-orange-50 text-[#f16623] font-semibold shadow-xs"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-normal"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ================================================================= */}
          {/* TAB 1: DETAILS */}
          {/* ================================================================= */}
          {activeTab === "details" && (
            <div className="space-y-3.5">
              {/* Trip Dates & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    START DATE *
                  </label>
                  <CustomDatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Select start date..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    START TIME *
                  </label>
                  <CustomTimePicker
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="Select start time..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    END DATE
                  </label>
                  <CustomDatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="Select end date..."
                    minDate={startDate}
                    align="right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    END TIME
                  </label>
                  <CustomTimePicker
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="Select end time..."
                    align="right"
                  />
                </div>
              </div>

              {/* From & To Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    FROM LOCATION *
                  </label>
                  <SearchableSelect
                    options={locationOptions}
                    value={fromLocation}
                    onChange={setFromLocation}
                    placeholder="Search & select pickup location..."
                    allowClear
                    creatable
                    icon={<MapPin className="w-3.5 h-3.5 text-slate-400" />}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    TO LOCATION
                  </label>
                  <SearchableSelect
                    options={locationOptions}
                    value={toLocation}
                    onChange={setToLocation}
                    placeholder="Search & select drop location..."
                    allowClear
                    creatable
                    icon={<Navigation className="w-3.5 h-3.5 text-slate-400" />}
                  />
                </div>
              </div>

              {/* Entity, Client Type & Customer Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    OPERATING ENTITY *
                  </label>
                  <SearchableSelect
                    options={entities.map((ent) => ({
                      value: ent.id,
                      label: ent.name,
                    }))}
                    value={selectedEntityId}
                    onChange={(val) => {
                      setSelectedEntityId(val);
                      const ent = entities.find((item) => item.id === val);
                      setSelectedEntityName(ent?.name || "");
                    }}
                    placeholder="Search & select operating entity..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    CLIENT TYPE *
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "Company", label: "Company (Corporate)", badge: "Company", badgeColor: "blue" },
                      { value: "Individual Customer", label: "Individual Customer", badge: "Retail", badgeColor: "green" },
                    ]}
                    value={clientType}
                    onChange={(val) => {
                      const newType = val as "Company" | "Individual Customer";
                      setClientType(newType);
                      if (newType === "Company") {
                        if (companies.length > 0) {
                          setSelectedCustomerId(companies[0].id);
                          setSelectedCustomerName(companies[0].name);
                          setTravelerName(companies[0].contactPerson || companies[0].name);
                          setTravelerMobile(companies[0].mobile || "");
                        } else {
                          setSelectedCustomerId("");
                          setSelectedCustomerName("");
                        }
                      } else {
                        if (individualCustomers.length > 0) {
                          setSelectedCustomerId(individualCustomers[0].id);
                          setSelectedCustomerName(individualCustomers[0].name);
                          setTravelerName(individualCustomers[0].name);
                          setTravelerMobile(individualCustomers[0].mobile || "");
                        } else {
                          setSelectedCustomerId("");
                          setSelectedCustomerName("");
                        }
                      }
                    }}
                    placeholder="Select Client Type..."
                  />
                </div>

                <div className="space-y-1">
                  {clientType === "Company" ? (
                    <>
                      <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                        COMPANY (CORPORATE CLIENT) *
                      </label>
                      <SearchableSelect
                        options={companies.map((comp) => ({
                          value: comp.id,
                          label: comp.name,
                          subLabel: comp.contactPerson
                            ? `${comp.contactPerson} • ${comp.mobile || ""}`
                            : comp.mobile,
                        }))}
                        value={selectedCustomerId}
                        onChange={(cId) => {
                          setSelectedCustomerId(cId);
                          const comp = companies.find((c) => c.id === cId);
                          if (comp) {
                            setSelectedCustomerName(comp.name);
                            setTravelerName(comp.contactPerson || comp.name);
                            setTravelerMobile(comp.mobile || "");
                          } else {
                            setSelectedCustomerName("");
                          }
                        }}
                        placeholder="Search & select company..."
                      />
                    </>
                  ) : (
                    <>
                      <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                        INDIVIDUAL CUSTOMER *
                      </label>
                      <SearchableSelect
                        options={individualCustomers.map((cust) => ({
                          value: cust.id,
                          label: cust.name,
                          subLabel: cust.mobile ? `Phone: ${cust.mobile} ${cust.email ? "• " + cust.email : ""}` : cust.email,
                        }))}
                        value={selectedCustomerId}
                        onChange={(cId) => {
                          setSelectedCustomerId(cId);
                          const cust = individualCustomers.find((c) => c.id === cId);
                          if (cust) {
                            setSelectedCustomerName(cust.name);
                            setTravelerName(cust.name);
                            setTravelerMobile(cust.mobile || "");
                          } else {
                            setSelectedCustomerName("");
                          }
                        }}
                        placeholder="Search & select individual customer..."
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Tariff Match Info Banner */}
              {selectedCustomerName && (
                <div className="flex items-center gap-2 p-2 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-700 text-xs font-normal">
                  <Info className="w-3.5 h-3.5 text-[#f16623] shrink-0" />
                  <span>
                    {clientType === "Individual Customer" ? (
                      <>
                        Applied Rate Card:{" "}
                        <strong className="font-medium text-slate-900">
                          {activeCompanyTariff?.tariffName || "Default Customer Tariff"}
                        </strong>{" "}
                        <span className="text-slate-400 font-normal">
                          (Common default rate card for all individual customers)
                        </span>
                      </>
                    ) : (
                      <>
                        Company Contract Rate Plan:{" "}
                        <strong className="font-medium text-slate-900">
                          {activeCompanyTariff
                            ? activeCompanyTariff.tariffName || activeCompanyTariff.customerName
                            : "No company tariff found (using standard fallback)"}
                        </strong>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Vehicle Category & Tariff Type Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {/* Vehicle Category */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    VEHICLE CATEGORY *
                  </label>
                  <SearchableSelect
                    options={availableTariffCategories.map((cat: string) => ({
                      value: cat,
                      label: cat,
                    }))}
                    value={selectedVehicleCategory}
                    onChange={(val) => setSelectedVehicleCategory(val)}
                    placeholder={
                      availableTariffCategories.length === 0
                        ? "No categories in tariff"
                        : "Select Category..."
                    }
                    disabled={availableTariffCategories.length === 0}
                  />
                </div>

                {/* Tariff Type */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    TARIFF DUTY TYPE
                  </label>
                  <SearchableSelect
                    options={availableTariffTypes.map((type) => ({
                      value: type,
                      label: type,
                    }))}
                    value={selectedTariffType}
                    onChange={(val) => setSelectedTariffType(val as any)}
                    placeholder="Select Duty Type..."
                    disabled={availableTariffTypes.length === 0}
                  />
                </div>

                {/* Package / Slab */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    PACKAGE / SLAB
                  </label>
                  <SearchableSelect
                    options={availablePackages.map((pkg: any) => ({
                      value: pkg.id,
                      label: pkg.name,
                      subLabel: `Base: ₹${pkg.baseRate || 0} (${pkg.minKm || 0} KM / ${pkg.minHours || 0} Hrs)`,
                    }))}
                    value={selectedPackageId}
                    onChange={(val) => {
                      setSelectedPackageId(val);
                      const pkg = availablePackages.find((p: any) => p.id === val);
                      setSelectedPackageName(pkg?.name || "");
                    }}
                    placeholder="Select Package..."
                    disabled={availablePackages.length === 0}
                  />
                </div>
              </div>

              {/* Traveler Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    TRAVELER / PASSENGER NAME *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar (Director)"
                    value={travelerName}
                    onChange={(e) => setTravelerName(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    TRAVELER MOBILE NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={travelerMobile}
                    onChange={(e) => setTravelerMobile(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
                  />
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsOffCanvasOpen(false)}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveBookingSubmit}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-[#f16623] bg-orange-50 hover:bg-orange-100 text-[#f16623] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{editingBookingId ? "Update Booking" : "Save Booking"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!validateStep1Details()) return;
                      setActiveTab("assignment");
                    }}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>Next: Trip Assignment</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 2: TRIP ASSIGNMENT */}
          {/* ================================================================= */}
          {activeTab === "assignment" && (
            <div className="space-y-3.5">
              {/* Calculated Duration Display Banner */}
              <div className="p-3 rounded-[6px] bg-orange-50/50 border border-orange-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#f16623]" />
                  <div>
                    <span className="text-xs font-medium text-slate-900">
                      Calculated Trip Duration
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {startDate} {startTime} to {endDate} {endTime}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-[#f16623] font-mono">
                    {calculatedDuration.text}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    ({calculatedDuration.totalDays} Days, {calculatedDuration.totalHours} Hrs, {calculatedDuration.totalMinutes % 60} Mins)
                  </p>
                </div>
              </div>

              {/* Vehicle & Driver Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Vehicle Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    ASSIGN VEHICLE ({selectedVehicleCategory || "All"})
                  </label>
                  <SearchableSelect
                    options={filteredVehicles.map((v) => {
                      const isOccupied = occupiedVehicleIds.has(v.id);
                      return {
                        value: v.id,
                        label: `${v.regNumber} — ${v.vehicleName}`,
                        subLabel: `${v.category || "Vehicle"} • ${v.fuelType || ""}`,
                        badge: isOccupied ? "In Trip" : "Available",
                        badgeColor: isOccupied ? "amber" : "green",
                      };
                    })}
                    value={selectedVehicleId}
                    onChange={(vId) => {
                      setSelectedVehicleId(vId);
                      const veh = vehicles.find((v) => v.id === vId);
                      setSelectedVehicleReg(veh?.regNumber || "");
                      setSelectedVehicleName(veh?.vehicleName || "");
                    }}
                    placeholder="Search & select vehicle..."
                  />
                </div>

                {/* Driver Selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    ASSIGN DRIVER
                  </label>
                  <SearchableSelect
                    options={drivers.map((d) => {
                      const isOccupied = occupiedDriverIds.has(d.id);
                      const onLeave = d.availabilityStatus === "On Leave";
                      const statusLabel = onLeave
                        ? "On Leave"
                        : isOccupied
                        ? "In Trip"
                        : "Available";
                      const badgeColor: "red" | "amber" | "green" = onLeave
                        ? "red"
                        : isOccupied
                        ? "amber"
                        : "green";
                      return {
                        value: d.id,
                        label: d.fullName || d.name,
                        subLabel: d.mobileNumber || d.mobile,
                        badge: statusLabel,
                        badgeColor,
                      };
                    })}
                    value={selectedDriverId}
                    onChange={(dId) => {
                      setSelectedDriverId(dId);
                      const d = drivers.find((item) => item.id === dId);
                      setSelectedDriverName(d?.fullName || d?.name || "");
                      setSelectedDriverMobile(d?.mobileNumber || d?.mobile || "");
                    }}
                    placeholder="Search & select driver..."
                  />
                </div>
              </div>

              {/* Driver Phone Number Display Box */}
              {selectedDriverName && (
                <div className="p-2.5 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#f16623]" />
                    <div>
                      <span className="font-medium text-slate-900">
                        {selectedDriverName}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Assigned driver
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedDriverMobile || "No mobile listed"}</span>
                  </div>
                </div>
              )}

              {/* Meter Starting KM, Ending KM & Total KM */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    STARTING METER KM
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 12500"
                    value={startingKm}
                    onChange={(e) => setStartingKm(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    ENDING METER KM
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 12850"
                    value={endingKm}
                    onChange={(e) => setEndingKm(e.target.value)}
                    className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    TOTAL KILOMETER
                  </label>
                  <div className="w-full h-[34px] max-h-[34px] px-3 bg-slate-100/80 border border-slate-200 rounded-[6px] text-slate-900 font-mono text-xs flex items-center justify-between">
                    <span>{calculatedTotalKm} KM</span>
                    <span className="text-[10px] text-slate-400">
                      (End − Start)
                    </span>
                  </div>
                </div>
              </div>

              {/* Travelled Places Multi-select with Search */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  TRAVELLED PLACES / CITIES (MULTI-SELECT)
                </label>

                {/* Selected City Badges */}
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {travelledPlaces.map((city) => (
                    <span
                      key={city}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-orange-50 text-[#f16623] border border-[#f16623]/30 font-medium"
                    >
                      <span>{city}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setTravelledPlaces(
                            travelledPlaces.filter((c) => c !== city)
                          )
                        }
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Searchable Input to Add Cities */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search city to add (e.g. Hyderabad, Warangal, Vijayawada)..."
                    value={citySearchQuery}
                    onFocus={() => setShowCityDropdown(true)}
                    onChange={(e) => {
                      setCitySearchQuery(e.target.value);
                      setShowCityDropdown(true);
                    }}
                    className="w-full h-[34px] max-h-[34px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
                  />

                  {/* Dropdown Options */}
                  {showCityDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-[6px] shadow-lg max-h-48 overflow-y-auto z-50">
                      {ALL_CITIES_LIST.filter(
                        (c) =>
                          c.toLowerCase().includes(citySearchQuery.toLowerCase()) &&
                          !travelledPlaces.includes(c)
                      )
                        .slice(0, 15)
                        .map((city) => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              setTravelledPlaces([...travelledPlaces, city]);
                              setCitySearchQuery("");
                              setShowCityDropdown(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-orange-50 hover:text-[#f16623] transition flex items-center justify-between cursor-pointer"
                          >
                            <span>{city}</span>
                            <Plus className="w-3 h-3 text-slate-400" />
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Trip Notes */}
              <div className="space-y-1 pt-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  TRIP NOTES / SPECIAL INSTRUCTIONS
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Flight arrival terminal 2, VIP guest, child seat requested..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
                />
              </div>

              {/* Step 2 Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab("details")}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveBookingSubmit}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-[#f16623] bg-orange-50 hover:bg-orange-100 text-[#f16623] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{editingBookingId ? "Update Booking" : "Save Booking"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("charges")}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>Next: Charges</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 3: CHARGES (MATCHING EXACT USER IMAGE) */}
          {/* ================================================================= */}
          {activeTab === "charges" && (
            <div className="space-y-4">
              {/* Card 1: Pass-through Charges (₹) */}
              <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Pass-through Charges (₹)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      TOLLS
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={tolls}
                      onChange={(e) => setTolls(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      PARKING
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={parking}
                      onChange={(e) => setParking(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      STATE PERMIT
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={statePermit}
                      onChange={(e) => setStatePermit(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      MEALS
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={meals}
                      onChange={(e) => setMeals(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      INTERSTATE / BORDER ENTRY
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={interstateEntryTax}
                      onChange={(e) => setInterstateEntryTax(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      NIGHT HALT
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={nightHalt}
                      onChange={(e) => setNightHalt(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Discount / Special Concession */}
              <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-5 h-5 rounded-[4px] bg-rose-50 text-rose-600 flex items-center justify-center">
                    <Receipt className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Discount / Special Concession (₹)
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      DISCOUNT (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                    <p className="text-[11px] text-slate-400 font-normal">
                      Special discount or concession deducted directly from gross trip charges.
                    </p>
                  </div>

                  <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 text-slate-600 text-xs font-normal flex items-start gap-2 mt-0.5">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>
                      Discounts are deducted from the gross fare before customer advance and final bill settlement.
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Customer Advance (Image Requirement) */}
              <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-5 h-5 rounded-[4px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    Customer Advance
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                      CUSTOMER ADVANCE (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={customerAdvance}
                      onChange={(e) => setCustomerAdvance(e.target.value)}
                      className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-slate-50/50 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono"
                    />
                    <p className="text-[11px] text-slate-400 font-normal">
                      Money collected from the customer toward the bill.
                    </p>
                  </div>

                  {/* Advance Warning Box */}
                  <div className="p-3 rounded-[6px] bg-amber-50/70 border border-amber-200 text-amber-800 text-xs font-normal flex items-start gap-2 mt-0.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Office &amp; driver advances are tracked in{" "}
                      <strong className="font-medium">Expenses</strong> — not on the booking.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab("assignment")}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveBookingSubmit}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-[#f16623] bg-orange-50 hover:bg-orange-100 text-[#f16623] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{editingBookingId ? "Update Booking" : "Save Booking"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("invoice")}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span>Next: Invoice Preview</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* TAB 4: INVOICE / PRICE PREVIEW */}
          {/* ================================================================= */}
          {activeTab === "invoice" && (
            <div className="space-y-4">
              {/* Detailed Itemized Charges Breakdown Table */}
              <div className="border border-slate-200 rounded-[6px] bg-white overflow-hidden shadow-xs">
                <div className="bg-slate-50/80 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#f16623]" />
                    <span className="text-xs font-semibold text-slate-900">
                      Trip Cost &amp; Price Breakdown
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Category: {selectedVehicleCategory}
                  </span>
                </div>

                {/* Billed To Client Header */}
                <div className="p-3 bg-orange-50/40 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">
                      BILLED TO ({clientType === "Individual Customer" ? "INDIVIDUAL CUSTOMER" : "COMPANY"})
                    </span>
                    <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5 mt-0.5">
                      {clientType === "Individual Customer" ? (
                        <User className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Building2 className="w-3.5 h-3.5 text-[#f16623]" />
                      )}
                      {selectedCustomerName || "Not Selected"}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Traveler / Contact: {travelerName || selectedCustomerName} {travelerMobile ? `(${travelerMobile})` : ""}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-medium block">
                      CLIENT BILLING MODE
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border mt-0.5 ${
                      clientType === "Individual Customer"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}>
                      {clientType}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 divide-y divide-slate-100 text-xs font-normal space-y-2">
                  {/* Base Package Rate */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-600">
                      Base Fare ({selectedTariffType} — {selectedPackageName || "Plan"})
                    </span>
                    <span className="font-mono text-slate-900 font-medium">
                      ₹{pricingBreakdown.baseFare.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Extra KM */}
                  {pricingBreakdown.extraKm > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">
                        Extra Distance ({pricingBreakdown.extraKm} KM @ ₹
                        {pricingBreakdown.extraKmRate}/KM)
                      </span>
                      <span className="font-mono text-slate-900">
                        + ₹{pricingBreakdown.extraKmCost.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Extra Hours */}
                  {pricingBreakdown.extraHours > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">
                        Extra Hours ({pricingBreakdown.extraHours} Hrs @ ₹
                        {pricingBreakdown.extraHoursRate}/hr)
                      </span>
                      <span className="font-mono text-slate-900">
                        + ₹{pricingBreakdown.extraHoursCost.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Driver Bata */}
                  {pricingBreakdown.driverBataCost > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">Driver Bata</span>
                      <span className="font-mono text-slate-900">
                        + ₹{pricingBreakdown.driverBataCost.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Pass-through Charges */}
                  {pricingBreakdown.totalPassThrough > 0 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-slate-600">
                        Pass-through Charges (Tolls, Parking, Permits, Meals, Border Entry)
                      </span>
                      <span className="font-mono text-slate-900">
                        + ₹
                        {pricingBreakdown.totalPassThrough.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Gross Total */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 font-medium">
                    <span className="text-slate-800">Gross Total Amount</span>
                    <span className="font-mono text-slate-900 text-sm">
                      ₹{pricingBreakdown.grossAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Special Discount */}
                  {pricingBreakdown.discount > 0 && (
                    <div className="flex items-center justify-between pt-2 text-rose-600">
                      <span>Less: Special Concession / Discount</span>
                      <span className="font-mono font-medium">
                        − ₹
                        {pricingBreakdown.discount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Customer Advance */}
                  {pricingBreakdown.customerAdvance > 0 && (
                    <div className="flex items-center justify-between pt-2 text-emerald-700">
                      <span>Less: Customer Advance Paid</span>
                      <span className="font-mono font-medium">
                        − ₹
                        {pricingBreakdown.customerAdvance.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}

                  {/* Final Net Payable */}
                  <div className="flex items-center justify-between pt-2.5 border-t-2 border-slate-300 font-semibold text-sm">
                    <span className="text-slate-900">Net Balance Payable</span>
                    <span className="font-mono text-[#f16623]">
                      ₹{pricingBreakdown.netAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-[6px] border border-slate-200">
                {/* Booking Status Pipeline */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    BOOKING STATUS
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "New", label: "New" },
                      { value: "Trip In Progress", label: "Trip In Progress" },
                      { value: "Trip Completed", label: "Trip Completed" },
                      { value: "Invoice Generated", label: "Invoice Generated" },
                      { value: "Invoice Sent", label: "Invoice Sent" },
                    ]}
                    value={bookingStatus}
                    onChange={(val) => setBookingStatus(val as any)}
                  />
                </div>

                {/* Payment Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                    PAYMENT STATUS (AUTO / OVERRIDE)
                  </label>
                  <SearchableSelect
                    options={[
                      { value: "Unpaid", label: "Unpaid", badge: "Unpaid", badgeColor: "red" },
                      { value: "Partial", label: "Partial", badge: "Partial", badgeColor: "amber" },
                      { value: "Paid", label: "Paid", badge: "Paid", badgeColor: "green" },
                    ]}
                    value={autoPaymentStatus}
                    onChange={(val) => setOverridePaymentStatus(val as PaymentStatus)}
                  />
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveTab("charges")}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
                >
                  Back
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
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveBookingSubmit}
                    className="h-[34px] max-h-[34px] px-5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#f16623]/25 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{editingBookingId ? "Updating Booking..." : "Saving Booking..."}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>{editingBookingId ? "Update Booking" : "Save Booking"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </OffCanvas>

      {/* ===================================================================== */}
      {/* VIEW TRIP DETAILS & PAYMENT HISTORY MODAL */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={!!viewingBooking}
        onClose={() => setViewingBooking(null)}
        title={`Trip: ${viewingBooking?.bookingNumber || ""}`}
        subtitle="Complete itinerary specs, driver assignment, pass-through charges & payment trail"
        size="2xl"
        widthClassName="max-w-2xl"
      >
        {viewingBooking && (
          <div className="space-y-4 text-xs font-normal text-slate-700">
            {/* Top Status & Advance Pipeline */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[6px] bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  TRIP STATUS
                </span>
                <span className="font-semibold text-slate-900 text-xs">
                  {viewingBooking.bookingStatus}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  PAYMENT STATUS
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    viewingBooking.paymentStatus === "Paid"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : viewingBooking.paymentStatus === "Partial"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {viewingBooking.paymentStatus}
                </span>
              </div>
            </div>

            {/* Quick Status Advance Button Bar */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 uppercase font-medium block">
                UPDATE TRIP PROGRESS
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    "New",
                    "Trip In Progress",
                    "Trip Completed",
                    "Invoice Generated",
                    "Invoice Sent",
                  ] as BookingStatus[]
                ).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      handleUpdateBookingStatus(viewingBooking.id, st)
                    }
                    className={`h-[28px] max-h-[34px] px-2.5 rounded-[4px] text-[11px] transition cursor-pointer border ${
                      viewingBooking.bookingStatus === st
                        ? "bg-[#f16623] text-white border-[#f16623] font-medium"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 font-normal"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Itinerary Details */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[6px] border border-slate-200 bg-white">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  {viewingBooking.clientType === "Individual Customer" ||
                  viewingBooking.customerType === "Individual Customer"
                    ? "INDIVIDUAL CUSTOMER"
                    : "CUSTOMER COMPANY"}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="font-medium text-slate-900 block">
                    {viewingBooking.customerName}
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-medium border ${
                      viewingBooking.clientType === "Individual Customer" ||
                      viewingBooking.customerType === "Individual Customer"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {viewingBooking.clientType === "Individual Customer" ||
                    viewingBooking.customerType === "Individual Customer"
                      ? "Individual"
                      : "Company"}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Traveler: {viewingBooking.travelerName} (
                  {viewingBooking.travelerMobile})
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  OPERATING ENTITY
                </span>
                <span className="font-medium text-slate-900 block">
                  {viewingBooking.entityName || "RK Travels"}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  ROUTE
                </span>
                <span className="font-medium text-slate-900">
                  {viewingBooking.fromLocation} → {viewingBooking.toLocation}
                </span>
                {viewingBooking.totalKm > 0 && (
                  <span className="text-[11px] text-slate-400 block font-mono">
                    Total: {viewingBooking.totalKm} KM
                  </span>
                )}
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  DATES &amp; DURATION
                </span>
                <span className="font-medium text-slate-900">
                  {viewingBooking.startDate} to {viewingBooking.endDate}
                </span>
                <span className="text-[11px] text-[#f16623] block">
                  {viewingBooking.durationText}
                </span>
              </div>
            </div>

            {/* Vehicle & Driver */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-[6px] border border-slate-200 bg-white">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  ASSIGNED VEHICLE
                </span>
                <span className="font-medium text-slate-900 block">
                  {viewingBooking.vehicleRegNumber || "Not assigned"}
                </span>
                <span className="text-[11px] text-slate-500">
                  {viewingBooking.vehicleCategory}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-medium block">
                  ASSIGNED DRIVER
                </span>
                <span className="font-medium text-slate-900 block">
                  {viewingBooking.driverName || "Not assigned"}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {viewingBooking.driverMobile || ""}
                </span>
              </div>
            </div>

            {/* Pass-through Charges Breakdown */}
            <div className="border border-slate-200 rounded-[6px] p-3 bg-white space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-medium block border-b border-slate-100 pb-1">
                PASS-THROUGH CHARGES SUMMARY
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">TOLLS</span>
                  <span className="font-mono">₹{viewingBooking.tolls || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">PARKING</span>
                  <span className="font-mono">₹{viewingBooking.parking || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">
                    STATE PERMIT
                  </span>
                  <span className="font-mono">
                    ₹{viewingBooking.statePermit || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">MEALS</span>
                  <span className="font-mono">₹{viewingBooking.meals || 0}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">
                    INTERSTATE ENTRY
                  </span>
                  <span className="font-mono">
                    ₹{viewingBooking.interstateEntryTax || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block">
                    NIGHT HALT
                  </span>
                  <span className="font-mono">
                    ₹{viewingBooking.nightHalt || 0}
                  </span>
                </div>
                {viewingBooking.discount && viewingBooking.discount > 0 ? (
                  <div>
                    <span className="text-slate-400 text-[10px] block">
                      DISCOUNT
                    </span>
                    <span className="font-mono text-rose-600">
                      − ₹{viewingBooking.discount}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Payment History Section */}
            <div className="border border-slate-200 rounded-[6px] p-3 bg-white space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#f16623]" />
                  <span className="font-semibold text-slate-900 text-xs">
                    Payment History
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenCollectPayment(viewingBooking);
                  }}
                  className="h-[24px] max-h-[34px] px-2 rounded-[4px] bg-[#f16623] hover:bg-[#d95318] text-white text-[10px] font-medium cursor-pointer"
                >
                  + Add Payment
                </button>
              </div>

              {!viewingBooking.paymentHistory ||
              viewingBooking.paymentHistory.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-3 text-center">
                  No payment entries recorded yet.
                </p>
              ) : (
                <div className="space-y-1.5 divide-y divide-slate-100">
                  {viewingBooking.paymentHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="pt-1.5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {item.paymentMode}
                          </span>
                          <span>{item.date} {item.time ? `@ ${item.time}` : ""}</span>
                        </div>
                        {item.referenceNumber && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            Ref / UTR: {item.referenceNumber}
                          </span>
                        )}
                        {item.notes && (
                          <span className="text-[10px] text-slate-500 italic block">
                            {item.notes}
                          </span>
                        )}
                      </div>
                      <div className="font-mono font-semibold text-emerald-700">
                        ₹{item.amount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isAllocatingInvoice}
                  onClick={() => {
                    const b = viewingBooking;
                    handleGenerateInvoice(b);
                  }}
                  className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] disabled:opacity-60 text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {viewingBooking.invoiceNumber ? (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Invoice ({viewingBooking.invoiceNumber})</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Invoice</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const b = viewingBooking;
                    setViewingBooking(null);
                    handleOpenEditBooking(b);
                  }}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#f16623] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Edit this booking"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Booking</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const b = viewingBooking;
                    handleDeleteBooking(b);
                  }}
                  className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Delete this booking"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingBooking(null)}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* ===================================================================== */}
      {/* COLLECT / RECORD PAYMENT MODAL */}
      {/* ===================================================================== */}
      <OffCanvas
        isOpen={!!collectingBooking}
        onClose={() => setCollectingBooking(null)}
        title="Collect Payment"
        subtitle={`Recording payment for trip ${collectingBooking?.bookingNumber || ""}`}
        size="md"
        widthClassName="max-w-md"
      >
        {collectingBooking && (
          <div className="space-y-3.5 text-xs font-normal">
            {/* Bill Summary */}
            <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Bill Amount:</span>
                <span className="font-mono font-medium text-slate-900">
                  ₹{(collectingBooking.grossAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>
              {collectingBooking.discount && collectingBooking.discount > 0 ? (
                <div className="flex justify-between text-rose-600">
                  <span>Less: Special Discount:</span>
                  <span className="font-mono font-medium">
                    − ₹{collectingBooking.discount.toLocaleString("en-IN")}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-slate-500">Total Received So Far:</span>
                <span className="font-mono font-medium text-emerald-700">
                  ₹{(collectingBooking.receivedAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-slate-900 font-medium">
                <span>Remaining Balance Due:</span>
                <span className="font-mono text-[#f16623]">
                  ₹{(collectingBooking.balanceAmount || collectingBooking.netAmount || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Amount to Collect Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                AMOUNT TO COLLECT (₹) *
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 focus:outline-none focus:border-[#f16623] font-mono font-medium"
              />
            </div>

            {/* Payment Mode Selector: Cash, Card, UPI */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                PAYMENT MODE *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Cash", "Card", "UPI"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCollectMode(m)}
                    className={`h-[34px] max-h-[34px] rounded-[6px] text-xs font-normal border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      collectMode === m
                        ? "border-[#f16623] bg-orange-50/80 text-[#f16623] font-medium"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {m === "Cash" && <Banknote className="w-3.5 h-3.5" />}
                    {m === "Card" && <CreditCard className="w-3.5 h-3.5" />}
                    {m === "UPI" && <QrCode className="w-3.5 h-3.5" />}
                    <span>{m}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* If UPI, ask for Reference Number (Mandatory as per user spec) */}
            {collectMode === "UPI" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  UPI REFERENCE NUMBER / UTR / TXN ID *
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI/123456789012 or GPay-98213"
                  value={collectRefNumber}
                  onChange={(e) => setCollectRefNumber(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-mono"
                />
              </div>
            )}

            {/* If Card, optional card authorization ref */}
            {collectMode === "Card" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                  CARD TRANSACTION / INVOICE REF
                </label>
                <input
                  type="text"
                  placeholder="e.g. POS-9842 / Auth code"
                  value={collectRefNumber}
                  onChange={(e) => setCollectRefNumber(e.target.value)}
                  className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-mono"
                />
              </div>
            )}

            {/* Note / Remarks */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-slate-600 uppercase tracking-wider block">
                NOTES / REMARKS
              </label>
              <input
                type="text"
                placeholder="e.g. Partial settlement from Accounts Dept"
                value={collectNotes}
                onChange={(e) => setCollectNotes(e.target.value)}
                className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] font-normal"
              />
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollectingBooking(null)}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-normal transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCollectingPayment}
                onClick={handleRecordPaymentSubmit}
                className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#f16623]/25 disabled:opacity-50"
              >
                {isCollectingPayment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Record Payment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* ===================================================================== */}
      {/* TAX INVOICE MODAL (MATCHING ATTACHED SCREENSHOT EXACTLY) */}
      {/* ===================================================================== */}
      <TaxInvoiceModal
        isOpen={!!invoiceBooking}
        onClose={() => setInvoiceBooking(null)}
        booking={invoiceBooking}
        entityData={
          rawEntities.find(
            (e) =>
              e.id === invoiceBooking?.entityId ||
              e.legalName === invoiceBooking?.entityName ||
              e.tradeName === invoiceBooking?.entityName ||
              e.entityName === invoiceBooking?.entityName
          ) || null
        }
        companyData={
          rawCompanies.find(
            (c) =>
              c.id === invoiceBooking?.customerId ||
              c.legalName === invoiceBooking?.customerName ||
              c.companyName === invoiceBooking?.customerName ||
              c.name === invoiceBooking?.customerName
          ) || null
        }
        onGenerateInvoice={async (bookingId: string) => {
          const bookingItem =
            bookings.find((b) => b.id === bookingId) || invoiceBooking;
          if (bookingItem) {
            await handleGenerateInvoice(bookingItem);
          }
        }}
        isGenerating={isAllocatingInvoice}
      />
    </div>
  );
}
