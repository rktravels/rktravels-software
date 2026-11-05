"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarCheck,
  Check,
  Plus,
  Search,
  MapPin,
  ArrowRight,
  User,
  Users,
  Building2,
  Layers,
  IndianRupee,
  Loader2,
  PhoneCall,
  X,
  Clock,
  Banknote,
  Car,
  Navigation,
  Eye,
  Printer,
  Sparkles,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  ShieldCheck,
  Download,
  RefreshCw,
  UserCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import {
  TaxInvoiceModal,
  type InvoiceBookingData,
} from "@/components/TaxInvoiceModal";
import {
  SolidAreaChart,
  SolidPieChart,
  SolidDonutChart,
  SolidBarChart,
  SolidLineChart,
  SolidHorizontalBarChart,
} from "@/components/reports/ReportCharts";
import {
  formatINR,
  formatCompactINR,
  SOLID_PALETTE,
} from "@/lib/report-utils";

// --- Types & Models ---

export type DashboardDatePreset =
  | "today"
  | "tomorrow"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "custom"
  | "all";

export interface DashboardBooking {
  id: string;
  bookingNumber: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  clientType?: "Company" | "Individual Customer";
  customerType?: "Company" | "Individual Customer";
  customerId?: string;
  customerName: string;
  travelerName: string;
  travelerMobile?: string;
  tariffType?: string;
  tariffPackageName?: string;
  startDate: string;
  startTime?: string;
  endDate: string;
  endTime?: string;
  fromLocation: string;
  toLocation: string;
  travelledPlaces?: string[];
  vehicleCategory?: string;
  vehicleRegNumber?: string;
  driverName?: string;
  driverMobile?: string;
  startingKm?: number;
  endingKm?: number;
  totalKm?: number;
  totalHours?: number;
  totalDays?: number;
  durationText?: string;
  baseFare?: number;
  extraHoursRate?: number;
  extraHoursCost?: number;
  extraKmRate?: number;
  extraKmCost?: number;
  driverBataCost?: number;
  nightHaltCost?: number;
  fuelChargesCost?: number;
  fuelRatePerKm?: number;
  showFuelInInvoice?: boolean;
  tolls?: number;
  parking?: number;
  statePermit?: number;
  meals?: number;
  interstateEntryTax?: number;
  totalPassThrough?: number;
  customerAdvance?: number;
  discount?: number;
  grossAmount?: number;
  netAmount?: number;
  balanceAmount?: number;
  receivedAmount?: number;
  entityId?: string;
  entityName?: string;
  bookingStatus?:
    | "New"
    | "Trip In Progress"
    | "Trip Completed"
    | "Invoice Generated"
    | "Invoice Sent"
    | "Cancelled"
    | string;
  paymentStatus?: "Paid" | "Partial" | "Unpaid" | string;
  createdAt?: any;
}

export interface DriverItem {
  id: string;
  fullName?: string;
  name?: string;
  mobileNumber?: string;
  mobile?: string;
  licenseNumber?: string;
  dlNumber?: string;
  availabilityStatus?: string;
  status?: string;
  isActive?: boolean;
}

export interface VehicleItem {
  id: string;
  regNumber?: string;
  vehicleName?: string;
  category?: string;
  status?: string;
}

// --- Date Calculation Helpers ---

function formatYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDashboardDateRange(
  preset: DashboardDatePreset,
  customStart = "",
  customEnd = ""
): { startDate: string; endDate: string; label: string; totalDays: number } {
  const now = new Date();
  const todayStr = formatYMD(now);

  switch (preset) {
    case "today":
      return {
        startDate: todayStr,
        endDate: todayStr,
        label: "Today",
        totalDays: 1,
      };

    case "tomorrow": {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      const tomStr = formatYMD(tom);
      return {
        startDate: tomStr,
        endDate: tomStr,
        label: "Tomorrow",
        totalDays: 1,
      };
    }

    case "yesterday": {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = formatYMD(yest);
      return {
        startDate: yestStr,
        endDate: yestStr,
        label: "Yesterday",
        totalDays: 1,
      };
    }

    case "this_week": {
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMon);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: formatYMD(monday),
        endDate: formatYMD(sunday),
        label: "This Week",
        totalDays: 7,
      };
    }

    case "last_week": {
      const day = now.getDay();
      const diffToMon = (day === 0 ? -6 : 1) - day;
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() + diffToMon);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return {
        startDate: formatYMD(lastMonday),
        endDate: formatYMD(lastSunday),
        label: "Last Week",
        totalDays: 7,
      };
    }

    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(lastDay),
        label: "This Month",
        totalDays: lastDay.getDate(),
      };
    }

    case "last_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(lastDay),
        label: "Last Month",
        totalDays: lastDay.getDate(),
      };
    }

    case "this_year": {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(lastDay),
        label: "This Year",
        totalDays: 365,
      };
    }

    case "last_year": {
      const firstDay = new Date(now.getFullYear() - 1, 0, 1);
      const lastDay = new Date(now.getFullYear() - 1, 11, 31);
      return {
        startDate: formatYMD(firstDay),
        endDate: formatYMD(lastDay),
        label: "Last Year",
        totalDays: 365,
      };
    }

    case "custom": {
      const start = customStart || todayStr;
      const end = customEnd || todayStr;
      const diffTime = Math.abs(
        new Date(end).getTime() - new Date(start).getTime()
      );
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return {
        startDate: start,
        endDate: end,
        label: "Custom Range",
        totalDays: Math.max(1, isNaN(diffDays) ? 1 : diffDays),
      };
    }

    case "all":
    default:
      return {
        startDate: "",
        endDate: "",
        label: "All Time",
        totalDays: 30,
      };
  }
}

