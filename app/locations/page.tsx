"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  Building,
  Search,
  Plus,
  Loader2,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
  ArrowRight,
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
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { OffCanvas } from "@/components/OffCanvas";
import { SearchableSelect } from "@/components/SearchableSelect";

// ==========================================
// ALL-INDIA 28 STATES & 8 UNION TERRITORIES
// ==========================================
export interface StateMaster {
  name: string;
  code: string;
  cities: string[];
}

export const ALL_INDIA_STATES_DATA: StateMaster[] = [
  {
    name: "Telangana",
    code: "TS",
    cities: [
      "Hyderabad",
      "Secunderabad",
      "Shamshabad",
      "Warangal",
      "Nizamabad",
      "Karimnagar",
      "Ramagundam",
      "Khammam",
      "Mahbubnagar",
      "Nalgonda",
      "Adilabad",
      "Suryapet",
      "Siddipet",
      "Miryalaguda",
      "Jagtial",
      "Nirmal",
      "Sircilla",
      "Kamareddy",
      "Kothagudem",
      "Mancherial",
      "Bodhan",
      "Palwancha",
    ],
  },
  {
    name: "Andhra Pradesh",
    code: "AP",
    cities: [
      "Visakhapatnam",
      "Vijayawada",
      "Guntur",
      "Nellore",
      "Tirupati",
      "Kurnool",
      "Kakinada",
      "Rajahmundry",
      "Kadapa",
      "Anantapur",
      "Vizianagaram",
      "Eluru",
      "Ongole",
      "Nandyal",
      "Machilipatnam",
      "Adoni",
      "Tenali",
      "Chittoor",
      "Hindupur",
      "Bhimavaram",
    ],
  },
  {
    name: "Karnataka",
    code: "KA",
    cities: [
      "Bengaluru",
      "Mysuru",
      "Hubballi-Dharwad",
      "Mangaluru",
      "Belagavi",
      "Davanagere",
      "Ballari",
      "Vijayapura",
      "Shivamogga",
      "Tumakuru",
      "Raichur",
      "Bidar",
      "Hosapete",
      "Gadag",
      "Hassan",
      "Udupi",
      "Kalaburagi",
      "Chikmagalur",
      "Karwar",
    ],
  },
  {
    name: "Maharashtra",
    code: "MH",
    cities: [
      "Mumbai",
      "Pune",
      "Nagpur",
      "Thane",
      "Nashik",
      "Navi Mumbai",
      "Aurangabad (Chhatrapati Sambhajinagar)",
      "Solapur",
      "Kolhapur",
      "Amravati",
      "Nanded",
      "Sangli",
      "Jalgaon",
      "Akola",
      "Latur",
      "Dhule",
      "Ahmednagar",
      "Chandrapur",
      "Satara",
      "Shirdi",
    ],
  },
  {
    name: "Tamil Nadu",
    code: "TN",
    cities: [
      "Chennai",
      "Coimbatore",
      "Madurai",
      "Tiruchirappalli",
      "Salem",
      "Tirunelveli",
      "Tiruppur",
      "Vellore",
      "Erode",
      "Thanjavur",
      "Dindigul",
      "Kancheepuram",
      "Nagercoil",
      "Kumbakonam",
      "Ooty",
      "Kanyakumari",
    ],
  },
  {
    name: "Delhi (NCR)",
    code: "DL",
    cities: [
      "New Delhi",
      "Central Delhi",
      "South Delhi",
      "North Delhi",
      "East Delhi",
      "West Delhi",
      "Dwarka",
      "Rohini",
      "Connaught Place",
      "IGI Airport Zone",
    ],
  },
  {
    name: "Gujarat",
    code: "GJ",
    cities: [
      "Ahmedabad",
      "Surat",
      "Vadodara",
      "Rajkot",
      "Bhavnagar",
      "Jamnagar",
      "Gandhinagar",
      "Junagadh",
      "Anand",
      "Navsari",
      "Morbi",
      "Bharuch",
      "Vapi",
      "Bhuj",
      "Porbandar",
    ],
  },
  {
    name: "Uttar Pradesh",
    code: "UP",
    cities: [
      "Lucknow",
      "Kanpur",
      "Noida",
      "Greater Noida",
      "Ghaziabad",
      "Varanasi",
      "Agra",
      "Prayagraj",
      "Meerut",
      "Bareilly",
      "Aligarh",
      "Moradabad",
      "Saharanpur",
      "Gorakhpur",
      "Ayodhya",
      "Mathura",
      "Jhansi",
    ],
  },
  {
    name: "Rajasthan",
    code: "RJ",
    cities: [
      "Jaipur",
      "Jodhpur",
      "Kota",
      "Bikaner",
      "Ajmer",
      "Udaipur",
      "Bhilwara",
      "Alwar",
      "Bharatpur",
      "Sikar",
      "Jaisalmer",
      "Mount Abu",
    ],
  },
  {
    name: "West Bengal",
    code: "WB",
    cities: [
      "Kolkata",
      "Howrah",
      "Siliguri",
      "Asansol",
      "Durgapur",
      "Bardhaman",
      "Malda",
      "Kharagpur",
      "Haldia",
      "Darjeeling",
    ],
  },
  {
    name: "Kerala",
    code: "KL",
    cities: [
      "Kochi",
      "Thiruvananthapuram",
      "Kozhikode",
      "Thrissur",
      "Kollam",
      "Kannur",
      "Alappuzha",
      "Kottayam",
      "Palakkad",
      "Munnar",
      "Wayanad",
    ],
  },
  {
    name: "Punjab",
    code: "PB",
    cities: [
      "Ludhiana",
      "Amritsar",
      "Jalandhar",
      "Patiala",
      "Bathinda",
      "Mohali",
      "Hoshiarpur",
      "Pathankot",
    ],
  },
  {
    name: "Haryana",
    code: "HR",
    cities: [
      "Gurugram",
      "Faridabad",
      "Panipat",
      "Ambala",
      "Karnal",
      "Rohtak",
      "Hisar",
      "Panchkula",
      "Sonipat",
    ],
  },
  {
    name: "Madhya Pradesh",
    code: "MP",
    cities: [
      "Indore",
      "Bhopal",
      "Jabalpur",
      "Gwalior",
      "Ujjain",
      "Sagar",
      "Dewas",
      "Satna",
      "Ratlam",
      "Rewa",
    ],
  },
  {
    name: "Bihar",
    code: "BR",
    cities: [
      "Patna",
      "Gaya",
      "Bhagalpur",
      "Muzaffarpur",
      "Purnia",
      "Darbhanga",
      "Bihar Sharif",
      "Arrah",
      "Begusarai",
    ],
  },
  {
    name: "Odisha",
    code: "OD",
    cities: [
      "Bhubaneswar",
      "Cuttack",
      "Rourkela",
      "Berhampur",
      "Sambalpur",
      "Puri",
      "Balasore",
    ],
  },
  {
    name: "Assam",
    code: "AS",
    cities: [
      "Guwahati",
      "Silchar",
      "Dibrugarh",
      "Jorhat",
      "Nagaon",
      "Tezpur",
    ],
  },
  {
    name: "Goa",
    code: "GA",
    cities: [
      "Panaji",
      "Margao",
      "Vasco da Gama",
      "Mapusa",
      "Ponda",
      "Calangute",
      "Candolim",
    ],
  },
  {
    name: "Uttarakhand",
    code: "UK",
    cities: [
      "Dehradun",
      "Haridwar",
      "Rishikesh",
      "Haldwani",
      "Roorkee",
      "Rudrapur",
      "Nainital",
      "Mussoorie",
    ],
  },
  {
    name: "Himachal Pradesh",
    code: "HP",
    cities: [
      "Shimla",
      "Manali",
      "Dharamshala",
      "Solan",
      "Mandi",
      "Kullu",
      "Baddi",
    ],
  },
  {
    name: "Chhattisgarh",
    code: "CG",
    cities: [
      "Raipur",
      "Bhilai",
      "Bilaspur",
      "Korba",
      "Rajnandgaon",
    ],
  },
  {
    name: "Jharkhand",
    code: "JH",
    cities: [
      "Ranchi",
      "Jamshedpur",
      "Dhanbad",
      "Bokaro Steel City",
      "Deoghar",
      "Hazaribagh",
    ],
  },
  {
    name: "Jammu and Kashmir",
    code: "JK",
    cities: [
      "Srinagar",
      "Jammu",
      "Anantnag",
      "Gulmarg",
      "Pahalgam",
    ],
  },
  {
    name: "Ladakh",
    code: "LA",
    cities: [
      "Leh",
      "Kargil",
      "Nubra Valley",
    ],
  },
  {
    name: "Chandigarh",
    code: "CH",
    cities: [
      "Chandigarh",
    ],
  },
  {
    name: "Puducherry",
    code: "PY",
    cities: [
      "Puducherry (Pondicherry)",
      "Karaikal",
    ],
  },
  {
    name: "Arunachal Pradesh",
    code: "AR",
    cities: [
      "Itanagar",
      "Pasighat",
      "Tawang",
    ],
  },
  {
    name: "Manipur",
    code: "MN",
    cities: [
      "Imphal",
      "Thoubal",
    ],
  },
  {
    name: "Meghalaya",
    code: "ML",
    cities: [
      "Shillong",
      "Tura",
      "Cherrapunji",
    ],
  },
  {
    name: "Mizoram",
    code: "MZ",
    cities: [
      "Aizawl",
      "Lunglei",
    ],
  },
  {
    name: "Nagaland",
    code: "NL",
    cities: [
      "Kohima",
      "Dimapur",
    ],
  },
  {
    name: "Sikkim",
    code: "SK",
    cities: [
      "Gangtok",
      "Namchi",
      "Pelling",
    ],
  },
  {
    name: "Tripura",
    code: "TR",
    cities: [
      "Agartala",
      "Dharmanagar",
    ],
  },
  {
    name: "Andaman and Nicobar Islands",
    code: "AN",
    cities: [
      "Port Blair",
      "Havelock Island",
    ],
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    code: "DN",
    cities: [
      "Daman",
      "Diu",
      "Silvassa",
    ],
  },
  {
    name: "Lakshadweep",
    code: "LD",
    cities: [
      "Kavaratti",
      "Agatti Island",
    ],
  },
];

