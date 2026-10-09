"use client";

import { useState, useEffect, useMemo } from "react";
import {
  UserCheck,
  Search,
  Download,
  Printer,
  RefreshCw,
  Phone,
  ShieldCheck,
  CheckCircle2,
  Car,
  IndianRupee,
} from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Driver {
  id: string;
  name: string;
  mobile: string;
  licenseNumber?: string;
  badgeNumber?: string;
  status?: string;
  assignedVehicleReg?: string;
  assignedVehicleName?: string;
  city?: string;
}

interface Booking {
  id: string;
  driverId?: string;
  driverName?: string;
  bookingStatus?: string;
  driverBataCost?: number;
  totalKm?: number;
}

export default function DriversReportPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setDrivers(list);
    });

    const unsubBookings = onSnapshot(collection(db, "bookings"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setBookings(list);
      setLoading(false);
    });

    return () => {
      unsubDrivers();
      unsubBookings();
    };
  }, []);

  // Compute driver statistics from bookings
  const driverStats = useMemo(() => {
    const statsMap: Record<
      string,
      { totalTrips: number; completedTrips: number; totalBata: number; totalKm: number }
    > = {};

    bookings.forEach((b) => {
      const key = b.driverId || b.driverName || "unknown";
      if (!statsMap[key]) {
        statsMap[key] = { totalTrips: 0, completedTrips: 0, totalBata: 0, totalKm: 0 };
      }
      statsMap[key].totalTrips++;
      if (b.bookingStatus === "Trip Completed") {
        statsMap[key].completedTrips++;
      }
      statsMap[key].totalBata += Number(b.driverBataCost || 0);
      statsMap[key].totalKm += Number(b.totalKm || 0);
    });

    return statsMap;
  }, [bookings]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (statusFilter !== "all" && (d.status || "Active") !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.name?.toLowerCase().includes(q) ||
          d.mobile?.toLowerCase().includes(q) ||
          d.licenseNumber?.toLowerCase().includes(q) ||
          d.city?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [drivers, searchQuery, statusFilter]);

  const metrics = useMemo(() => {
    const totalDrivers = filteredDrivers.length;
    const activeDrivers = filteredDrivers.filter(
      (d) => (d.status || "Active") === "Active"
    ).length;
    let totalTrips = 0;
    let totalBata = 0;

    filteredDrivers.forEach((d) => {
      const st = driverStats[d.id] || driverStats[d.name];
      if (st) {
        totalTrips += st.totalTrips;
        totalBata += st.totalBata;
      }
    });

    return { totalDrivers, activeDrivers, totalTrips, totalBata };
  }, [filteredDrivers, driverStats]);

  const handleExportCSV = () => {
    if (filteredDrivers.length === 0) return;
    const headers = [
      "Driver Name",
      "Mobile",
      "License #",
      "City",
      "Status",
      "Total Trips",
      "Completed Trips",
      "Total KM",
      "Driver Bata (₹)",
    ];

    const rows = filteredDrivers.map((d) => {
      const st = driverStats[d.id] || driverStats[d.name] || {
        totalTrips: 0,
        completedTrips: 0,
        totalKm: 0,
        totalBata: 0,
      };

      return [
        `"${(d.name || "").replace(/"/g, '""')}"`,
        `"${d.mobile || ""}"`,
        `"${d.licenseNumber || ""}"`,
        `"${d.city || ""}"`,
        `"${d.status || "Active"}"`,
        st.totalTrips,
        st.completedTrips,
        st.totalKm,
        st.totalBata,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Drivers_Report_${new Date().toISOString().split("T")[0]}.csv`;
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
                <UserCheck className="w-4 h-4" />
              </div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                Driver Report
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Roster performance analysis, completed trip tallies, and driver bata disbursement logs
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleExportCSV}
              disabled={filteredDrivers.length === 0}
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
              Total Roster Drivers
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalDrivers}
            </div>
            <span className="text-[10px] text-slate-400">Registered drivers</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Active Status
            </span>
            <div className="text-lg font-semibold text-emerald-600 mt-1">
              {metrics.activeDrivers}
            </div>
            <span className="text-[10px] text-slate-400">Available for trips</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Executed Trips
            </span>
            <div className="text-lg font-semibold text-slate-900 mt-1">
              {metrics.totalTrips}
            </div>
            <span className="text-[10px] text-slate-400">Linked to roster</span>
          </div>

          <div className="bg-white p-3.5 rounded-[6px] border border-slate-200">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
              Total Driver Bata
            </span>
            <div className="text-lg font-semibold text-[#f16623] mt-1 font-mono">
              ₹{metrics.totalBata.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] text-slate-400">Disbursed allowance</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-3 rounded-[6px] border border-slate-200 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search driver by name, phone, license, city..."
              className="w-full h-[34px] max-h-[34px] pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623]"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-[34px] max-h-[34px] px-2.5 text-xs bg-white border border-slate-200 rounded-[6px] text-slate-700 focus:outline-none focus:border-[#f16623]"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="On Leave">On Leave</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
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
                  <th className="py-2.5 px-3">Driver Name</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">License / City</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Total Trips</th>
                  <th className="py-2.5 px-3 text-center">Completed</th>
                  <th className="py-2.5 px-3 text-right">Distance (KM)</th>
                  <th className="py-2.5 px-3 text-right">Total Bata (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading drivers report...
                    </td>
                  </tr>
                ) : filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No drivers found.
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((d) => {
                    const st = driverStats[d.id] || driverStats[d.name] || {
                      totalTrips: 0,
                      completedTrips: 0,
                      totalKm: 0,
                      totalBata: 0,
                    };

                    return (
                      <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {d.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono">
                          {d.mobile || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div>{d.licenseNumber || "N/A"}</div>
                          <span className="text-[10px] text-slate-400">{d.city || ""}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-[4px] text-[10px] font-medium ${
                              (d.status || "Active") === "Active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {d.status || "Active"}
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
                          ₹{st.totalBata.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {filteredDrivers.length} drivers</span>
            <span className="font-mono">Total Bata: ₹{metrics.totalBata.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>
  );
}
