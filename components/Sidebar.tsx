"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/pages-data";
import { ArrowLeftRight, X } from "lucide-react";

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();

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
            <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-[#f16623] flex items-center justify-center text-white font-bold text-sm shadow-xs shadow-[#f16623]/25 group-hover:scale-105 transition-transform">
              RK
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-bold text-base tracking-tight text-slate-900 leading-none">
                  RK<span className="text-[#f16623]">Travels</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-[2px] bg-[#f16623]"></span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium tracking-tight">
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
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            MENU
          </span>
          <button
            type="button"
            className="text-[10px] text-slate-400 hover:text-[#f16623] transition-colors h-[22px] max-h-[34px]"
          >
            expand all
          </button>
        </div>

        {/* Navigation Items List (strictly max-height 34px and rounded 6px per item) */}
        <div className="flex-1 px-2.5 py-1 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href === "/dashboard" && pathname === "/");

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onCloseMobile}
                className={`group flex items-center gap-2.5 px-3 h-[34px] max-h-[34px] rounded-[6px] text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[#f16623] text-white shadow-xs shadow-[#f16623]/30"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
            <span className="font-medium text-slate-300">RKTravels</span>
          </div>
        </div>
      </aside>
    </>
  );
}
