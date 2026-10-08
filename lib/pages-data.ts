import {
  LayoutDashboard,
  CalendarCheck,
  Route,
  CreditCard,
  WalletCards,
  Users,
  Building2,
  Layers,
  UserCheck,
  Car,
  UserCog,
  ShieldCheck,
  Compass,
  Tags,
  Briefcase,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export interface PageModuleInfo {
  id: string;
  name: string;
  href: string;
  category: string;
  icon: LucideIcon;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  plannedFeatures: [string, string, string];
}

export const NAV_ITEMS: PageModuleInfo[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    href: "/dashboard",
    category: "MAIN OVERVIEW",
    icon: LayoutDashboard,
    description:
      "Executive KPI dashboard with booking analytics, fleet utilization, real-time trip revenue, and driver performance tracking.",
    primaryAction: "Dashboard",
    secondaryAction: "Open Quick Dispatch",
    plannedFeatures: [
      "Real-time revenue, gross margin & total trip ticket counters",
      "Today's hourly booking velocity graph & vehicle status metrics",
      "Low balance warnings & pending driver allocation alerts",
    ],
  },
  {
    id: "bookings",
    name: "Bookings",
    href: "/bookings",
    category: "OPERATIONS",
    icon: CalendarCheck,
    description:
      "Centralized booking management engine for one-way, round-trip, local rental, and outstation corporate transit schedules.",
    primaryAction: "New Booking",
    secondaryAction: "Dispatch Calendar",
    plannedFeatures: [
      "Live trip dispatch console with instant WhatsApp passenger confirmations",
      "Dynamic distance & toll-integrated fare calculation engine",
      "Multi-stop scheduling, passenger manifests & cancelation workflows",
    ],
  },
  {
    id: "entities",
    name: "Entities",
    href: "/entities",
    category: "OPERATIONS",
    icon: Route,
    description:
      "Operating entities and agency contacts registry. Manage partner travels, business branches, dispatch networks, and direct phone lines.",
    primaryAction: "Add Entity",
    secondaryAction: "Entities Directory",
    plannedFeatures: [
      "Direct entity & travel operator database with instant call & WhatsApp connect",
      "Real-time Firebase Firestore synchronization and offline caching",
      "Associated vehicles, driver roster and active trip assignment",
    ],
  },
  {
    id: "payments",
    name: "Payments",
    href: "/payments",
    category: "FINANCIALS",
    icon: CreditCard,
    description:
      "Omnichannel payment reconciliation console tracking cash collections, UPI payouts, card swipes, and bank deposits.",
    primaryAction: "Record Payment",
    secondaryAction: "Settlement Reports",
    plannedFeatures: [
      "Automated UPI QR generation & instant webhook payment verification",
      "Driver trip cash handover ledger & branch day-close auditing",
      "Payment gateway reconciliation & refund processing matrix",
    ],
  },
  {
    id: "credit",
    name: "Credit",
    href: "/credit",
    category: "FINANCIALS",
    icon: WalletCards,
    description:
      "Corporate credit limit controller, account receivable aging analysis, and recurring client invoice ledgers.",
    primaryAction: "Credit Ledger",
    secondaryAction: "Due Reminders",
    plannedFeatures: [
      "B2B corporate client credit limits & overdue aging analysis",
      "Automated invoice dispatch with automated payment reminder links",
      "Partial credit settlements & outstanding balance adjustment logs",
    ],
  },
  {
    id: "customers",
    name: "Customers",
    href: "/customers",
    category: "CRM & CLIENTS",
    icon: Users,
    description:
      "Customer 360 directory with lifetime trip history, loyalty credits, corporate affiliations, and preferences.",
    primaryAction: "Add Customer",
    secondaryAction: "Customer Directory",
    plannedFeatures: [
      "Comprehensive trip history, frequent route preferences & rating records",
      "Loyalty rewards, promotional discount tiers & referral tracking",
      "Corporate billing profiles with customized tax invoices",
    ],
  },
  {
    id: "companies",
    name: "Companies",
    href: "/companies",
    category: "CRM & CLIENTS",
    icon: Building2,
    description:
      "B2B corporate clients, corporate booking accounts, billing ledgers, and credit agreements.",
    primaryAction: "Add Company",
    secondaryAction: "Companies Directory",
    plannedFeatures: [
      "Corporate client profiles with custom invoicing & PAN validation",
      "Authorized corporate booking contacts & travel approval desks",
      "B2B credit limits, billing cycles & aging account balances",
    ],
  },
  {
    id: "tariffs",
    name: "Tariffs",
    href: "/tariffs",
    category: "COMMERCIAL",
    icon: Tags,
    description:
      "Tariff configuration, rental packages, per-kilometer rate slabs, and surge pricing model management.",
    primaryAction: "Add Tariff",
    secondaryAction: "Tariff Matrix",
    plannedFeatures: [
      "Hourly, daily & outstation package pricing rules configuration",
      "Vehicle category-based base fares, extra km and waiting charge rules",
      "Seasonal surge multiplier & holiday premium tariff scheduler",
    ],
  },
  {
    id: "drivers",
    name: "Drivers",
    href: "/drivers",
    category: "FLEET & CREW",
    icon: UserCheck,
    description:
      "Driver onboarding repository, badge compliance, background checks, duty rosters, and trip earnings.",
    primaryAction: "Onboard Driver",
    secondaryAction: "Duty Roster",
    plannedFeatures: [
      "Live GPS status, active duty shifts & vehicle assignment pairing",
      "Commercial driving license, badge & police verification expiry alerts",
      "Performance incentives, customer rating logs & tip disbursements",
    ],
  },
  {
    id: "driver-trip-plan",
    name: "Driver Trip Plan",
    href: "/driver-trip-plan",
    category: "FLEET & CREW",
    icon: Compass,
    description:
      "Chronological driver trip manifest, timing-ordered run sheets, and on-trip fare settlement with completion logging.",
    primaryAction: "Trip Manifest",
    secondaryAction: "Driver Dispatch",
    plannedFeatures: [
      "Chronological timing-wise itinerary (earliest trip first)",
      "Instant trip completion with passenger payment settlement",
      "Real-time fare reconciliation with payments register",
    ],
  },
  {
    id: "vehicles",
    name: "Vehicles",
    href: "/vehicles",
    category: "FLEET & CREW",
    icon: Car,
    description:
      "Complete fleet inventory management, RC documents, insurance expiry, fitness certification, and GPS telemetry.",
    primaryAction: "Add Vehicle",
    secondaryAction: "Fleet Live Map",
    plannedFeatures: [
      "Live GPS odometer, real-time speed alerts & geofence monitoring",
      "Pollution, insurance, fitness certificate & permit renewal calendar",
      "Scheduled preventive maintenance, tire replacement & service logs",
    ],
  },
  {
    id: "vehicle-categories",
    name: "Vehicle Categories",
    href: "/vehicle-categories",
    category: "FLEET & CREW",
    icon: Tags,
    description:
      "Vehicle category definitions, seating capacities with auto driver calculation, AC / Non-AC tiers, and invoice print names.",
    primaryAction: "Add Category",
    secondaryAction: "View Categories",
    plannedFeatures: [
      "Custom seating capacity configuration with automatic driver calculation",
      "Print name customization for invoices, vouchers & trip tickets",
      "Instant active/inactive status toggle and Firestore synchronization",
    ],
  },
  {
    id: "car-vendors",
    name: "Car Vendors",
    href: "/car-vendors",
    category: "FLEET & CREW",
    icon: Briefcase,
    description:
      "Registry for attached car vendors and leasing partners. Manage contact profiles, mobile numbers, city locations, and linked fleet vehicles.",
    primaryAction: "Add Vendor",
    secondaryAction: "Vendor Directory",
    plannedFeatures: [
      "Dedicated vendor and leasing member registry with phone, email, and address",
      "Instant linkage to attached and leased fleet vehicles",
      "Real-time Firestore synchronization with 2-item pagination controls",
    ],
  },
  {
    id: "locations",
    name: "Locations",
    href: "/locations",
    category: "MASTERS",
    icon: MapPin,
    description:
      "All-India States and Cities directory master. Manage geographical coverage, operating hubs, state codes, and city transit locations.",
    primaryAction: "Add Location",
    secondaryAction: "Bulk Upload",
    plannedFeatures: [
      "All-India 28 States and 8 Union Territories with major commercial cities",
      "Bulk CSV/Excel upload and instant 1-click seeding of states and cities",
      "Real-time Firestore synchronization with 24-item pagination",
    ],
  },
  {
    id: "employees",
    name: "Employees",
    href: "/employees",
    category: "HUMAN RESOURCES",
    icon: UserCog,
    description:
      "Company employee database covering dispatch operators, customer support executives, and sales personnel.",
    primaryAction: "Add Employee",
    secondaryAction: "Attendance Log",
    plannedFeatures: [
      "Shift scheduling, biometric attendance & payroll calculation integration",
      "Role-based departmental assignments and reporting hierarchies",
      "Employee performance KPIs, booking conversion & ticket metrics",
    ],
  },
  {
    id: "staff",
    name: "Staff",
    href: "/staff",
    category: "SYSTEM & ACCESS",
    icon: ShieldCheck,
    description:
      "System administration, role-based access permissions (RBAC), security audit logs, and branch-level privileges.",
    primaryAction: "Manage Roles",
    secondaryAction: "Audit Logs",
    plannedFeatures: [
      "Granular role-based permissions matrix (Admin, Manager, Dispatcher)",
      "Two-factor authentication (2FA) & active session security monitors",
      "Tamper-proof audit logs recording all data edits and exports",
    ],
  },
];

export function getPageModuleInfo(idOrPath: string): PageModuleInfo {
  const clean = idOrPath.replace(/^\//, "").toLowerCase();
  const found = NAV_ITEMS.find(
    (item) => item.id === clean || item.href === `/${clean}`
  );
  return found || NAV_ITEMS[0];
}
