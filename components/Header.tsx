"use client";

import {
  Menu,
  ChevronDown,
  Printer,
  LogOut,
} from "lucide-react";

interface HeaderProps {
  onOpenMobile?: () => void;
}

export function Header({ onOpenMobile }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Mobile Menu Toggle & Brand title for small screens */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          type="button"
          className="lg:hidden h-[34px] max-h-[34px] w-[34px] rounded-[6px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-normal">
          <span className="w-1.5 h-1.5 rounded-[2px] bg-emerald-500 animate-pulse"></span>
          <span>System Online</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Store / Hub Switcher */}
        <button
          type="button"
          className="hidden sm:inline-flex items-center gap-2 h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 text-xs font-normal text-slate-700 transition"
        >
          <span className="w-1.5 h-1.5 rounded-[2px] bg-[#f16623]"></span>
          <span>Store 1</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
        </button>

        {/* Connect Printer Button */}
        <button
          type="button"
          className="hidden md:inline-flex items-center gap-2 h-[34px] max-h-[34px] px-3 rounded-[6px] border border-slate-200 bg-slate-50/70 hover:bg-slate-100/70 text-xs font-normal text-slate-700 transition"
        >
          <span className="w-1.5 h-1.5 rounded-[2px] bg-slate-400"></span>
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Connect Printer</span>
        </button>

        {/* User Profile Component */}
        <div className="flex items-center gap-2.5 pl-2 sm:border-l border-slate-200">
          <div className="w-[34px] h-[34px] max-h-[34px] rounded-[6px] bg-[#f16623] flex items-center justify-center text-white text-xs font-medium shadow-xs">
            AR
          </div>

          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-medium text-slate-800 leading-tight truncate max-w-[130px]">
              arumullasivakrishna6...
            </span>
            <span className="text-[10px] text-slate-400 font-normal leading-none">
              Administrator
            </span>
          </div>

          <button
            type="button"
            title="Sign out"
            className="h-[34px] max-h-[34px] w-[34px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[6px] transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