export interface LocationItem {
  id: string;
  name: string; // Location / City Name
  cityName?: string; // fallback alias
  state: string; // State Name
  stateName?: string; // fallback alias
  stateCode: string; // State Code
  isActive: boolean;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
}

// Generate the Excel/CSV file with exact columns: Name, State, State Code, Status
export function generateAllIndiaLocationsCSV(): string {
  const headers = ["Name", "State", "State Code", "Status"];
  const rows: string[][] = [];

  ALL_INDIA_STATES_DATA.forEach((st) => {
    st.cities.forEach((cityName) => {
      rows.push([
        cityName,
        st.name,
        st.code,
        "Active",
      ]);
    });
  });

  const lines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")),
  ];

  return lines.join("\n");
}

// Flattened list of all-India locations
export function getAllIndiaFlattenedLocations(): Partial<LocationItem>[] {
  const items: Partial<LocationItem>[] = [];
  ALL_INDIA_STATES_DATA.forEach((st) => {
    st.cities.forEach((cityName) => {
      items.push({
        name: cityName,
        cityName: cityName,
        state: st.name,
        stateName: st.name,
        stateCode: st.code,
        isActive: true,
      });
    });
  });
  return items;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & State Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // View Mode: 'TABLE' or 'STATE_CARDS'
  const [viewMode, setViewMode] = useState<"TABLE" | "STATE_CARDS">("TABLE");

  // Pagination states (Limit: 24 per page)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 24;

  // Manual Add/Edit Drawer Form States
  // Requested: name, state dropdown, state code, active/inactive toggle button, save
  const [isOffCanvasOpen, setIsOffCanvasOpen] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [state, setState] = useState("Telangana");
  const [stateCode, setStateCode] = useState("TS");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bulk Upload states (Excel/CSV: Name, State, State Code, Status)
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [parsedLocations, setParsedLocations] = useState<Partial<LocationItem>[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState("");

  // Deletion modal
  const [deletingLocation, setDeletingLocation] = useState<LocationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Real-time Firestore Listener with 24 Limit per page
  useEffect(() => {
    try {
      const fetchLimit = Math.max(240, currentPage * 24);
      const q = query(
        collection(db, "locations"),
        orderBy("state", "asc"),
        limit(fetchLimit)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: LocationItem[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            const resolvedName = d.name || d.cityName || "Unnamed Location";
            const resolvedState = d.state || d.stateName || "Unknown State";
            const resolvedCode = d.stateCode || "IN";

            return {
              id: docSnap.id,
              name: resolvedName,
              cityName: resolvedName,
              state: resolvedState,
              stateName: resolvedState,
              stateCode: resolvedCode,
              isActive: d.isActive !== false,
              createdAt: d.createdAt,
              updatedAt: d.updatedAt,
            };
          });
          setLocations(items);
          setLoading(false);
        },
        () => {
          // Fallback query without sorting
          const fallbackQ = query(collection(db, "locations"), limit(fetchLimit));
          onSnapshot(fallbackQ, (snap) => {
            const items: LocationItem[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              const resolvedName = d.name || d.cityName || "Unnamed Location";
              const resolvedState = d.state || d.stateName || "Unknown State";
              const resolvedCode = d.stateCode || "IN";
              return {
                id: docSnap.id,
                name: resolvedName,
                cityName: resolvedName,
                state: resolvedState,
                stateName: resolvedState,
                stateCode: resolvedCode,
                isActive: d.isActive !== false,
              };
            });
            setLocations(items);
            setLoading(false);
          });
        }
      );

      return () => unsub();
    } catch (err) {
      console.error("Failed to subscribe to locations:", err);
      setLoading(false);
    }
  }, [currentPage]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStateFilter, statusFilter]);

  // Handle State selection in form
  const handleStateChange = (stName: string) => {
    setState(stName);
    const found = ALL_INDIA_STATES_DATA.find(
      (s) => s.name.toLowerCase() === stName.toLowerCase()
    );
    if (found) {
      setStateCode(found.code);
    }
  };

  // Open Drawer in Add Mode
  const handleOpenAddDrawer = () => {
    setEditingLocationId(null);
    setName("");
    setState("Telangana");
    setStateCode("TS");
    setIsActive(true);
    setFormError(null);
    setIsOffCanvasOpen(true);
  };

  // Open Drawer in Edit Mode
  const handleOpenEditDrawer = (loc: LocationItem) => {
    setEditingLocationId(loc.id);
    setName(loc.name);
    setState(loc.state);
    setStateCode(loc.stateCode);
    setIsActive(loc.isActive !== false);
    setFormError(null);
    setIsOffCanvasOpen(true);
  };

  // Save Location (Manual Add & Update)
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Please enter Location / City Name.");
      return;
    }
    if (!state.trim()) {
      setFormError("Please select a State.");
      return;
    }
    if (!stateCode.trim()) {
      setFormError("Please enter State Code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        cityName: name.trim(),
        state: state.trim(),
        stateName: state.trim(),
        stateCode: stateCode.trim().toUpperCase(),
        isActive,
        updatedAt: serverTimestamp(),
      };

      if (editingLocationId) {
        await updateDoc(doc(db, "locations", editingLocationId), payload);
        setFeedback({
          type: "success",
          message: `Location "${name}" in ${state} updated successfully!`,
        });
      } else {
        await addDoc(collection(db, "locations"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setFeedback({
          type: "success",
          message: `Location "${name}" in ${state} saved successfully!`,
        });
      }

      setIsOffCanvasOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      console.error("Error saving location:", err);
      const msg = err instanceof Error ? err.message : "Failed to save location.";
      setFormError(msg);
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Location
  const handleConfirmDelete = async () => {
    if (!deletingLocation) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "locations", deletingLocation.id));
      setFeedback({
        type: "success",
        message: `Location "${deletingLocation.name}" removed from directory.`,
      });
      setDeletingLocation(null);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      console.error("Error deleting location:", err);
      setFeedback({ type: "error", message: "Failed to delete location." });
    } finally {
      setIsDeleting(false);
    }
  };

  // Download All-India Excel/CSV Template
  const handleDownloadMasterCSV = () => {
    const csvContent = generateAllIndiaLocationsCSV();
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "all_india_locations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preload All-India Master Data directly (1-Click)
  const handlePreloadAllIndiaData = () => {
    const all = getAllIndiaFlattenedLocations();
    setParsedLocations(all);
    const dummyFile = new File([generateAllIndiaLocationsCSV()], "all_india_locations.csv", {
      type: "text/csv",
    });
    setBulkFile(dummyFile);
  };

  // Handle CSV file selection (Columns: Name, State, State Code, Status)
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

      const parsed: Partial<LocationItem>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[0]) continue;

        let locName = cols[0];
        let stName = cols[1] || "Telangana";
        let stCode = cols[2] || "TS";
        let statusVal = cols[3] || "Active";

        // Check if order was State first, Name second
        const isFirstColState = ALL_INDIA_STATES_DATA.some(
          (s) => s.name.toLowerCase() === cols[0].toLowerCase()
        );
        if (isFirstColState && cols[2]) {
          stName = cols[0];
          stCode = cols[1];
          locName = cols[2];
          statusVal = cols[cols.length - 1];
        }

        const isActive = statusVal.toLowerCase() !== "inactive";

        parsed.push({
          name: locName,
          cityName: locName,
          state: stName,
          stateName: stName,
          stateCode: stCode.toUpperCase(),
          isActive,
        });
      }

      setParsedLocations(parsed);
    };
    reader.readAsText(file);
  };

  // Execute Bulk Upload to Firestore in Batches
  const handleExecuteBulkImport = async () => {
    if (parsedLocations.length === 0) return;
    setIsImporting(true);
    setImportProgress(0);
    setImportStatusText("Storing locations into database...");

    let totalSaved = 0;
    const batchSize = 100;
    try {
      for (let i = 0; i < parsedLocations.length; i += batchSize) {
        const chunk = parsedLocations.slice(i, i + batchSize);
        const batch = writeBatch(db);

        for (const locItem of chunk) {
          const docRef = doc(collection(db, "locations"));
          batch.set(docRef, {
            name: locItem.name,
            cityName: locItem.name,
            state: locItem.state,
            stateName: locItem.state,
            stateCode: locItem.stateCode,
            isActive: locItem.isActive !== false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        totalSaved += chunk.length;
        setImportProgress(Math.round((totalSaved / parsedLocations.length) * 100));
        setImportStatusText(`Stored ${totalSaved} of ${parsedLocations.length} locations...`);
      }

      setFeedback({
        type: "success",
        message: `Successfully stored ${totalSaved} locations across all Indian states!`,
      });
      setIsBulkModalOpen(false);
      setBulkFile(null);
      setParsedLocations([]);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      console.error("Bulk upload error:", err);
      const msg = err instanceof Error ? err.message : "Bulk upload failed.";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatusText("");
    }
  };

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return locations.filter((loc) => {
      const matchesSearch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.state.toLowerCase().includes(q) ||
        loc.stateCode.toLowerCase().includes(q);

      const matchesState =
        selectedStateFilter === "ALL" || loc.state === selectedStateFilter;

      const matchesStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
          ? loc.isActive !== false
          : loc.isActive === false;

      return matchesSearch && matchesState && matchesStatus;
    });
  }, [locations, searchQuery, selectedStateFilter, statusFilter]);

  // Grouped by State for State Directory View
  const stateGroupedData = useMemo(() => {
    const map = new Map<string, { stateCode: string; cities: LocationItem[] }>();
    filteredLocations.forEach((loc) => {
      if (!map.has(loc.state)) {
        map.set(loc.state, { stateCode: loc.stateCode, cities: [] });
      }
      map.get(loc.state)?.cities.push(loc);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredLocations]);

  // Distinct States in database
  const distinctStates = useMemo(() => {
    const set = new Set<string>();
    locations.forEach((l) => set.add(l.state));
    return Array.from(set).sort();
  }, [locations]);

  // Pagination Calculations (Limit: 24 per page)
  const totalPages = Math.max(1, Math.ceil(filteredLocations.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLocations.length);
  const paginatedLocations = filteredLocations.slice(startIndex, endIndex);

  // Statistics
  const totalLocationsCount = locations.length;
  const totalStatesCount = distinctStates.length;
  const activeLocationsCount = locations.filter((l) => l.isActive !== false).length;

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
              <MapPin className="w-4 h-4" />
            </div>
            <h1 className="text-base font-medium text-slate-900 tracking-tight">
              Locations Master (States & Cities)
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-normal mt-0.5 ml-9">
            Manage state-wise locations, city territories, state codes, and active operating coverage.
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
            <span>Bulk Upload (Excel / CSV)</span>
          </button>

          {/* Add Location Button */}
          <button
            type="button"
            onClick={handleOpenAddDrawer}
            className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Building className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">States Covered</span>
            <span className="text-base font-semibold text-slate-900">{totalStatesCount}</span>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center text-[#f16623] shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Total Locations</span>
            <span className="text-base font-semibold text-slate-900">{totalLocationsCount}</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-3.5 rounded-[6px] border border-slate-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-[6px] bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-normal block">Active Locations</span>
            <span className="text-base font-semibold text-emerald-600">{activeLocationsCount}</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[6px] border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Search, State Selector & Controls */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search location name, state, state code..."
                className="w-full h-[32px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] transition"
              />
            </div>

            {/* States Dropdown Filter */}
            <div className="flex items-center gap-1.5 w-44">
              <span className="text-[11px] text-slate-400 shrink-0">State:</span>
              <SearchableSelect
                options={[
                  { value: "ALL", label: `All States (${totalStatesCount})` },
                  ...distinctStates.map((st) => ({ value: st, label: st })),
                ]}
                value={selectedStateFilter}
                onChange={setSelectedStateFilter}
                placeholder="Filter State..."
              />
            </div>

            {/* Status Dropdown Filter */}
            <div className="w-36">
              <SearchableSelect
                options={[
                  { value: "ALL", label: "All Status" },
                  { value: "ACTIVE", label: "Active Only", badge: "Active", badgeColor: "green" },
                  { value: "INACTIVE", label: "Inactive Only", badge: "Inactive", badgeColor: "slate" },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="Filter Status..."
              />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-[6px] self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`h-[28px] px-2.5 rounded-[4px] text-xs font-medium transition cursor-pointer ${
                viewMode === "TABLE"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode("STATE_CARDS")}
              className={`h-[28px] px-2.5 rounded-[4px] text-xs font-medium transition cursor-pointer ${
                viewMode === "STATE_CARDS"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              State-wise Directory
            </button>
          </div>
        </div>

        {/* STATE-WISE DIRECTORY VIEW */}
        {viewMode === "STATE_CARDS" && (
          <div className="p-4 space-y-4">
            {stateGroupedData.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No states or locations found matching your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {stateGroupedData.map(([stName, data]) => (
                  <div
                    key={stName}
                    className="p-3.5 bg-slate-50/60 rounded-[6px] border border-slate-200 hover:border-[#f16623]/40 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900">{stName}</span>
                        <span className="font-mono text-[10px] bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded">
                          {data.stateCode}
                        </span>
                      </div>
                      <span className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded font-mono">
                        {data.cities.length} {data.cities.length === 1 ? "Location" : "Locations"}
                      </span>
                    </div>

                    {/* Locations tags of this State */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto scrollbar-thin">
                      {data.cities.map((city) => (
                        <span
                          key={city.id}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] border bg-white text-slate-700 border-slate-200"
                        >
                          <span>{city.name}</span>
                        </span>
                      ))}
                    </div>

                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Code: {data.stateCode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStateFilter(stName);
                          setViewMode("TABLE");
                        }}
                        className="text-[#f16623] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                      >
                        <span>View locations</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LIST TABLE VIEW (Strict Limit 24 items with Pagination) */}
        {viewMode === "TABLE" && (
          <div>
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#f16623]" />
                <span className="text-xs font-normal">Loading locations from database...</span>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 rounded-[6px] bg-orange-50 border border-[#f16623]/20 flex items-center justify-center mx-auto text-[#f16623] mb-2.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-medium text-slate-800">
                  {searchQuery || selectedStateFilter !== "ALL"
                    ? "No matching locations found"
                    : "No locations registered yet"}
                </h4>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5 font-normal">
                  {searchQuery
                    ? "Try searching with a different name, state, or code."
                    : "Add your first location or import all-India states & cities."}
                </p>
                <div className="mt-3.5 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkModalOpen(true)}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bulk Upload All States</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddDrawer}
                    className="h-[34px] max-h-[34px] px-3.5 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 transition hover:bg-[#d95318] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Location</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">State</th>
                      <th className="py-2.5 px-3">State Code</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedLocations.map((loc, idx) => (
                      <tr
                        key={loc.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Index */}
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-mono">
                          {startIndex + idx + 1}
                        </td>

                        {/* Name (City / Location) */}
                        <td className="py-2.5 px-3">
                          <span className="font-medium text-slate-900 text-xs">
                            {loc.name}
                          </span>
                        </td>

                        {/* State */}
                        <td className="py-2.5 px-3">
                          <span className="text-slate-800 text-[11px] font-medium">
                            {loc.state}
                          </span>
                        </td>

                        {/* State Code */}
                        <td className="py-2.5 px-3">
                          <span className="font-mono text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                            {loc.stateCode}
                          </span>
                        </td>

                        {/* Status (Active / Inactive) */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                              loc.isActive !== false
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                loc.isActive !== false ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {loc.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDrawer(loc)}
                              className="h-[28px] px-2 rounded-[4px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70 inline-flex items-center gap-1 text-[11px] font-normal transition cursor-pointer"
                              title="Edit Location"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingLocation(loc)}
                              className="h-[28px] w-[28px] rounded-[4px] text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 inline-flex items-center justify-center transition cursor-pointer"
                              title="Delete Location"
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

            {/* Pagination Controls (Strict Limit: 24 per page) */}
            {filteredLocations.length > 0 && (
              <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-normal">
                    Showing <span className="font-medium text-slate-800">{startIndex + 1}</span> to{" "}
                    <span className="font-medium text-slate-800">{endIndex}</span> of{" "}
                    <span className="font-medium text-slate-800">{filteredLocations.length}</span> locations
                  </span>
                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                    {pageSize} per page
                  </span>
                </div>

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
        )}
      </div>

      {/* Manual Add / Edit Location Drawer */}
      {/* User: in add laoction i need name stste dropdpwn list then state code then active or inactive toggle button then save save the location */}
      <OffCanvas
        isOpen={isOffCanvasOpen}
        onClose={() => {
          if (!isSubmitting) setIsOffCanvasOpen(false);
        }}
        size="md"
        title={editingLocationId ? "Edit Location" : "Add Location"}
        subtitle="Specify name, state, state code, and status."
      >
        <form onSubmit={handleSaveLocation} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-3.5">
            {/* 1. Name */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                Name <span className="text-[#f16623]">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hyderabad, Warangal, Pune"
                className="w-full h-[34px] max-h-[34px] px-3 text-xs bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
            </div>

            {/* 2. State Dropdown List */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                State <span className="text-[#f16623]">*</span>
              </label>
              <SearchableSelect
                options={ALL_INDIA_STATES_DATA.map((st) => ({
                  value: st.name,
                  label: `${st.name} (${st.code})`,
                }))}
                value={state}
                onChange={handleStateChange}
                placeholder="Select State..."
              />
            </div>

            {/* 3. State Code */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1 uppercase tracking-wide text-[10px]">
                State Code <span className="text-[#f16623]">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                placeholder="e.g. TS, MH, KA, DL"
                className="w-full h-[34px] max-h-[34px] px-3 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
              />
            </div>

            {/* 4. Active or Inactive Toggle Button */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-800 block">
                  Status: {isActive ? "Active" : "Inactive"}
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Active locations can be chosen for bookings and dispatch routes.
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
          </div>

          {/* 5. Save Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsOffCanvasOpen(false)}
              className="h-[34px] px-3.5 rounded-[6px] border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-normal transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="h-[34px] px-4 rounded-[6px] bg-[#f16623] text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{editingLocationId ? "Update Location" : "Save Location"}</span>
            </button>
          </div>
        </form>
      </OffCanvas>

      {/* Bulk Upload Modal (Excel / CSV Columns: Name, State, State Code, Status) */}
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
                    Bulk Upload Locations (Excel / CSV)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-normal">
                    Import state-wise cities with Name, State, State Code, and Status.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setIsBulkModalOpen(false);
                    setBulkFile(null);
                    setParsedLocations([]);
                  }
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Template Download & 1-Click Preloader */}
            <div className="p-3.5 bg-orange-50/70 border border-[#f16623]/20 rounded-[6px] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <span className="text-xs font-medium text-slate-800 block">
                    All-India States & Cities Excel Template
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Contains Name, State, State Code, and Status across all 28 States & 8 UTs.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadMasterCSV}
                    className="h-[30px] px-3 rounded-[6px] border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3 h-3 text-[#f16623]" />
                    <span>Download Excel / CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePreloadAllIndiaData}
                    className="h-[30px] px-3 rounded-[6px] bg-[#f16623] text-white text-[11px] font-medium inline-flex items-center gap-1 shadow-xs shadow-[#f16623]/25 hover:bg-[#d95318] transition cursor-pointer"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Preload All India Data</span>
                  </button>
                </div>
              </div>
            </div>

            {/* File Upload Drop Zone */}
            <div className="border-2 border-dashed border-slate-200 rounded-[6px] p-5 text-center hover:border-[#f16623]/50 transition bg-slate-50/50">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
              <label className="text-xs font-medium text-slate-700 block cursor-pointer">
                <span className="text-[#f16623] hover:underline">Click to browse</span> or drag and drop your CSV / Excel file
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleBulkFileSelected}
                  className="hidden"
                />
              </label>
              <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                Columns: Name, State, State Code, Status
              </span>
              {bulkFile && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Selected: <strong>{bulkFile.name}</strong></span>
                </div>
              )}
            </div>

            {/* Parsed Preview Table */}
            {parsedLocations.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-medium">
                    Ready to import ({parsedLocations.length} locations detected)
                  </span>
                  <span className="text-[11px] text-slate-400">Previewing first 6 rows</span>
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[6px]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-1.5 px-2">Name</th>
                        <th className="py-1.5 px-2">State</th>
                        <th className="py-1.5 px-2">State Code</th>
                        <th className="py-1.5 px-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {parsedLocations.slice(0, 6).map((pl, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 px-2 font-medium">{pl.name}</td>
                          <td className="py-1.5 px-2">{pl.state}</td>
                          <td className="py-1.5 px-2 font-mono text-[10px]">{pl.stateCode}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                pl.isActive !== false
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {pl.isActive !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedLocations.length > 6 && (
                    <div className="p-1.5 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      ...and {parsedLocations.length - 6} more state-wise locations
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
                    <span>{importStatusText || "Saving locations to Firestore..."}</span>
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
                    setParsedLocations([]);
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
                disabled={isImporting || parsedLocations.length === 0}
                className="h-[34px] px-4 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-medium shadow-xs shadow-[#f16623]/25 transition inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>
                  {isImporting ? "Importing Locations..." : `Store ${parsedLocations.length} Locations`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-[6px] border border-slate-200 max-w-sm w-full p-4 shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-medium text-slate-900">Delete Location?</h3>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">
              Are you sure you want to delete{" "}
              <strong className="text-slate-800 font-medium">
                {deletingLocation.name}, {deletingLocation.state}
              </strong>? This will remove the location from the directory.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingLocation(null)}
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
