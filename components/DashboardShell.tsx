"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Block value changing on scroll/wheel when number inputs are focused
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const active = document.activeElement as HTMLInputElement | null;
      if (
        active &&
        active.tagName === "INPUT" &&
        active.type === "number"
      ) {
        active.blur();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

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
