"use client";

import { useState, useEffect, Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/pages-data";
import {
  ArrowLeftRight,
  X,
  BarChart3,
  ChevronDown,
  CalendarCheck,
  UserCheck,
  Car,
  WalletCards,
  Briefcase,
} from "lucide-react";

const REPORT_NAV_ITEMS = [
  {
    id: "report-bookings",
    name: "Bookings report",
    href: "/reports/bookings",
    icon: CalendarCheck,
  },
  {
    id: "report-drivers",
    name: "Driver report",
    href: "/reports/drivers",
    icon: UserCheck,
  },
  {
    id: "report-vehicles",
    name: "Vehicel report",
    href: "/reports/vehicles",
    icon: Car,
  },
  {
    id: "report-credit",
    name: "Credit report",
    href: "/reports/credit",
    icon: WalletCards,
  },
  {
    id: "report-car-vendors",
    name: "Car vendor report",
    href: "/reports/car-vendors",
    icon: Briefcase,
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const isReportsRoute = pathname?.startsWith("/reports");
  const [reportsOpen, setReportsOpen] = useState(isReportsRoute);

  useEffect(() => {
    if (isReportsRoute) {
      setReportsOpen(true);
    }
  }, [isReportsRoute]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* Brand / Logo Section */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-100 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-[#f16623] flex items-center justify-center text-white font-medium text-sm shadow-xs shadow-[#f16623]/25 group-hover:scale-105 transition-transform">
              RK
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-medium text-base tracking-tight text-slate-900 leading-none">
                  RK<span className="text-[#f16623]">Travels</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-[2px] bg-[#f16623]"></span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal tracking-tight">
                powered by GamaNext
              </span>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden h-[34px] max-h-[34px] w-[34px] flex items-center justify-center rounded-[6px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Section Header */}
        <div className="px-4 pt-3.5 pb-1.5 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-medium tracking-wider text-slate-400 uppercase">
            MENU
          </span>
          <button
            type="button"
            onClick={() => setReportsOpen((prev) => !prev)}
            className="text-[10px] text-slate-400 hover:text-[#f16623] transition-colors h-[22px] max-h-[34px] cursor-pointer"
          >
            {reportsOpen ? "collapse all" : "expand all"}
          </button>
        </div>

        {/* Navigation Items List (strictly max-height 34px, rounded 6px, max font-weight 500) */}
        <div className="flex-1 px-2.5 py-1 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname === "/");

            return (
              <Fragment key={item.id}>
                <Link
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`group flex items-center gap-2.5 px-3 h-[34px] max-h-[34px] rounded-[6px] text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/30"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-700"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>

                {/* Reports Accordion placed immediately below Dashboard */}
                {item.id === "dashboard" && (
                  <div>
                    {/* Reports Accordion Trigger */}
                    <button
                      type="button"
                      onClick={() => setReportsOpen((prev) => !prev)}
                      className={`w-full group flex items-center justify-between px-3 h-[34px] max-h-[34px] rounded-[6px] text-xs font-medium transition-all duration-150 cursor-pointer ${
                        isReportsRoute
                          ? "bg-orange-50 text-[#f16623] font-semibold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <BarChart3
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            isReportsRoute
                              ? "text-[#f16623]"
                              : "text-slate-400 group-hover:text-slate-700"
                          }`}
                        />
                        <span className="truncate font-medium">Reports</span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          reportsOpen
                            ? "rotate-180 text-[#f16623]"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                    </button>

                    {/* Accordion Sub-items */}
                    {reportsOpen && (
                      <div className="pl-3 pr-1 py-1 space-y-0.5 border-l-2 border-orange-200/80 ml-4 my-1 transition-all">
                        {REPORT_NAV_ITEMS.map((sub) => {
                          const SubIcon = sub.icon;
                          const isSubActive = pathname === sub.href;

                          return (
                            <Link
                              key={sub.id}
                              href={sub.href}
                              onClick={onCloseMobile}
                              className={`group flex items-center gap-2 px-2.5 h-[32px] max-h-[34px] rounded-[6px] text-xs transition-all ${
                                isSubActive
                                  ? "bg-[#f16623] text-white font-medium shadow-xs shadow-[#f16623]/25"
                                  : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-normal"
                              }`}
                            >
                              <SubIcon
                                className={`w-3 h-3 shrink-0 transition-colors ${
                                  isSubActive
                                    ? "text-white"
                                    : "text-slate-400 group-hover:text-slate-600"
                                }`}
                              />
                              <span className="truncate">{sub.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>

        {/* Footer info matching screenshot */}
        <div className="p-2.5 border-t border-slate-100 shrink-0 bg-white">
          <div className="flex items-center justify-between px-2 h-[34px] max-h-[34px] text-xs text-slate-400">
            <button
              type="button"
              className="flex items-center gap-1.5 h-[34px] max-h-[34px] rounded-[6px] hover:text-slate-700 transition"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Onboarding</span>
            </button>
            <span className="font-normal text-slate-400">RKTravels</span>
          </div>
        </div>
      </aside>
    </>
  );
}
