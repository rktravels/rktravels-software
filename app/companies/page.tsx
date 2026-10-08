"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  User,
  Phone,
  Mail,
  Receipt,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Eye,
  MapPin,
  CreditCard,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Briefcase,
  Users2,
  Tag,
  ArrowRight,
  Info,
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

// Indian States & State Codes
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

export interface CompanyItem {
  id: string;
  // Tab 1: Profile
  legalName: string;
  companyName: string; // for backward compatibility
  tradeName?: string | null;
  customerType: "Company" | "Individual";
  pan?: string | null;
  vendorCode?: string | null;

  // Tab 2: Place of Supply
  isReverseCharge?: boolean;
  billingState: string;

  // Tab 3: Address & Contact
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  country?: string | null;
  pinCode?: string | null;
  address?: string | null; // combined string

  // Office Contact Section
  officeContactName: string;
  officeContactEmail: string;
  officeContactPhone: string;
  contactPerson?: string; // fallback alias
  name?: string; // fallback alias
  mobile?: string; // fallback alias
  email?: string | null; // fallback alias

  // Accounts Contact Section
  accountsContactName?: string | null;
  accountsContactEmail?: string | null;
  accountsContactPhone?: string | null;

  // Tab 4: Invoicing Defaults
  invoiceDefaultMode: "Cash" | "Credit";
  creditTerms?: "7 Days" | "15 Days" | "30 Days" | "Immediately" | "Custom" | string;
  customCreditDays?: string | null;
  notesInstructions?: string | null;

  // Tab 5: Status
  isActive: boolean;
  sourceCollection?: "companies" | "business_owners";
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

// Generate 50 realistic B2B companies sample CSV
function generateSample50CompaniesCSV(): string {
  const headers = [
    "Legal Name",
    "Trade Name",
    "Customer Type",
    "PAN",
    "Vendor Code",
    "Reverse Charge",
    "Billing State",
    "Address Line 1",
    "Address Line 2",
    "City",
    "Country",
    "PIN Code",
    "Office Contact Name",
    "Office Contact Email",
    "Office Contact Phone",
    "Accounts Contact Name",
    "Accounts Contact Email",
    "Accounts Contact Phone",
    "Invoice Default Mode",
    "Credit Terms",
    "Custom Credit Days",
    "Notes",
    "Status",
  ];

  const companiesPool = [
    { legal: "Tata Consultancy Services Limited", trade: "TCS", type: "Company", city: "Hyderabad", state: "TS", pin: "500081" },
    { legal: "Infosys Technologies Limited", trade: "Infosys", type: "Company", city: "Bengaluru", state: "KA", pin: "560100" },
    { legal: "Dr. Reddy's Laboratories Ltd", trade: "Dr. Reddy's", type: "Company", city: "Hyderabad", state: "TS", pin: "500034" },
    { legal: "Wipro Enterprises Limited", trade: "Wipro", type: "Company", city: "Bengaluru", state: "KA", pin: "560035" },
    { legal: "Larsen & Toubro Infotech Ltd", trade: "L&T Infotech", type: "Company", city: "Mumbai", state: "MH", pin: "400072" },
    { legal: "Hetero Drugs Limited", trade: "Hetero Pharma", type: "Company", city: "Hyderabad", state: "TS", pin: "500018" },
    { legal: "Apollo Hospitals Enterprise Ltd", trade: "Apollo Health", type: "Company", city: "Chennai", state: "TN", pin: "600006" },
    { legal: "Tech Mahindra Limited", trade: "Tech Mahindra", type: "Company", city: "Pune", state: "MH", pin: "411014" },
    { legal: "Megha Engineering & Infrastructures Ltd", trade: "MEIL", type: "Company", city: "Hyderabad", state: "TS", pin: "500037" },
    { legal: "Cyient Limited", trade: "Cyient", type: "Company", city: "Hyderabad", state: "TS", pin: "500084" },
  ];

  const officers = [
    { offName: "Ramesh Sharma", offEmail: "admin@corp.in", offPhone: "9876543210", accName: "Sanjay Gupta", accEmail: "accounts@corp.in", accPhone: "9876543211" },
    { offName: "Priya Sundaram", offEmail: "travel@corp.in", offPhone: "9848022338", accName: "Kavita Rao", accEmail: "finance@corp.in", accPhone: "9848022339" },
    { offName: "Vikram Malhotra", offEmail: "procurement@corp.in", offPhone: "9988776655", accName: "Sunil Verma", accEmail: "billing@corp.in", accPhone: "9988776656" },
    { offName: "Ananya Deshmukh", offEmail: "admin.desk@corp.in", offPhone: "9822011223", accName: "Rajesh Shinde", accEmail: "payables@corp.in", accPhone: "9822011224" },
    { offName: "K. Murali Krishna", offEmail: "dispatch@corp.in", offPhone: "9440155667", accName: "V. Lakshmi", accEmail: "audit@corp.in", accPhone: "9440155668" },
  ];

  const creditTermsList = ["15 Days", "30 Days", "7 Days", "Custom", "Immediately"];
  const rows: string[][] = [];

  for (let i = 1; i <= 50; i++) {
    const comp = companiesPool[(i - 1) % companiesPool.length];
    const off = officers[(i - 1) % officers.length];
    const legal = i > 10 ? `${comp.legal} - Branch ${Math.floor(i / 10) + 1}` : comp.legal;
    const pan = `AAACB${String(1000 + i)}L`;
    const vcode = `RK-VND-${1000 + i}`;
    const mode = i % 4 === 0 ? "Cash" : "Credit";
    const term = mode === "Cash" ? "Immediately" : creditTermsList[(i - 1) % creditTermsList.length];
    const customDays = term === "Custom" ? String(45 + (i % 3) * 15) : "";

    rows.push([
      legal,
      comp.trade,
      comp.type,
      pan,
      vcode,
      i % 6 === 0 ? "Yes" : "No",
      comp.state,
      `Plot No ${i * 4}, Tech Enclave, Sector ${i % 5 + 1}`,
      `Phase ${(i % 3) + 1}, IT Corridor`,
      comp.city,
      "India",
      comp.pin,
      off.offName,
      `corp${i}.${off.offEmail}`,
      off.offPhone,
      off.accName,
      `acc${i}.${off.accEmail}`,
      off.accPhone,
      mode,
      term,
      customDays,
      "Official corporate transit account.",
      "Active",
    ]);
  }

  const csvLines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")),
  ];

