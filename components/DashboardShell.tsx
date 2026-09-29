"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Sidebar navigation */}
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main layout container (offset for desktop sidebar) */}
      <div className="lg:pl-64 flex flex-col min-h-screen transition-all">
        {/* Top Header bar */}
        <Header onOpenMobile={() => setMobileOpen(true)} />

        {/* Page Content with compact padding */}
        <main className="flex-1 p-2.5 sm:p-3.5 md:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
