"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Search,
  Download,
  Printer,
  RefreshCw,
  Phone,
  Building2,
  Car,
  IndianRupee,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CarVendor {
  id: string;
  name: string;
  mobile: string;
  city?: string;
  state?: string;
  bankName?: string;
  accountNumber?: string;
  status?: string;
}

interface Vehicle {
  id: string;
  regNumber: string;
  vendorId?: string;
  vendorName?: string;
}

interface Booking {
  id: string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  bookingStatus?: string;
  grossAmount?: number;
}

export default function CarVendorsReportPage() {
  const [vendors, setVendors] = useState<CarVendor[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");

  useEffect(() => {
    const unsubVendors = onSnapshot(collection(db, "car-vendors"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setVendors(list);
    });

    const unsubVehicles = onSnapshot(collection(db, "vehicles"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setVehicles(list);
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBookings(list);
      setLoading(false);
    });

    return () => {
      unsubVendors();
      unsubVehicles();
      unsubBookings();
    };
  }, []);

  // Compute stats per vendor
  const vendorStats = useMemo(() => {
    // Map vehicle reg -> vendor
    const vehicleToVendorMap: Record<string, string> = {};
    const vendorVehicleCountMap: Record<string, number> = {};

    vehicles.forEach((v) => {
      if (v.vendorId || v.vendorName) {
        const vKey = v.vendorId || v.vendorName || "";
        vehicleToVendorMap[v.id] = vKey;
        vehicleToVendorMap[v.regNumber] = vKey;
        vendorVehicleCountMap[vKey] = (vendorVehicleCountMap[vKey] || 0) + 1;
      }
    });

    const statsMap: Record<
      string,
      { attachedVehicles: number; totalTrips: number; completedTrips: number; revenue: number }
    > = {};

    vendors.forEach((v) => {
      const attached =
        vendorVehicleCountMap[v.id] || vendorVehicleCountMap[v.name] || 0;
      statsMap[v.id] = { attachedVehicles: attached, totalTrips: 0, completedTrips: 0, revenue: 0 };
    });

    bookings.forEach((b) => {
      const vKey =
        (b.vehicleId && vehicleToVendorMap[b.vehicleId]) ||
        (b.vehicleRegNumber && vehicleToVendorMap[b.vehicleRegNumber]);

      if (vKey) {
        // match by ID or Name
        const vendor = vendors.find((v) => v.id === vKey || v.name === vKey);
        if (vendor && statsMap[vendor.id]) {
          statsMap[vendor.id].totalTrips++;
          if (b.bookingStatus === "Trip Completed") {
            statsMap[vendor.id].completedTrips++;
          }
          statsMap[vendor.id].revenue += Number(b.grossAmount || 0);
        }
      }
    });

    return statsMap;
  }, [vendors, vehicles, bookings]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.city) set.add(v.city);
    });
    return Array.from(set);
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (cityFilter !== "all" && v.city !== cityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.name?.toLowerCase().includes(q) ||
          v.mobile?.toLowerCase().includes(q) ||
          v.city?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vendors, searchQuery, cityFilter]);

  const metrics = useMemo(() => {
    let totalAttached = 0;
    let totalTrips = 0;
    let totalRevenue = 0;

    filteredVendors.forEach((v) => {
      const st = vendorStats[v.id];
      if (st) {
        totalAttached += st.attachedVehicles;
        totalTrips += st.totalTrips;
        totalRevenue += st.revenue;
      }
    });

    return {
      totalVendors: filteredVendors.length,
      totalAttached,
      totalTrips,
      totalRevenue,
    };
  }, [filteredVendors, vendorStats]);

  const handleExportCSV = () => {
    if (filteredVendors.length === 0) return;
    const headers = [
      "Vendor Name",
      "Mobile",
      "City",
      "Attached Vehicles",
      "Total Trips",
      "Completed Trips",
      "Generated Revenue (₹)",
    ];

    const rows = filteredVendors.map((v) => {
      const st = vendorStats[v.id] || {
        attachedVehicles: 0,
        totalTrips: 0,
        completedTrips: 0,
        revenue: 0,
      };

      return [
        `"${(v.name || "").replace(/"/g, '""')}"`,
        `"${v.mobile || ""}"`,
        `"${v.city || ""}"`,
        st.attachedVehicles,
        st.totalTrips,
        st.completedTrips,
        st.revenue,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Car_Vendors_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-[6px] border border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[6px] bg-orange-50 text-[#f16623] flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Car Vendor Report
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Attached fleet vendors, leasing partner inventory performance, and vendor vehicle execution tallies
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredVendors.length === 0}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Registered Vendors
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalVendors}
            </div>
            <span className="text-[10px] text-slate-400">Leasing partners</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Attached Vehicles
            </span>
            <div className="text-lg font-semibold text-emerald-600 mt-1 font-mono">
              {metrics.totalAttached}
            </div>
            <span className="text-[10px] text-slate-400">Vehicles on lease</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Vendor Trips
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalTrips}
            </div>
            <span className="text-[10px] text-slate-400">Executed by vendor fleet</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Generated Billing
            </span>
            <div className="text-lg font-semibold text-[#f16623] mt-1 font-mono">
              ₹{metrics.totalRevenue.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Total gross fare</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-[6px] border border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor name, phone, city..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
            >
              <option value="all">All Cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setCityFilter("all");
            }}
            className="w-full sm:w-auto h-[34px] max-h-[34px] px-3 text-xs font-normal border border-slate-200 rounded-[6px] text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[6px] border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-2.5 px-3">Vendor Name</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">City / State</th>
                  <th className="py-2.5 px-3 text-center">Attached Vehicles</th>
                  <th className="py-2.5 px-3 text-center">Total Trips</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-right">Generated Fare (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading car vendor report...
                    </td>
                  </tr>
                ) : filteredVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No car vendors found.
                    </td>
                  </tr>
                ) : (
                  filteredVendors.map((v) => {
                    const st = vendorStats[v.id] || {
                      attachedVehicles: 0,
                      totalTrips: 0,
                      completedTrips: 0,
                      revenue: 0,
                    };

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {v.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {v.mobile || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {v.city ? `${v.city}${v.state ? `, ${v.state}` : ""}` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                          {st.attachedVehicles}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                          {st.totalTrips}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-medium">
                          {st.completedTrips}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                          ₹{st.revenue.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredVendors.length} vendors</span>
            <span className="font-mono">Total Fare: ₹{metrics.totalRevenue.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
  );
}