  return csvLines.join("\n");
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Pagination states (Limit: 24 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // OffCanvas Drawer states
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<"companies" | "business_owners">("companies");
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [unlockedTabs, setUnlockedTabs] = useState<number[]>([1]);

  // Tab 1 Form States (Profile)
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [customerType, setCustomerType] = useState<"Company" | "Individual">("Company");
  const [pan, setPan] = useState("");
  const [vendorCode, setVendorCode] = useState("");

  // Tab 2 Form States (Place of Supply)
  const [billingState, setBillingState] = useState("TS");

  // Tab 3 Form States (Address & Contact)
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("India");
  const [pinCode, setPinCode] = useState("");

  // Office Contact
  const [officeContactName, setOfficeContactName] = useState("");
  const [officeContactEmail, setOfficeContactEmail] = useState("");
  const [officeContactPhone, setOfficeContactPhone] = useState("");

  // Accounts Contact
  const [accountsContactName, setAccountsContactName] = useState("");
  const [accountsContactEmail, setAccountsContactEmail] = useState("");
  const [accountsContactPhone, setAccountsContactPhone] = useState("");

  // Tab 4 Form States (Invoicing Defaults)
  const [invoiceDefaultMode, setInvoiceDefaultMode] = useState<"Cash" | "Credit">("Credit");
  const [creditTerms, setCreditTerms] = useState<string>("30 Days");
  const [customCreditDays, setCustomCreditDays] = useState("");
  const [notesInstructions, setNotesInstructions] = useState("");

  // Tab 5 Form States (Status)
  const [isActive, setIsActive] = useState(true);

  // Bulk Upload states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedCompanies, setParsedCompanies] = useState<Partial<CompanyItem>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // View Drawer state
  const [viewingCompany, setViewingCompany] = useState<CompanyItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete modal state
  const [deletingCompany, setDeletingCompany] = useState<CompanyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Validation & Feedback
  const [tabError, setTabError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Real-time Firestore Listener with 24 item query limit
  useEffect(() => {
    const fetchLimit = Math.max(24, currentPage * 24);
    let companiesList: CompanyItem[] = [];
    let legacyList: CompanyItem[] = [];

    const updateCombined = () => {
      const map = new Map<string, CompanyItem>();
      companiesList.forEach((c) => map.set(c.id, c));
      legacyList.forEach((l) => {
        const exists = Array.from(map.values()).some(
          (c) => c.legalName.toLowerCase().trim() === l.legalName.toLowerCase().trim()
        );
        if (!exists) map.set(l.id, l);
      });

      const combined = Array.from(map.values()).sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setCompanies(combined);
      setLoading(false);
    };

    // 1. Primary companies collection
    const qCompanies = query(
      collection(db, "companies"),
      orderBy("createdAt", "desc"),
      limit(fetchLimit)
    );
    const unsubCompanies = onSnapshot(
      qCompanies,
      (snapshot) => {
        companiesList = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            sourceCollection: "companies",
            legalName: d.legalName || d.companyName || "Unnamed Company",
            companyName: d.companyName || d.legalName || "Unnamed Company",
            tradeName: d.tradeName || null,
            customerType: d.customerType || "Company",
            pan: d.pan || d.panNumber || null,
            vendorCode: d.vendorCode || null,
            isReverseCharge: Boolean(d.isReverseCharge),
            billingState: d.billingState || "TS",
            addressLine1: d.addressLine1 || null,
            addressLine2: d.addressLine2 || null,
            city: d.city || null,
            country: d.country || "India",
            pinCode: d.pinCode || null,
            address: d.address || [d.addressLine1, d.addressLine2, d.city].filter(Boolean).join(", "),
            officeContactName: d.officeContactName || d.contactPerson || d.name || "",
            officeContactEmail: d.officeContactEmail || d.email || "",
            officeContactPhone: d.officeContactPhone || d.mobile || "",
            contactPerson: d.officeContactName || d.contactPerson || d.name || "",
            mobile: d.officeContactPhone || d.mobile || "",
            email: d.officeContactEmail || d.email || null,
            accountsContactName: d.accountsContactName || null,
            accountsContactEmail: d.accountsContactEmail || null,
            accountsContactPhone: d.accountsContactPhone || null,
            invoiceDefaultMode: d.invoiceDefaultMode || "Credit",
            creditTerms: d.creditTerms || "30 Days",
            customCreditDays: d.customCreditDays || null,
            notesInstructions: d.notesInstructions || null,
            isActive: d.isActive !== false,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });
        updateCombined();
      },
      () => {
        // Fallback
        const fallbackQ = query(collection(db, "companies"), limit(fetchLimit));
        onSnapshot(fallbackQ, (snapshot) => {
          companiesList = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            sourceCollection: "companies",
            ...(docSnap.data() as any),
          }));
          updateCombined();
        });
      }
    );

    // 2. Legacy business_owners collection
    const qLegacy = query(collection(db, "business_owners"), limit(fetchLimit));
    const unsubLegacy = onSnapshot(qLegacy, (snapshot) => {
      legacyList = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          sourceCollection: "business_owners",
          legalName: d.companyName || d.name || "Corporate Client",
          companyName: d.companyName || d.name || "Corporate Client",
          tradeName: null,
          customerType: "Company",
          pan: null,
          vendorCode: null,
          isReverseCharge: false,
          billingState: "TS",
          city: d.city || null,
          address: d.address || null,
          officeContactName: d.name || "",
          officeContactEmail: d.email || "",
          officeContactPhone: d.mobile || "",
          contactPerson: d.name || "",
          mobile: d.mobile || "",
          email: d.email || null,
          invoiceDefaultMode: "Credit",
          creditTerms: "30 Days",
          isActive: true,
          createdAt: d.createdAt,
        };
      });
      updateCombined();
    });

    return () => {
      unsubCompanies();
      unsubLegacy();
    };
  }, [currentPage]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Open Drawer in Add Mode
  const handleOpenAddDrawer = () => {
    setEditingCompanyId(null);
    setEditingSource("companies");
    setActiveTab(1);
    setUnlockedTabs([1]);
    setTabError(null);

    // Reset Form
    setLegalName("");
    setTradeName("");
    setCustomerType("Company");
    setPan("");
    setVendorCode("");
    setBillingState("TS");

    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setCountry("India");
    setPinCode("");

    setOfficeContactName("");
    setOfficeContactEmail("");
    setOfficeContactPhone("");

    setAccountsContactName("");
    setAccountsContactEmail("");
    setAccountsContactPhone("");

    setInvoiceDefaultMode("Credit");
    setCustomCreditDays("");
    setNotesInstructions("");

    setIsActive(true);
    setIsOffCanvasOpen(true);
  };

  // Open Drawer in Edit Mode
  const handleOpenEditDrawer = (comp: CompanyItem) => {
    setEditingCompanyId(comp.id);
    setEditingSource(comp.sourceCollection || "companies");
    setActiveTab(1);
    setUnlockedTabs([1, 2, 3, 4, 5]); // all tabs unlocked in edit
    setTabError(null);

    setLegalName(comp.legalName || comp.companyName || "");
    setTradeName(comp.tradeName || "");
    setCustomerType(comp.customerType || "Company");
    setPan(comp.pan || "");
    setVendorCode(comp.vendorCode || "");
    setBillingState(comp.billingState || "TS");

    setAddressLine1(comp.addressLine1 || "");
    setAddressLine2(comp.addressLine2 || "");
    setCity(comp.city || "");
    setCountry(comp.country || "India");
    setPinCode(comp.pinCode || "");

    setOfficeContactName(comp.officeContactName || comp.contactPerson || comp.name || "");
    setOfficeContactEmail(comp.officeContactEmail || comp.email || "");
    setOfficeContactPhone(comp.officeContactPhone || comp.mobile || "");

    setAccountsContactName(comp.accountsContactName || "");
    setAccountsContactEmail(comp.accountsContactEmail || "");
    setAccountsContactPhone(comp.accountsContactPhone || "");

    setInvoiceDefaultMode(comp.invoiceDefaultMode || "Credit");
    setCustomCreditDays(comp.customCreditDays || "");
    setNotesInstructions(comp.notesInstructions || "");

    setIsActive(comp.isActive !== false);
    setIsOffCanvasOpen(true);
  };

  // Step Validation before Continuing
  const validateTab = (tabIndex: number): boolean => {
    setTabError(null);

    // Tab 1: Profile
    if (tabIndex === 1) {
      if (!legalName.trim()) {
        setTabError("Please enter company Legal Name.");
        return false;
      }
      if (!customerType) {
        setTabError("Please select Customer Type (Company or Individual).");
        return false;
      }
      return true;
    }

    // Tab 2: Place of Supply
    if (tabIndex === 2) {
      if (!billingState) {
        setTabError("Please select the Billing State.");
        return false;
      }
      return true;
    }

    // Tab 3: Address & Contact
    if (tabIndex === 3) {
      if (!officeContactName.trim()) {
        setTabError("Please enter Office Contact Name.");
        return false;
      }
      if (!officeContactEmail.trim() || !officeContactEmail.includes("@")) {
        setTabError("Please enter a valid Office Contact Email.");
        return false;
      }
      if (!officeContactPhone.trim()) {
        setTabError("Please enter Office Contact Mobile Phone number.");
        return false;
      }
      return true;
    }

    // Tab 4: Invoicing Defaults
    if (tabIndex === 4) {
      if (invoiceDefaultMode === "Credit" && creditTerms === "Custom") {
        if (!customCreditDays.trim() || parseInt(customCreditDays, 10) < 1) {
          setTabError("Please specify Custom Credit Term Days (minimum 1 day).");
          return false;
        }
      }
      return true;
    }

    return true;
  };

  // Handle Tab Continue
  const handleContinue = (nextTab: 2 | 3 | 4 | 5) => {
    const currentTab = (nextTab - 1) as 1 | 2 | 3 | 4;
    if (!validateTab(currentTab)) return;

    if (!unlockedTabs.includes(nextTab)) {
      setUnlockedTabs((prev) => [...prev, nextTab]);
    }
    setActiveTab(nextTab);
  };

  // Final Form Submit (Save / Update Company)
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setTabError(null);

    // Validate tabs 1, 2, 3, 4
    if (!validateTab(1) || !validateTab(2) || !validateTab(3) || !validateTab(4)) {
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedAddress = [addressLine1.trim(), addressLine2.trim(), city.trim()]
        .filter(Boolean)
        .join(", ");

      const payload = {
        legalName: legalName.trim(),
        companyName: legalName.trim(), // backward-compatible alias
        tradeName: tradeName.trim() || null,
        customerType,
        pan: pan.trim().toUpperCase() || null,
        vendorCode: vendorCode.trim() || null,

        billingState,

        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        city: city.trim() || null,
        country: country.trim() || "India",
        pinCode: pinCode.trim() || null,
        address: combinedAddress || null,

        // Office Contact
        officeContactName: officeContactName.trim(),
        officeContactEmail: officeContactEmail.trim(),
        officeContactPhone: officeContactPhone.trim(),
        // Aliases for booking compatibility
        contactPerson: officeContactName.trim(),
        name: officeContactName.trim(),
        mobile: officeContactPhone.trim(),
        email: officeContactEmail.trim() || null,

        // Accounts Contact
        accountsContactName: accountsContactName.trim() || null,
        accountsContactEmail: accountsContactEmail.trim() || null,
        accountsContactPhone: accountsContactPhone.trim() || null,

        // Invoicing Defaults
        invoiceDefaultMode,
        creditTerms: invoiceDefaultMode === "Credit" ? creditTerms : "Immediately",
        customCreditDays:
          invoiceDefaultMode === "Credit" && creditTerms === "Custom"
            ? customCreditDays.trim()
            : null,
        notesInstructions: notesInstructions.trim() || null,

        isActive,
        updatedAt: serverTimestamp(),
      };

      if (editingCompanyId) {
        const targetCol = editingSource === "business_owners" ? "business_owners" : "companies";
        await updateDoc(doc(db, targetCol, editingCompanyId), payload);
        setFeedback({
          type: "success",
          message: `Company "${payload.legalName}" updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "companies"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Company "${payload.legalName}" registered successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving company:", err);
      const msg = err instanceof Error ? err.message : "Failed to save company.";
      setTabError(`Save failed: ${msg}`);
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Download Sample 50 Companies CSV
  const handleDownloadSampleFile = () => {
    const csvContent = generateSample50CompaniesCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_50_companies.csv");
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

      const parsed: Partial<CompanyItem>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[0]) continue;

        const mode = (cols[18] as any) === "Cash" ? "Cash" : "Credit";

        parsed.push({
          legalName: cols[0],
          companyName: cols[0],
          tradeName: cols[1] || null,
          customerType: (cols[2] as any) === "Individual" ? "Individual" : "Company",
          pan: cols[3]?.toUpperCase() || null,
          vendorCode: cols[4] || null,
          isReverseCharge: cols[5]?.toLowerCase() === "yes",
          billingState: cols[6] || "TS",
          addressLine1: cols[7] || null,
          addressLine2: cols[8] || null,
          city: cols[9] || null,
          country: cols[10] || "India",
          pinCode: cols[11] || null,
          address: [cols[7], cols[8], cols[9]].filter(Boolean).join(", "),
          officeContactName: cols[12] || "Corporate Desk",
          officeContactEmail: cols[13] || "contact@corporate.com",
          officeContactPhone: cols[14] || "9876543210",
          contactPerson: cols[12] || "Corporate Desk",
          name: cols[12] || "Corporate Desk",
          mobile: cols[14] || "9876543210",
          email: cols[13] || null,
          accountsContactName: cols[15] || null,
          accountsContactEmail: cols[16] || null,
          accountsContactPhone: cols[17] || null,
          invoiceDefaultMode: mode,
          creditTerms: cols[19] || "30 Days",
          customCreditDays: cols[20] || null,
          notesInstructions: cols[21] || null,
          isActive: cols[22]?.toLowerCase() !== "inactive",
        });
      }

      setParsedCompanies(parsed);
    };
    reader.readAsText(file);
  };

  // Execute Bulk Upload to Firestore
  const handleExecuteBulkImport = async () => {
    if (parsedCompanies.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);

    let count = 0;
    try {
      for (const item of parsedCompanies) {
        await addDoc(collection(db, "companies"), {
          ...item,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        count++;
        setImportProgress(Math.round((count / parsedCompanies.length) * 100));
      }

      setFeedback({
        type: "success",
        message: `Successfully imported ${count} companies into directory!`,
      });
      setIsBulkModalOpen(false);
      setBulkFile(null);
      setParsedCompanies([]);
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

  // Delete Company Handler
  const handleConfirmDelete = async () => {
    if (!deletingCompany) return;
    setIsDeleting(true);
    try {
      const targetCol =
        deletingCompany.sourceCollection === "business_owners" ? "business_owners" : "companies";
      await deleteDoc(doc(db, targetCol, deletingCompany.id));
      setFeedback({
        type: "success",
        message: `Company "${deletingCompany.legalName}" removed from directory.`,
      });
      setDeletingCompany(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting company:", err);
      setFeedback({ type: "error", message: "Failed to delete company." });
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

  // Filtered companies
  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.legalName.toLowerCase().includes(q) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(q)) ||
      c.officeContactName.toLowerCase().includes(q) ||
      c.officeContactPhone.toLowerCase().includes(q) ||
      (c.officeContactEmail && c.officeContactEmail.toLowerCase().includes(q)) ||
      (c.city && c.city.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
        ? c.isActive !== false
        : c.isActive === false;

    return matchesSearch && matchesStatus;
  });

  // Pagination calculations (24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredCompanies.length);
  const paginatedCompanies = filteredCompanies.slice(startIndex, endIndex);

  // Statistics
  const totalCount = companies.length;
  const activeCount = companies.filter((c) => c.isActive !== false).length;
  const creditAccountsCount = companies.filter((c) => c.invoiceDefaultMode === "Credit").length;
  const cashAccountsCount = companies.filter((c) => c.invoiceDefaultMode === "Cash").length;

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
              <Building2 className="w-4 h-4" />
            </div>
            <h1 className="text-base font-medium text-slate-900 tracking-tight">
              Companies Directory
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5 ml-9">
            Manage corporate client accounts, B2B billing profiles, and office/accounts contacts.
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

          {/* Add Company Button */}
          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Company</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Total Registered</span>
            <span className="text-base font-semibold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Active Accounts</span>
            <span className="text-base font-semibold text-emerald-600">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Credit Accounts</span>
            <span className="text-base font-semibold text-blue-600">{creditAccountsCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Cash Accounts</span>
            <span className="text-base font-semibold text-purple-600">{cashAccountsCount}</span>
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
              placeholder="Search by legal name, trade name, contact, phone, city..."
              className="w-full h-[32px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-44">
            <SearchableSelect
              options={[
                { value: "ALL", label: "All Status" },
                { value: "ACTIVE", label: "Active Accounts", badge: "Active", badgeColor: "green" },
                { value: "INACTIVE", label: "Inactive Accounts", badge: "Inactive", badgeColor: "slate" },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              placeholder="Filter status..."
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
            <span className="text-xs font-normal">Loading companies from Firestore...</span>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
              <Building2 className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-medium text-slate-800">
              {searchQuery || statusFilter !== "ALL"
                ? "No matching companies found"
                : "No corporate client companies added yet"}
            </h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
              {searchQuery
                ? "Try searching with a different legal name, representative name, or phone number."
                : "Add corporate accounts to track corporate bookings and set credit limits."}
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleOpenAddDrawer}
                className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Company</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
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
                  <th className="py-2.5 px-3">Company / Legal Name</th>
                  <th className="py-2.5 px-3">Type & Code</th>
                  <th className="py-2.5 px-3">Office Contact</th>
                  <th className="py-2.5 px-3">State / Location</th>
                  <th className="py-2.5 px-3">Billing Mode</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCompanies.map((comp, idx) => (
                  <tr
                    key={comp.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                      {startIndex + idx + 1}
                    </td>

                    {/* Legal Name & Trade Name */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[4px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs shrink-0">
                          {comp.legalName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-medium text-slate-900 block leading-tight text-xs">
                            {comp.legalName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {comp.tradeName ? `Trade: ${comp.tradeName}` : comp.city || "Head Office"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Type & Vendor Code */}
                    <td className="py-2.5 px-3">
                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/80 text-slate-700">
                        {comp.customerType || "Company"}
                      </span>
                      {comp.vendorCode && (
                        <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                          {comp.vendorCode}
                        </span>
                      )}
                    </td>

                    {/* Office Contact */}
                    <td className="py-2.5 px-3">
                      <span className="text-slate-800 font-medium block text-xs">
                        {comp.officeContactName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <a
                          href={`tel:${comp.officeContactPhone}`}
                          className="font-mono text-slate-600 hover:text-[#f16623] transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Phone className="w-2.5 h-2.5 text-slate-400" />
                          <span>{comp.officeContactPhone}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy(comp.officeContactPhone, `mob-${comp.id}`)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                          title="Copy phone"
                        >
                          {copiedId === `mob-${comp.id}` ? (
                            <Check className="w-2.5 h-2.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-2.5 h-2.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* State / Location */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-800 text-xs">
                        {comp.billingState || "TS"}
                      </span>
                      {comp.city && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {comp.city}
                        </span>
                      )}
                    </td>

                    {/* Invoicing Mode & Credit Terms */}
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                          comp.invoiceDefaultMode === "Credit"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {comp.invoiceDefaultMode}
                      </span>
                      {comp.invoiceDefaultMode === "Credit" && (
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {comp.creditTerms === "Custom"
                            ? `${comp.customCreditDays || 30} Days`
                            : comp.creditTerms || "30 Days"}
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          comp.isActive !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            comp.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {comp.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingCompany(comp)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span className="hidden sm:inline">View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditDrawer(comp)}
                          className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                          title="Edit Company"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingCompany(comp)}
                          className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                          title="Delete Company"
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
        {filteredCompanies.length > 0 && (
          <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-normal">
                Showing <span className="font-medium text-slate-800">{startIndex + 1}</span> to{" "}
                <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                <span className="font-medium text-slate-800">{filteredCompanies.length}</span> companies
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

      {/* 5-Tab OffCanvas Drawer for Add & Edit (Size: 2xl with wide padding) */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => setIsOffCanvasOpen(false)}
        title={editingCompanyId ? "Edit Company Profile" : "Add New Corporate Company"}
        subtitle="Configure profile, place of supply, contacts, and invoicing defaults across 5 steps."
        size="2xl"
        widthClassName="max-w-3xl sm:max-w-4xl lg:max-w-5xl"
      >
        <div className="space-y-4">
          {/* Stepper Tabs Navigation (No scroll, clean 5-column responsive grid) */}
          <div className="border-b border-slate-200 pb-2">
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {[
                { step: 1, label: "Profile", icon: Building2 },
                { step: 2, label: "Place of Supply", icon: MapPin },
                { step: 3, label: "Address & Contact", icon: MapPin },
                { step: 4, label: "Invoicing Defaults", icon: CreditCard },
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

          {/* Form Step Contents */}
          <form onSubmit={handleSaveCompany} className="space-y-4">
            {/* TAB 1: PROFILE */}
            {activeTab === 1 && (
              <div className="space-y-3.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Legal Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Company Legal Name <span className="text-[#f16623]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      placeholder="e.g. Tata Consultancy Services Limited"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Trade Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Trade Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={tradeName}
                      onChange={(e) => setTradeName(e.target.value)}
                      placeholder="e.g. TCS"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Customer Type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Customer Type <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={[
                        { value: "Company", label: "Company (Corporate B2B)" },
                        { value: "Individual", label: "Individual (Proprietorship / Direct)" },
                      ]}
                      value={customerType}
                      onChange={(val) => setCustomerType(val as any)}
                      placeholder="Select Customer Type..."
                    />
                  </div>

                  {/* PAN */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Company PAN <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      placeholder="e.g. AAACB1234L"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>

                  {/* Vendor Code */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Vendor Code / Reference <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={vendorCode}
                      onChange={(e) => setVendorCode(e.target.value)}
                      placeholder="e.g. RK-VND-5012"
                      className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Continue button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleContinue(2)}
                    className="h-[34px] max-h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <span>Continue to Place of Supply</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PLACE OF SUPPLY */}
            {activeTab === 2 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[6px] space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Billing State / Place of Supply <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={INDIAN_STATES.map((st) => ({
                        value: st.code,
                        label: `${st.code} - ${st.name}`,
                      }))}
                      value={billingState}
                      onChange={setBillingState}
                      placeholder="Select Billing State..."
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Select the primary state of operation for invoices and billing purposes.
                    </span>
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
                    <span>Continue to Address & Contact</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: ADDRESS & CONTACT */}
            {activeTab === 3 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Registered Address */}
                <div className="space-y-2.5">
                  <span className="text-xs font-medium text-slate-800 block">
                    Registered Office Address
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        placeholder="Address Line 1 (Building, Street, Plot No)"
                        className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="Address Line 2 (Area, Landmark)"
                        className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City (e.g. Hyderabad)"
                        className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <input
                        type="text"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        placeholder="PIN Code (e.g. 500081)"
                        className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Office Contact Section (Mandatory) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                    <User className="w-3.5 h-3.5 text-[#f16623]" />
                    <span>Office Contact Section</span>
                    <span className="text-[#f16623]">*</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Contact Name <span className="text-[#f16623]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={officeContactName}
                        onChange={(e) => setOfficeContactName(e.target.value)}
                        placeholder="e.g. Ramesh Sharma"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Email Address <span className="text-[#f16623]">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={officeContactEmail}
                        onChange={(e) => setOfficeContactEmail(e.target.value)}
                        placeholder="e.g. ramesh@tcs.com"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">
                        Phone Number <span className="text-[#f16623]">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={officeContactPhone}
                        onChange={(e) => setOfficeContactPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Accounts Contact Section (Optional) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                    <Receipt className="w-3.5 h-3.5 text-slate-500" />
                    <span>Accounts Contact Section</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Accounts Name</label>
                      <input
                        type="text"
                        value={accountsContactName}
                        onChange={(e) => setAccountsContactName(e.target.value)}
                        placeholder="e.g. Sanjay Accounts"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Accounts Email</label>
                      <input
                        type="email"
                        value={accountsContactEmail}
                        onChange={(e) => setAccountsContactEmail(e.target.value)}
                        placeholder="e.g. accounts@tcs.com"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">Accounts Phone</label>
                      <input
                        type="tel"
                        value={accountsContactPhone}
                        onChange={(e) => setAccountsContactPhone(e.target.value)}
                        placeholder="e.g. 9876543211"
                        className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
                      />
                    </div>
                  </div>
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
                    <span>Continue to Invoicing Defaults</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: INVOICING DEFAULTS */}
            {activeTab === 4 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Invoice Default Mode: Cash or Credit */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Invoice Default Mode <span className="text-[#f16623]">*</span>
                    </label>
                    <SearchableSelect
                      options={[
                        { value: "Credit", label: "Credit (Post-Paid / Invoiced)" },
                        { value: "Cash", label: "Cash (Immediate Settlement)" },
                      ]}
                      value={invoiceDefaultMode}
                      onChange={(val) => setInvoiceDefaultMode(val as any)}
                      placeholder="Select Default Mode..."
                    />
                  </div>

                  {/* If Credit: Credit Terms */}
                  {invoiceDefaultMode === "Credit" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Credit Terms <span className="text-[#f16623]">*</span>
                      </label>
                      <SearchableSelect
                        options={[
                          { value: "7 Days", label: "7 Days" },
                          { value: "15 Days", label: "15 Days" },
                          { value: "30 Days", label: "30 Days" },
                          { value: "Immediately", label: "Immediately" },
                          { value: "Custom", label: "Custom Days" },
                        ]}
                        value={creditTerms}
                        onChange={setCreditTerms}
                        placeholder="Select Credit Terms..."
                      />
                    </div>
                  )}

                  {/* If Custom: Ask for Custom Credit Days (Mandatory plain number input) */}
                  {invoiceDefaultMode === "Credit" && creditTerms === "Custom" && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Custom Credit Term Days <span className="text-[#f16623]">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={customCreditDays}
                        onChange={(e) => setCustomCreditDays(e.target.value)}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        placeholder="Enter number of credit days (e.g. 45)"
                        className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                      />
                    </div>
                  )}
                </div>

                {/* Notes and Instructions */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Notes and Special Billing Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={notesInstructions}
                    onChange={(e) => setNotesInstructions(e.target.value)}
                    placeholder="e.g. Requires purchase order (PO) reference on every trip voucher."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
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

            {/* TAB 5: STATUS & SAVE */}
            {activeTab === 5 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* Active / Inactive Status Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-800 block">
                      Company Account Status
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Active companies can be allocated corporate bookings and billed on credit.
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

                {/* Review Summary */}
                <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
                  <span className="font-medium text-slate-800 block text-xs border-b border-slate-100 pb-1">
                    Profile Summary Review
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Legal Name:</span>
                      <span className="font-medium text-slate-800">{legalName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Type:</span>
                      <span className="font-medium text-slate-800">{customerType}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Invoicing:</span>
                      <span className="font-medium text-slate-800">
                        {invoiceDefaultMode} ({invoiceDefaultMode === "Credit" ? (creditTerms === "Custom" ? `${customCreditDays} Days` : creditTerms) : "Immediate"})
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block">Office Contact:</span>
                      <span className="font-medium text-slate-800">
                        {officeContactName} ({officeContactPhone} • {officeContactEmail})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Final Drawer Actions */}
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
                    <span>{editingCompanyId ? "Update Company Details" : "Save Company"}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </OffCanvas>

      {/* View Details OffCanvas Drawer */}
      <OffCanvas
        isOpen={Boolean(viewingCompany)}
        onClose={() => setViewingCompany(null)}
        title="Company Profile & Billing Overview"
        subtitle="Detailed account records, tax identifiers, contacts, and credit agreement."
        size="md"
      >
        {viewingCompany && (
          <div className="space-y-4">
            {/* Header Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[6px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">
                  {viewingCompany.legalName}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    viewingCompany.isActive !== false
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {viewingCompany.isActive !== false ? "Active Account" : "Inactive Account"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                {viewingCompany.tradeName ? `Trade: ${viewingCompany.tradeName} • ` : ""}
                Type: {viewingCompany.customerType || "Company"}
              </span>

              {/* Office Contact Actions */}
              <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-xs">
                <a
                  href={`tel:${viewingCompany.officeContactPhone}`}
                  className="p-2 rounded bg-white border border-slate-200 text-slate-700 hover:text-[#f16623] hover:border-[#f16623]/30 inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#f16623]" />
                  <span className="font-mono text-[11px] font-medium">
                    {viewingCompany.officeContactPhone}
                  </span>
                </a>

                {viewingCompany.officeContactEmail ? (
                  <a
                    href={`mailto:${viewingCompany.officeContactEmail}`}
                    className="p-2 rounded bg-white border border-slate-200 text-slate-700 hover:text-[#f16623] hover:border-[#f16623]/30 inline-flex items-center gap-1.5 transition cursor-pointer truncate"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] truncate">
                      {viewingCompany.officeContactEmail}
                    </span>
                  </a>
                ) : (
                  <div className="p-2 rounded bg-slate-100/60 border border-slate-200/60 text-slate-400 text-[11px] inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-300" />
                    <span>No email added</span>
                  </div>
                )}
              </div>
            </div>

            {/* Place of Supply */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2.5 text-xs">
              <span className="font-medium text-slate-800 block text-xs">
                Billing & Place of Supply
              </span>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 block">PAN</span>
                  <span className="font-mono font-medium text-slate-800">
                    {viewingCompany.pan || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Billing State</span>
                  <span className="font-medium text-slate-800">
                    {viewingCompany.billingState || "TS"}
                  </span>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-1 text-xs">
              <span className="font-medium text-slate-800 block text-xs">Office Address</span>
              <p className="text-slate-600 font-normal">
                {viewingCompany.address || [viewingCompany.addressLine1, viewingCompany.addressLine2, viewingCompany.city].filter(Boolean).join(", ") || "Address not provided"}
              </p>
              {viewingCompany.pinCode && (
                <span className="text-[10px] text-slate-400 block font-mono">
                  PIN: {viewingCompany.pinCode}
                </span>
              )}
            </div>

            {/* Invoicing Defaults */}
            <div className="p-3 bg-white border border-slate-200 rounded-[6px] space-y-2 text-xs">
              <span className="font-medium text-slate-800 block text-xs">Invoicing Defaults</span>
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 block">Payment Mode</span>
                  <span className="font-medium text-slate-800">
                    {viewingCompany.invoiceDefaultMode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Credit Terms</span>
                  <span className="font-medium text-slate-800">
                    {viewingCompany.creditTerms === "Custom"
                      ? `${viewingCompany.customCreditDays || 30} Days`
                      : viewingCompany.creditTerms || "30 Days"}
                  </span>
                </div>
              </div>
            </div>

            {/* Close & Edit buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingCompany(null)}
                className="h-[32px] px-3 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewingCompany;
                  setViewingCompany(null);
                  handleOpenEditDrawer(target);
                }}
                className="h-[32px] px-3 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1 hover:bg-[#d95318] transition cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Company</span>
              </button>
            </div>
          </div>
        )}
      </OffCanvas>

      {/* Bulk Upload Modal with 50 Companies Sample Data */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[8px] border border-slate-200 max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[6px] bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Bulk Import Corporate Companies
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Download sample Excel/CSV with 50 dummy companies or upload your file.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setParsedCompanies([]);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Download Sample File CTA */}
            <div className="p-3.5 bg-orange-50/60 border border-[#f16623]/20 rounded-[6px] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-800 block">
                  Need a pre-filled Excel/CSV template?
                </span>
                <span className="text-[11px] text-slate-500 font-normal">
                  Includes 50 realistic Indian corporate accounts with contacts & credit terms.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadSampleFile}
                className="h-[30px] px-3 rounded-[6px] bg-[#f16623] text-white text-[11px] font-medium inline-flex items-center gap-1 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition shrink-0 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Download Sample (50 Companies)</span>
              </button>
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
                Supported formats: CSV with standard comma headers
              </span>
              {bulkFile && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selected: <strong>{bulkFile.name}</strong></span>
                </div>
              )}
            </div>

            {/* Parsed Preview Table */}
            {parsedCompanies.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-medium">
                    Ready to import ({parsedCompanies.length} companies detected)
                  </span>
                  <span className="text-[11px] text-slate-400">Previewing first 5 rows</span>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2">Legal Name</th>
                        <th className="py-1.5 px-2">Type</th>
                        <th className="py-1.5 px-2">State</th>
                        <th className="py-1.5 px-2">Office Contact</th>
                        <th className="py-1.5 px-2">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {parsedCompanies.slice(0, 5).map((pc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-medium">{pc.legalName}</td>
                          <td className="py-1.5 px-2">{pc.customerType}</td>
                          <td className="py-1.5 px-2 font-mono text-[10px]">{pc.billingState || "TS"}</td>
                          <td className="py-1.5 px-2">{pc.officeContactName}</td>
                          <td className="py-1.5 px-2">{pc.invoiceDefaultMode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedCompanies.length > 5 && (
                    <div className="p-1.5 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      ...and {parsedCompanies.length - 5} more companies
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
                    <span>Saving companies to Firestore...</span>
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
                    setParsedCompanies([]);
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
                disabled={isImporting || parsedCompanies.length === 0}
                className="h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>
                  {isImporting ? "Importing Companies..." : `Import ${parsedCompanies.length} Companies`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-900">Delete Corporate Account?</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 font-medium">{deletingCompany.legalName}</strong>?
              This will remove them from the corporate directory.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingCompany(null)}
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
