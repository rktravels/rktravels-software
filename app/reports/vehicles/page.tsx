"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Car,
  Search,
  Download,
  Printer,
  RefreshCw,
  Fuel,
  Gauge,
  CheckCircle2,
  CalendarCheck,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Vehicle {
  id: string;
  regNumber: string;
  vehicleName: string;
  category: string;
  fuelType?: string;
  status?: string;
  ownershipType?: string;
  vendorName?: string;
}

interface Booking {
  id: string;
  vehicleId?: string;
  vehicleRegNumber?: string;
  bookingStatus?: string;
  totalKm?: number;
  grossAmount?: number;
}

export default function VehiclesReportPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fuelFilter, setFuelFilter] = useState("all");

  useEffect(() => {
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
      unsubVehicles();
      unsubBookings();
    };
  }, []);

  // Compute vehicle statistics from bookings
  const vehicleStats = useMemo(() => {
    const statsMap: Record<
      string,
      { totalTrips: number; completedTrips: number; totalKm: number; revenue: number }
    > = {};

    bookings.forEach((b) => {
      const key = b.vehicleId || b.vehicleRegNumber || "unknown";
      if (!statsMap[key]) {
        statsMap[key] = { totalTrips: 0, completedTrips: 0, totalKm: 0, revenue: 0 };
      }
      statsMap[key].totalTrips++;
      if (b.bookingStatus === "Trip Completed") {
        statsMap[key].completedTrips++;
      }
      statsMap[key].totalKm += Number(b.totalKm || 0);
      statsMap[key].revenue += Number(b.grossAmount || 0);
    });

    return statsMap;
  }, [bookings]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (categoryFilter !== "all" && v.category !== categoryFilter) return false;
      if (fuelFilter !== "all" && (v.fuelType || "Diesel") !== fuelFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          v.regNumber?.toLowerCase().includes(q) ||
          v.vehicleName?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          v.vendorName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [vehicles, searchQuery, categoryFilter, fuelFilter]);

  const metrics = useMemo(() => {
    let totalTrips = 0;
    let totalKm = 0;
    let totalRevenue = 0;

    filteredVehicles.forEach((v) => {
      const st = vehicleStats[v.id] || vehicleStats[v.regNumber];
      if (st) {
        totalTrips += st.totalTrips;
        totalKm += st.totalKm;
        totalRevenue += st.revenue;
      }
    });

    return {
      totalFleet: filteredVehicles.length,
      totalTrips,
      totalKm,
      totalRevenue,
    };
  }, [filteredVehicles, vehicleStats]);

  const handleExportCSV = () => {
    if (filteredVehicles.length === 0) return;
    const headers = [
      "Registration Number",
      "Vehicle Name",
      "Category",
      "Fuel Type",
      "Ownership",
      "Total Trips",
      "Completed Trips",
      "Total KM",
      "Gross Revenue (₹)",
    ];

    const rows = filteredVehicles.map((v) => {
      const st = vehicleStats[v.id] || vehicleStats[v.regNumber] || {
        totalTrips: 0,
        completedTrips: 0,
        totalKm: 0,
        revenue: 0,
      };

      return [
        `"${v.regNumber || ""}"`,
        `"${(v.vehicleName || "").replace(/"/g, '""')}"`,
        `"${v.category || ""}"`,
        `"${v.fuelType || "Diesel"}"`,
        `"${v.ownershipType || "Owned"}"`,
        st.totalTrips,
        st.completedTrips,
        st.totalKm,
        st.revenue,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Vehicles_Report_${new Date().toISOString().split("T")[0]}.csv`;
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
                <Car className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Vehicle Report
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Fleet utilization index, total odometer distance runs, and commercial revenue generation
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredVehicles.length === 0}
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
              Fleet Size
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalFleet}
            </div>
            <span className="text-[10px] text-slate-400">Total vehicles</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Distance
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1 font-mono">
              {metrics.totalKm.toLocaleString("en-IN")} KM
            </div>
            <span className="text-[10px] text-slate-400">Logged on bookings</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Dispatched Trips
            </span>
            <div className="text-lg font-semibold text-emerald-600 mt-1">
              {metrics.totalTrips}
            </div>
            <span className="text-[10px] text-slate-400">Trips assigned</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Gross Fleet Revenue
            </span>
            <div className="text-lg font-semibold text-[#f16623] mt-1 font-mono">
              ₹{metrics.totalRevenue.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Generated fare</span>
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
              placeholder="Search vehicle reg number, model name, category..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
            />
          </div>

          <div className="w-full sm:w-44">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <select
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
            >
              <option value="all">All Fuels</option>
              <option value="Diesel">Diesel</option>
              <option value="Petrol">Petrol</option>
              <option value="CNG">CNG</option>
              <option value="Electric">Electric</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setCategoryFilter("all");
              setFuelFilter("all");
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
                  <th className="py-2.5 px-3">Reg Number</th>
                  <th className="py-2.5 px-3">Vehicle Model</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Fuel</th>
                  <th className="py-2.5 px-3 text-center">Total Trips</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-right">Distance (KM)</th>
                  <th className="py-2.5 px-3 text-right">Revenue (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading vehicle report...
                    </td>
                  </tr>
                ) : filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No vehicles found.
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((v) => {
                    const st = vehicleStats[v.id] || vehicleStats[v.regNumber] || {
                      totalTrips: 0,
                      completedTrips: 0,
                      totalKm: 0,
                      revenue: 0,
                    };

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900 font-mono">
                          {v.regNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {v.vehicleName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {v.category || "Sedan"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <span className="inline-block px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-[10px] text-slate-700 font-medium">
                            {v.fuelType || "Diesel"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                          {st.totalTrips}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-600 font-medium">
                          {st.completedTrips}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                          {st.totalKm.toLocaleString("en-IN")} KM
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
            <span>Showing {filteredVehicles.length} vehicles</span>
            <span className="font-mono">Total Revenue: ₹{metrics.totalRevenue.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
  );
}
