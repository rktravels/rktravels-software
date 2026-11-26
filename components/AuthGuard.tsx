"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, normalizePermissionKey } from "@/context/AuthContext";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, canView } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [deniedToast, setDeniedToast] = useState(false);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (searchParams.get("denied") === "1") {
      setDeniedToast(true);
      const timer = setTimeout(() => setDeniedToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Auth redirection checks
  useEffect(() => {
    if (loading) return;

    if (!user && !isLoginPage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (user && isLoginPage) {
      router.replace("/dashboard");
    }
  }, [user, loading, isLoginPage, pathname, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  // Show clean spinner during initial auth resolution
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] text-slate-500 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[#f16623] border-t-transparent animate-spin" />
        <span className="text-xs font-medium tracking-wide">
          Verifying security credentials...
        </span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check URL-level permission for Staff
  if (user.role === "staff") {
    const key = normalizePermissionKey(pathname);

    // Staff cannot view /staff page
    if (key === "staff") {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-3 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Access Restricted
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            The Staff Management section is restricted to Company Administrators.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      );
    }

    if (!canView(key) && key !== "dashboard") {
      return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-3 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Permission Required
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            You do not have permission to access this module. Please contact your company administrator to grant you access.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#f16623] text-white text-xs font-medium hover:bg-[#d95318] transition shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go to Accessible Pages</span>
          </Link>
        </div>
      );
    }
  }

  return (
    <>
      {deniedToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-[6px] shadow-lg animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
          <span>You do not have permission to access that page.</span>
        </div>
      )}
      {children}
    </>
  );
}