const DATE_PRESET_BUTTONS: { id: DashboardDatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_year", label: "This Year" },
  { id: "last_year", label: "Last Year" },
  { id: "custom", label: "Custom Range" },
  { id: "all", label: "All Time" },
];

export default function DashboardPage() {
  // --- State ---
  const [datePreset, setDatePreset] = useState<DashboardDatePreset>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [bookings, setBookings] = useState<DashboardBooking[]>([]);
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Table filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [selectedBookingForDetail, setSelectedBookingForDetail] =
    useState<DashboardBooking | null>(null);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] =
    useState<InvoiceBookingData | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isDriverRosterModalOpen, setIsDriverRosterModalOpen] = useState(false);
  const [driverRosterFilter, setDriverRosterFilter] = useState<
    "all" | "occupied" | "free"
  >("all");

  // --- Subscriptions ---
  useEffect(() => {
    setLoading(true);

    // 1. Subscribe to Bookings
    const qBookings = query(
      collection(db, "bookings"),
      orderBy("createdAt", "desc")
    );
    const unsubBookings = onSnapshot(
      qBookings,
      (snapshot) => {
        const bList: DashboardBooking[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        }));
        setBookings(bList);
        setLoading(false);
      },
      (error) => {
        console.warn("Bookings subscribe warning:", error);
        // Fallback without orderBy if index is building
        getDocs(collection(db, "bookings")).then((snap) => {
          const bList: DashboardBooking[] = snap.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any),
          }));
          setBookings(bList);
          setLoading(false);
        });
      }
    );

    // 2. Subscribe to Drivers
    const unsubDrivers = onSnapshot(
      collection(db, "drivers"),
      (snap) => {
        const dList: DriverItem[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setDrivers(dList);
      },
      (err) => console.warn("Drivers snapshot error:", err)
    );

    // 3. Subscribe to Vehicles
    const unsubVehicles = onSnapshot(
      collection(db, "vehicles"),
      (snap) => {
        const vList: VehicleItem[] = snap.docs.map((v) => ({
          id: v.id,
          ...(v.data() as any),
        }));
        setVehicles(vList);
      },
      (err) => console.warn("Vehicles snapshot error:", err)
    );

    // 4. Operating Entities & Companies for Invoicing
    const unsubEntities = onSnapshot(
      collection(db, "entities"),
      (snap) => {
        setEntities(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn("Entities snapshot error:", err)
    );

    const unsubCompanies = onSnapshot(
      collection(db, "companies"),
      (snap) => {
        setCompanies(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.warn("Companies snapshot error:", err)
    );

    return () => {
      unsubBookings();
      unsubDrivers();
      unsubVehicles();
      unsubEntities();
      unsubCompanies();
    };
  }, [refreshKey]);

  // --- Computed Active Date Range ---
  const dateRange = useMemo(() => {
    return getDashboardDateRange(datePreset, customStartDate, customEndDate);
  }, [datePreset, customStartDate, customEndDate]);

  // --- Filter Bookings by Date Range ---
  const filteredBookings = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return bookings;
    }
    return bookings.filter((b) => {
      const bStart = b.startDate || "";
      const bEnd = b.endDate || b.startDate || "";
      if (bStart && bEnd) {
        return bStart <= dateRange.endDate && bEnd >= dateRange.startDate;
      }
      if (bStart) {
        return bStart >= dateRange.startDate && bStart <= dateRange.endDate;
      }
      return false;
    });
  }, [bookings, dateRange]);

  // --- Filtered by Search & Status in the Table ---
  const displayedTableBookings = useMemo(() => {
    let list = filteredBookings;
    if (statusFilter !== "all") {
      list = list.filter((b) => b.bookingStatus === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.bookingNumber?.toLowerCase().includes(q) ||
          b.customerName?.toLowerCase().includes(q) ||
          b.travelerName?.toLowerCase().includes(q) ||
          b.fromLocation?.toLowerCase().includes(q) ||
          b.toLocation?.toLowerCase().includes(q) ||
          b.driverName?.toLowerCase().includes(q) ||
          b.vehicleRegNumber?.toLowerCase().includes(q) ||
          b.vehicleCategory?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [filteredBookings, statusFilter, searchQuery]);

  // --- Driver Allocation & Occupancy Analysis ---
  const {
    occupiedDriversList,
    freeDriversList,
    occupiedDriversCount,
    freeDriversCount,
    totalDriversCount,
  } = useMemo(() => {
    // Set of driver names and phones assigned to active trips in the filtered period
    const assignedMap = new Map<string, DashboardBooking>();
    filteredBookings.forEach((b) => {
      if (b.bookingStatus !== "Cancelled") {
        if (b.driverName) {
          assignedMap.set(b.driverName.trim().toLowerCase(), b);
        }
        if (b.driverMobile) {
          assignedMap.set(b.driverMobile.trim(), b);
        }
      }
    });

    const activeRegistryDrivers = drivers.filter((d) => d.isActive !== false);

    const occupiedDrivers: {
      driver: DriverItem;
      assignedTrip?: DashboardBooking;
    }[] = [];
    const freeDrivers: DriverItem[] = [];

    activeRegistryDrivers.forEach((d) => {
      const nameKey = (d.fullName || d.name || "").trim().toLowerCase();
      const phoneKey = (d.mobileNumber || d.mobile || "").trim();
      const trip = assignedMap.get(nameKey) || assignedMap.get(phoneKey);

      if (trip || d.availabilityStatus === "On Trip") {
        occupiedDrivers.push({ driver: d, assignedTrip: trip });
      } else {
        freeDrivers.push(d);
      }
    });

    const occupiedCount = Math.max(assignedMap.size, occupiedDrivers.length);
    const totalCount = Math.max(activeRegistryDrivers.length, occupiedCount);
    const freeCount = Math.max(0, totalCount - occupiedCount);

    return {
      occupiedDriversList: occupiedDrivers,
      freeDriversList: freeDrivers,
      occupiedDriversCount: occupiedCount,
      freeDriversCount: freeCount,
      totalDriversCount: totalCount,
    };
  }, [filteredBookings, drivers]);

  // --- Fleet & Vehicle Allocation ---
  const { occupiedVehiclesCount, freeVehiclesCount, totalVehiclesCount } =
    useMemo(() => {
      const assignedVehicles = new Set<string>();
      filteredBookings.forEach((b) => {
        if (b.vehicleRegNumber && b.bookingStatus !== "Cancelled") {
          assignedVehicles.add(b.vehicleRegNumber.trim().toUpperCase());
        }
      });
      const totalCount = Math.max(vehicles.length, assignedVehicles.size);
      const occupiedCount = assignedVehicles.size;
      const freeCount = Math.max(0, totalCount - occupiedCount);
      return {
        occupiedVehiclesCount: occupiedCount,
        freeVehiclesCount: freeCount,
        totalVehiclesCount: totalCount,
      };
    }, [filteredBookings, vehicles]);

  // --- Comprehensive KPI Aggregates ---
  const kpiStats = useMemo(() => {
    let grossRev = 0;
    let advanceCollected = 0;
    let totalKm = 0;
    let newCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let invoicedCount = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;

    filteredBookings.forEach((b) => {
      grossRev += Number(b.grossAmount) || 0;
      advanceCollected += Number(b.customerAdvance) || 0;
      totalKm += Number(b.totalKm) || 0;

      const s = b.bookingStatus;
      if (s === "New") newCount++;
      else if (s === "Trip In Progress") inProgressCount++;
      else if (s === "Trip Completed") completedCount++;
      else if (s === "Invoice Generated" || s === "Invoice Sent")
        invoicedCount++;

      const p = b.paymentStatus;
      if (p === "Paid") paidCount++;
      else if (p === "Partial") partialCount++;
      else unpaidCount++;
    });

    const totalBookings = filteredBookings.length;
    const avgFare = totalBookings > 0 ? Math.round(grossRev / totalBookings) : 0;
    const driverOccupancyRate =
      totalDriversCount > 0
        ? Math.round((occupiedDriversCount / totalDriversCount) * 100)
        : 0;
    const vehicleUtilizationRate =
      totalVehiclesCount > 0
        ? Math.round((occupiedVehiclesCount / totalVehiclesCount) * 100)
        : 0;

    return {
      totalBookings,
      grossRev,
      advanceCollected,
      totalKm,
      avgFare,
      newCount,
      inProgressCount,
      completedCount,
      invoicedCount,
      paidCount,
      partialCount,
      unpaidCount,
      driverOccupancyRate,
      vehicleUtilizationRate,
    };
  }, [
    filteredBookings,
    occupiedDriversCount,
    totalDriversCount,
    occupiedVehiclesCount,
    totalVehiclesCount,
  ]);

  // --- Chart 1: Solid Area Chart (Gross Revenue Trend) ---
  const areaChartData = useMemo(() => {
    if (filteredBookings.length === 0) {
      return [
        { label: "Start", value: 0 },
        { label: "End", value: 0 },
      ];
    }

    // Single day: breakdown by bookings or times
    if (dateRange.totalDays === 1) {
      const sorted = [...filteredBookings].sort((a, b) =>
        (a.startTime || "00:00").localeCompare(b.startTime || "00:00")
      );
      if (sorted.length === 1) {
        return [
          { label: "Start", value: 0 },
          {
            label: sorted[0].startTime || "Trip",
            value: sorted[0].grossAmount || 0,
          },
        ];
      }
      return sorted.map((b) => ({
        label: b.startTime || b.bookingNumber.slice(-4),
        value: b.grossAmount || 0,
      }));
    }

    // Yearly: breakdown by 12 months
    if (datePreset === "this_year" || datePreset === "last_year") {
      const monthTotals = Array(12).fill(0);
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      filteredBookings.forEach((b) => {
        if (b.startDate) {
          const m = parseInt(b.startDate.split("-")[1], 10) - 1;
          if (m >= 0 && m < 12) {
            monthTotals[m] += b.grossAmount || 0;
          }
        }
      });
      return monthNames.map((name, i) => ({
        label: name,
        value: monthTotals[i],
      }));
    }

    // Weekly or Monthly: group by day
    const dayMap = new Map<string, number>();
    filteredBookings.forEach((b) => {
      const d = b.startDate || "Other";
      dayMap.set(d, (dayMap.get(d) || 0) + (b.grossAmount || 0));
    });

    const sortedDates = Array.from(dayMap.keys()).sort();
    if (sortedDates.length === 0) return [{ label: "No Data", value: 0 }];

    return sortedDates.map((d) => {
      const parts = d.split("-");
      const shortLabel =
        parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
      return {
        label: shortLabel,
        value: dayMap.get(d) || 0,
      };
    });
  }, [filteredBookings, dateRange, datePreset]);

  // --- Chart 2: Solid Line Chart (Booking Velocity Trend) ---
  const lineChartData = useMemo(() => {
    if (filteredBookings.length === 0) {
      return [
        { label: "Start", value: 0 },
        { label: "End", value: 0 },
      ];
    }

    if (dateRange.totalDays === 1) {
      const slots = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
      return slots.map((s) => ({
        label: s,
        value: filteredBookings.filter((b) => (b.startTime || "00:00") <= s)
          .length,
      }));
    }

    if (datePreset === "this_year" || datePreset === "last_year") {
      const monthCounts = Array(12).fill(0);
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      filteredBookings.forEach((b) => {
        if (b.startDate) {
          const m = parseInt(b.startDate.split("-")[1], 10) - 1;
          if (m >= 0 && m < 12) {
            monthCounts[m]++;
          }
        }
      });
      return monthNames.map((name, i) => ({
        label: name,
        value: monthCounts[i],
      }));
    }

    const dayMap = new Map<string, number>();
    filteredBookings.forEach((b) => {
      const d = b.startDate || "Other";
      dayMap.set(d, (dayMap.get(d) || 0) + 1);
    });

    const sortedDates = Array.from(dayMap.keys()).sort();
    return sortedDates.map((d) => {
      const parts = d.split("-");
      const shortLabel =
        parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
      return {
        label: shortLabel,
        value: dayMap.get(d) || 0,
      };
    });
  }, [filteredBookings, dateRange, datePreset]);

  // --- Chart 3: Solid Bar Chart (Vehicle Categories Revenue & Trips) ---
  const barChartData = useMemo(() => {
    const catMap = new Map<string, { revenue: number; trips: number }>();
    filteredBookings.forEach((b) => {
      const cat = b.vehicleCategory || "Sedan";
      const existing = catMap.get(cat) || { revenue: 0, trips: 0 };
      existing.revenue += b.grossAmount || 0;
      existing.trips += 1;
      catMap.set(cat, existing);
    });

    if (catMap.size === 0) {
      return [
        { label: "Sedan", value: 0, secondaryValue: 0 },
        { label: "SUV", value: 0, secondaryValue: 0 },
        { label: "Innova", value: 0, secondaryValue: 0 },
      ];
    }

    return Array.from(catMap.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([cat, stats]) => ({
        label: cat,
        value: stats.revenue,
        secondaryValue: stats.trips,
      }));
  }, [filteredBookings]);

  // --- Chart 4: Solid Pie Chart (Trip Status Breakdown) ---
  const pieChartSlices = useMemo(() => {
    return [
      { label: "New Trips", value: kpiStats.newCount, color: "#0284c7" },
      {
        label: "In Progress",
        value: kpiStats.inProgressCount,
        color: "#d97706",
      },
      {
        label: "Completed",
        value: kpiStats.completedCount,
        color: "#7c3aed",
      },
      {
        label: "Invoiced",
        value: kpiStats.invoicedCount,
        color: "#059669",
      },
    ].filter((s) => s.value > 0);
  }, [kpiStats]);

  // --- Chart 5: Solid Donut Chart (Payment Reconciliation) ---
  const paymentDonutSegments = useMemo(() => {
    return [
      { label: "Paid", value: kpiStats.paidCount, color: "#059669" },
      { label: "Partial", value: kpiStats.partialCount, color: "#d97706" },
      { label: "Unpaid", value: kpiStats.unpaidCount, color: "#e11d48" },
    ].filter((s) => s.value > 0);
  }, [kpiStats]);

  // --- Chart 6: Driver Allocation Donut ---
  const driverDonutSegments = useMemo(() => {
    return [
      {
        label: "Occupied Drivers",
        value: occupiedDriversCount,
        color: "#f16623",
      },
      {
        label: "Free / Available",
        value: freeDriversCount,
        color: "#059669",
      },
    ];
  }, [occupiedDriversCount, freeDriversCount]);

  // --- Action Handlers ---

  const handleOpenPrintInvoice = (booking: DashboardBooking) => {
    setSelectedBookingForInvoice(booking as InvoiceBookingData);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenBookingDetail = (booking: DashboardBooking) => {
    setSelectedBookingForDetail(booking);
  };

  const exportBookingsCSV = () => {
    if (displayedTableBookings.length === 0) return;
    const headers = [
      "Booking #",
      "Customer Name",
      "Traveler",
      "Phone",
      "From",
      "To",
      "Start Date",
      "End Date",
      "Vehicle Category",
      "Vehicle Reg #",
      "Driver Name",
      "Driver Phone",
      "Gross Fare",
      "Advance",
      "Status",
      "Payment",
    ];
    const rows = displayedTableBookings.map((b) => [
      `"${b.bookingNumber || ""}"`,
      `"${b.customerName || ""}"`,
      `"${b.travelerName || ""}"`,
      `"${b.travelerMobile || ""}"`,
      `"${b.fromLocation || ""}"`,
      `"${b.toLocation || ""}"`,
      `"${b.startDate || ""}"`,
      `"${b.endDate || ""}"`,
      `"${b.vehicleCategory || ""}"`,
      `"${b.vehicleRegNumber || ""}"`,
      `"${b.driverName || ""}"`,
      `"${b.driverMobile || ""}"`,
      b.grossAmount || 0,
      b.customerAdvance || 0,
      `"${b.bookingStatus || ""}"`,
      `"${b.paymentStatus || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `RK_Travels_Bookings_${dateRange.label.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ===================================================================== */}
      {/* 1. TOP HEADER & LIVE DISPATCH BAR                                     */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Operations Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Fleet Dispatch
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time booking velocity, revenue analytics, driver occupancy, and
            manifest printing.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Refresh analytics data"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-500 ${
                loading ? "animate-spin text-[#f16623]" : ""
              }`}
            />
            <span>Refresh</span>
          </button>

          <Link
            href="/driver-trip-plan"
            className="h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600" />
            <span>Driver Trip Plan</span>
          </Link>

          <Link
            href="/bookings"
            className="h-[34px] px-3.5 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#f16623]/25 active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Booking</span>
          </Link>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. DATE FILTER CONTROL BAR (All requested presets + today default)     */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] p-3 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 h-[34px] rounded-[6px] bg-slate-100 text-slate-700 text-xs font-medium shrink-0">
              <Calendar className="w-3.5 h-3.5 text-[#f16623]" />
              <span>Period:</span>
            </div>

            {DATE_PRESET_BUTTONS.map((btn) => {
              const isActive = datePreset === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setDatePreset(btn.id)}
                  className={`h-[34px] px-3 rounded-[6px] text-xs font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/25"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Range Pill Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-[34px] px-3 rounded-[6px] bg-orange-50/80 border border-orange-200/80 text-[11px] font-medium text-orange-900 flex items-center gap-2">
              <span className="text-[#f16623] font-bold">
                {dateRange.label}:
              </span>
              {dateRange.startDate ? (
                <span className="font-mono">
                  {dateRange.startDate}{" "}
                  {dateRange.endDate &&
                  dateRange.endDate !== dateRange.startDate
                    ? `→ ${dateRange.endDate}`
                    : ""}
                </span>
              ) : (
                <span>All History</span>
              )}
              <span className="bg-[#f16623] text-white px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold">
                {dateRange.totalDays}{" "}
                {dateRange.totalDays === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>

        {/* Custom Range Picker Drawer (visible when 'custom' is selected) */}
        {datePreset === "custom" && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0">
                From Date:
              </label>
              <div className="w-44">
                <CustomDatePicker
                  value={customStartDate}
                  onChange={setCustomStartDate}
                  placeholder="Start Date"
                  className="h-[34px] text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 shrink-0">
                To Date:
              </label>
              <div className="w-44">
                <CustomDatePicker
                  value={customEndDate}
                  onChange={setCustomEndDate}
                  placeholder="End Date"
                  className="h-[34px] text-xs"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3. SIX CORE KPI METRIC CARDS                                           */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Card 1: Total Bookings */}
        <div className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-[#f16623]/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Trips
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-orange-50 text-[#f16623] flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {kpiStats.totalBookings}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">
              {kpiStats.inProgressCount} active
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1.5">
            <span className="text-sky-600 font-medium">{kpiStats.newCount} New</span>
            <span>•</span>
            <span className="text-purple-600 font-medium">
              {kpiStats.completedCount} Done
            </span>
          </div>
        </div>

        {/* Card 2: Gross Trip Revenue */}
        <div className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Gross Revenue
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {formatCompactINR(kpiStats.grossRev)}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
            <span>Adv:</span>
            <span className="font-mono font-medium text-emerald-700">
              ₹{kpiStats.advanceCollected.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Card 3: Driver Roster (Occupied vs Free) */}
        <button
          type="button"
          onClick={() => {
            setDriverRosterFilter("all");
            setIsDriverRosterModalOpen(true);
          }}
          className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-blue-300 text-left transition cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider group-hover:text-blue-600">
              Drivers Status
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {totalDriversCount}
            </span>
            <span className="text-[10px] text-slate-400">Total</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px]">
            <span className="px-1.5 py-0.2 rounded bg-orange-50 text-[#f16623] font-semibold border border-orange-200">
              {occupiedDriversCount} Occupied
            </span>
            <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              {freeDriversCount} Free
            </span>
          </div>
        </button>

        {/* Card 4: Fleet Utilization */}
        <div className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-purple-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Fleet Utilization
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-purple-50 text-purple-600 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {kpiStats.vehicleUtilizationRate}%
            </span>
            <span className="text-[10px] text-purple-700 font-medium">
              {occupiedVehiclesCount} on road
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <span>{freeVehiclesCount} available in yard</span>
          </div>
        </div>

        {/* Card 5: Total Kilometers */}
        <div className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-teal-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Transit Distance
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-teal-50 text-teal-600 flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {kpiStats.totalKm.toLocaleString("en-IN")}
            </span>
            <span className="text-[10px] text-slate-400">KM</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            <span>Avg {kpiStats.totalBookings > 0 ? Math.round(kpiStats.totalKm / kpiStats.totalBookings) : 0} KM / trip</span>
          </div>
        </div>

        {/* Card 6: Average Fare */}
        <div className="bg-white border border-slate-200/90 rounded-[6px] p-3.5 shadow-2xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Avg Ticket Fare
            </span>
            <span className="w-7 h-7 rounded-[5px] bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              ₹{kpiStats.avgFare.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            <span>{kpiStats.paidCount} Fully Reconciled</span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. DRIVER ROSTER QUICK BANNER                                         */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-[6px] p-3.5 text-white flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f16623]/20 border border-[#f16623]/40 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5 text-[#f16623]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white">
              Driver Dispatch Roster: {occupiedDriversCount} Occupied / Assigned,{" "}
              {freeDriversCount} Free for Allocation
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Instant visibility into active trip assignments and available
              standby drivers in the yard.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDriverRosterFilter("occupied");
              setIsDriverRosterModalOpen(true);
            }}
            className="h-[30px] px-3 rounded-[5px] bg-[#f16623] hover:bg-[#d95318] text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Occupied ({occupiedDriversCount})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDriverRosterFilter("free");
              setIsDriverRosterModalOpen(true);
            }}
            className="h-[30px] px-3 rounded-[5px] bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Free Drivers ({freeDriversCount})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 5. VISUAL ANALYTICS & CHARTS GRID                                     */}
      {/* ===================================================================== */}
      <div className="space-y-4">
        {/* Row 1: Area Graph (Revenue) & Line Graph (Booking Velocity) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SolidAreaChart
            title="Revenue Timeline Velocity"
            subtitle={`Gross sales velocity for ${dateRange.label}`}
            data={areaChartData}
            color="#f16623"
            valueFormatter={(val) => `₹${val.toLocaleString("en-IN")}`}
          />

          <SolidLineChart
            title="Booking Ticket Velocity"
            subtitle={`Trip ticket count trajectory for ${dateRange.label}`}
            data={lineChartData}
            lineColor="#2563eb"
            valueFormatter={(val) => `${val} trips`}
          />
        </div>

        {/* Row 2: Bar Graph + Pie Graph + Donut Chart */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bar Chart: Vehicle Categories */}
          <SolidBarChart
            title="Revenue & Trips by Vehicle Category"
            subtitle="Sedan, SUV, Innova Crysta & Tempo performance"
            points={barChartData}
            primaryLabel="Revenue (₹)"
            secondaryLabel="Trips"
            valueFormatter={(val) => `₹${val.toLocaleString("en-IN")}`}
          />

          {/* Pie Chart: Trip Status Breakdown */}
          <SolidPieChart
            title="Trip Status Breakdown"
            subtitle="Current operational lifecycle distribution"
            slices={
              pieChartSlices.length > 0
                ? pieChartSlices
                : [{ label: "No Trips", value: 1, color: "#cbd5e1" }]
            }
            valueFormatter={(val) => `${val} trips`}
          />

          {/* Donut Chart: Payment Reconciliation */}
          <SolidDonutChart
            title="Payment Reconciliation"
            subtitle="Collected advance, paid in full & pending balance"
            segments={
              paymentDonutSegments.length > 0
                ? paymentDonutSegments
                : [{ label: "No Records", value: 1, color: "#cbd5e1" }]
            }
            centerLabel="Gross Sales"
            centerValue={formatCompactINR(kpiStats.grossRev)}
            valueFormatter={(val) => `${val} bookings`}
          />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 6. ORDERS DIRECTORY & RECENT DISPATCH LIST                            */}
      {/* ===================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-[6px] shadow-2xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-3.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Orders Manifest ({displayedTableBookings.length})
            </h3>
            <span className="text-[11px] text-slate-400">
              in {dateRange.label}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trip, client, driver, car..."
                className="w-full h-[32px] pl-8 pr-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Quick Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[32px] px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-[5px] text-slate-700 font-medium focus:outline-none focus:border-[#f16623] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="New">New</option>
              <option value="Trip In Progress">Trip In Progress</option>
              <option value="Trip Completed">Trip Completed</option>
              <option value="Invoice Generated">Invoice Generated</option>
            </select>

            {/* Export CSV */}
            <button
              type="button"
              onClick={exportBookingsCSV}
              disabled={displayedTableBookings.length === 0}
              className="h-[32px] px-2.5 rounded-[5px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Download Orders as CSV"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-medium text-slate-600">
                <th className="py-2.5 px-3">Booking #</th>
                <th className="py-2.5 px-3">Client &amp; Traveler</th>
                <th className="py-2.5 px-3">Route &amp; Dates</th>
                <th className="py-2.5 px-3">Vehicle</th>
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
                    <span>Loading trips manifest...</span>
                  </td>
                </tr>
              ) : displayedTableBookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <CalendarCheck className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                    <p className="text-xs font-medium text-slate-600">
                      No bookings found for {dateRange.label}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try selecting a different date range or clear search
                      filters.
                    </p>
                    <button
                      type="button"
                      onClick={() => setDatePreset("this_month")}
                      className="mt-3 px-3 py-1.5 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                    >
                      View This Month
                    </button>
                  </td>
                </tr>
              ) : (
                displayedTableBookings.map((b) => {
                  const isIndiv =
                    b.clientType === "Individual Customer" ||
                    b.customerType === "Individual Customer";

                  return (
                    <tr
                      key={b.id}
                      onClick={() => handleOpenBookingDetail(b)}
                      className="hover:bg-orange-50/20 transition-colors cursor-pointer group"
                    >
                      {/* 1. Booking # */}
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-medium text-slate-900 group-hover:text-[#f16623] transition">
                          {b.bookingNumber}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {b.tariffPackageName || b.tariffType || "Standard"}
                        </div>
                      </td>

                      {/* 2. Client & Traveler */}
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
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Pax: {b.travelerName || "—"}
                        </div>
                      </td>

                      {/* 3. Route & Dates */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 text-[11px] flex items-center gap-1 font-medium">
                          <span>{b.fromLocation}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                          <span>{b.toLocation}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>
                            {b.startDate} {b.startTime ? `(${b.startTime})` : ""}
                          </span>
                        </div>
                      </td>

                      {/* 4. Vehicle */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900">
                          {b.vehicleCategory || "Sedan"}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                          {b.vehicleRegNumber ? (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              {b.vehicleRegNumber}
                            </span>
                          ) : (
                            <span className="text-amber-600">Unassigned</span>
                          )}
                        </div>
                      </td>

                      {/* 5. Driver */}
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
                          <span className="text-[11px] text-slate-400 italic">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* 6. Gross Amount */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-medium text-slate-900">
                          ₹{(b.grossAmount || 0).toLocaleString("en-IN")}
                        </div>
                        {b.customerAdvance && b.customerAdvance > 0 ? (
                          <div className="text-[10px] font-mono text-emerald-600">
                            Adv: ₹{b.customerAdvance.toLocaleString("en-IN")}
                          </div>
                        ) : null}
                      </td>

                      {/* 7. Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            b.bookingStatus === "New"
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : b.bookingStatus === "Trip In Progress"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : b.bookingStatus === "Trip Completed"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : b.bookingStatus === "Invoice Generated" ||
                                b.bookingStatus === "Invoice Sent"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {b.bookingStatus}
                        </span>
                      </td>

                      {/* 8. Payment Status */}
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

                      {/* 9. Actions */}
                      <td
                        className="py-2.5 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenBookingDetail(b)}
                            className="h-[28px] px-2 rounded-[5px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                            title="View Trip Details"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPrintInvoice(b)}
                            className="h-[28px] px-2.5 rounded-[5px] bg-[#f16623]/10 hover:bg-[#f16623] text-[#f16623] hover:text-white border border-[#f16623]/30 text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                            title="Print Tax Invoice"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Print</span>
                          </button>
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
      {/* 7. BOOKING DETAIL MODAL (Trip Manifest & Info)                         */}
      {/* ===================================================================== */}
      {selectedBookingForDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={() => setSelectedBookingForDetail(null)}
        >
          <div
            className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-[#f16623]/10 border border-[#f16623]/20 flex items-center justify-center text-[#f16623]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-900">
                    {selectedBookingForDetail.bookingNumber}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Trip Particulars &amp; Dispatch Details
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {selectedBookingForDetail.bookingStatus}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedBookingForDetail(null)}
                  className="w-7 h-7 rounded-[5px] text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs">
              {/* Route & Times */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-[6px] p-3 space-y-2">
                <div className="flex items-center justify-between text-slate-900 font-semibold text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#f16623]" />
                    <span>{selectedBookingForDetail.fromLocation}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedBookingForDetail.toLocation}</span>
                  </div>
                  {selectedBookingForDetail.totalKm ? (
                    <span className="font-mono text-xs bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedBookingForDetail.totalKm} KM
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-4 text-slate-500 text-[11px] pt-1 border-t border-slate-200/50">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>
                      {selectedBookingForDetail.startDate} (
                      {selectedBookingForDetail.startTime || "00:00"})
                    </span>
                  </div>
                  <span>to</span>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>
                      {selectedBookingForDetail.endDate} (
                      {selectedBookingForDetail.endTime || "00:00"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Client & Passenger Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-[6px] p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Customer / Corporate
                  </span>
                  <div className="font-bold text-slate-900 text-xs">
                    {selectedBookingForDetail.customerName}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Type: {selectedBookingForDetail.clientType || "Company"}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-[6px] p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Traveler / Pax
                  </span>
                  <div className="font-bold text-slate-900 text-xs">
                    {selectedBookingForDetail.travelerName || "—"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Mobile: {selectedBookingForDetail.travelerMobile || "—"}
                  </div>
                </div>
              </div>

              {/* Assignment (Vehicle & Driver) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-slate-200 rounded-[6px] p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                    <Car className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vehicle Details</span>
                  </div>
                  <div className="text-slate-900 font-medium text-xs mt-1">
                    Category: {selectedBookingForDetail.vehicleCategory || "Sedan"}
                  </div>
                  <div className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded w-max text-[11px]">
                    {selectedBookingForDetail.vehicleRegNumber || "Not Assigned"}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-[6px] p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Assigned Driver</span>
                  </div>
                  <div className="text-slate-900 font-medium text-xs mt-1">
                    {selectedBookingForDetail.driverName || "Not Assigned"}
                  </div>
                  {selectedBookingForDetail.driverMobile && (
                    <a
                      href={`tel:${selectedBookingForDetail.driverMobile}`}
                      className="text-blue-600 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <PhoneCall className="w-2.5 h-2.5" />
                      <span>{selectedBookingForDetail.driverMobile}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Commercials Summary */}
              <div className="border border-slate-200 rounded-[6px] p-3 space-y-2 bg-slate-50/50">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                  <span>Fare &amp; Commercials Breakdown</span>
                  <span className="font-mono text-sm text-[#f16623]">
                    ₹{(selectedBookingForDetail.grossAmount || 0).toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                  <div>
                    <span>Base Fare: </span>
                    <span className="font-mono font-medium">
                      ₹{(selectedBookingForDetail.baseFare || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span>Customer Advance: </span>
                    <span className="font-mono font-medium text-emerald-600">
                      ₹{(selectedBookingForDetail.customerAdvance || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span>Payment Status: </span>
                    <span className="font-semibold text-slate-900">
                      {selectedBookingForDetail.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <button
                type="button"
                onClick={() => setSelectedBookingForDetail(null)}
                className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const b = selectedBookingForDetail;
                  setSelectedBookingForDetail(null);
                  handleOpenPrintInvoice(b);
                }}
                className="h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium transition flex items-center gap-2 cursor-pointer shadow-xs shadow-[#f16623]/25 active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tax Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. DRIVER ROSTER MODAL (Occupied vs Free Drivers Directory)            */}
      {/* ===================================================================== */}
      {isDriverRosterModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50 duration-150"
          onClick={() => setIsDriverRosterModalOpen(false)}
        >
          <div
            className="bg-white rounded-[8px] border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Live Driver Dispatch Roster
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {occupiedDriversCount} Occupied on duty • {freeDriversCount} Free for assignment
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDriverRosterModalOpen(false)}
                className="w-7 h-7 rounded-[5px] text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDriverRosterFilter("all")}
                className={`px-3 py-1 rounded-[5px] text-xs font-medium transition cursor-pointer ${
                  driverRosterFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Drivers ({totalDriversCount})
              </button>
              <button
                type="button"
                onClick={() => setDriverRosterFilter("occupied")}
                className={`px-3 py-1 rounded-[5px] text-xs font-medium transition cursor-pointer ${
                  driverRosterFilter === "occupied"
                    ? "bg-orange-50 text-[#f16623] font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Occupied ({occupiedDriversCount})
              </button>
              <button
                type="button"
                onClick={() => setDriverRosterFilter("free")}
                className={`px-3 py-1 rounded-[5px] text-xs font-medium transition cursor-pointer ${
                  driverRosterFilter === "free"
                    ? "bg-emerald-50 text-emerald-700 font-semibold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Free Standby ({freeDriversCount})
              </button>
            </div>

            {/* List */}
            <div className="p-4 overflow-y-auto space-y-2.5 max-h-[60vh]">
              {driverRosterFilter !== "free" &&
                occupiedDriversList.map(({ driver, assignedTrip }) => (
                  <div
                    key={`occ-${driver.id}`}
                    className="p-3 rounded-[6px] border border-orange-200 bg-orange-50/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {driver.fullName || driver.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-orange-100 text-[#f16623]">
                          On Trip
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <PhoneCall className="w-3 h-3 text-slate-400" />
                          <span>{driver.mobileNumber || driver.mobile || "—"}</span>
                        </span>
                        {assignedTrip && (
                          <span className="text-slate-700 font-mono">
                            Trip: {assignedTrip.bookingNumber} ({assignedTrip.toLocation})
                          </span>
                        )}
                      </div>
                    </div>

                    {driver.mobileNumber && (
                      <a
                        href={`tel:${driver.mobileNumber}`}
                        className="px-2.5 py-1 rounded-[5px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-600" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                ))}

              {driverRosterFilter !== "occupied" &&
                freeDriversList.map((driver) => (
                  <div
                    key={`free-${driver.id}`}
                    className="p-3 rounded-[6px] border border-emerald-200 bg-emerald-50/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {driver.fullName || driver.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                          Available / Free
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <PhoneCall className="w-3 h-3 text-slate-400" />
                          <span>{driver.mobileNumber || driver.mobile || "—"}</span>
                        </span>
                        <span>DL: {driver.dlNumber || driver.licenseNumber || "Verified"}</span>
                      </div>
                    </div>

                    {driver.mobileNumber && (
                      <a
                        href={`tel:${driver.mobileNumber}`}
                        className="px-2.5 py-1 rounded-[5px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition inline-flex items-center gap-1"
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-600" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                ))}

              {totalDriversCount === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No drivers registered in fleet roster.
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDriverRosterModalOpen(false)}
                className="h-[32px] px-4 rounded-[6px] bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. TAX INVOICE MODAL (Full formatted print & PDF preview)             */}
      {/* ===================================================================== */}
      <TaxInvoiceModal
        isOpen={isInvoiceModalOpen}
        onClose={() => {
          setIsInvoiceModalOpen(false);
          setSelectedBookingForInvoice(null);
        }}
        booking={selectedBookingForInvoice}
        entityData={
          selectedBookingForInvoice?.entityId
            ? entities.find((e) => e.id === selectedBookingForInvoice.entityId)
            : entities[0]
        }
        companyData={
          selectedBookingForInvoice?.customerName
            ? companies.find(
                (c) =>
                  c.name?.toLowerCase() ===
                  selectedBookingForInvoice.customerName?.toLowerCase()
              )
            : null
        }
      />
    </div>
  );
}
