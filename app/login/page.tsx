"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Mail,
  Lock,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Building2,
  UserCheck,
  ArrowRight,
  Shield,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const { user, loginAdmin, loginStaff } = useAuth();

  // Active Login Tab: "admin" | "staff"
  const [activeTab, setActiveTab] = useState<"admin" | "staff">("admin");

  // Admin form state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Staff form state
  const [staffMobile, setStaffMobile] = useState("");
  const [staffMpin, setStaffMpin] = useState("");
  const [showStaffMpin, setShowStaffMpin] = useState(false);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      router.replace(redirectPath);
    }
  }, [user, redirectPath, router]);

  // Handle Admin Login Submit
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!adminEmail.trim()) {
      setErrorMsg("Please enter your administrator email address.");
      return;
    }
    if (!adminPassword) {
      setErrorMsg("Please enter your administrator password.");
      return;
    }

    setSubmitting(true);
    try {
      await loginAdmin(adminEmail, adminPassword);
      router.replace(redirectPath);
    } catch (err: any) {
      console.error("Admin login error:", err);
      let msg = "Invalid email address or password.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        msg = "Invalid email or password. Please verify your credentials.";
      } else if (err.code === "auth/too-many-requests") {
        msg = "Access temporarily disabled due to multiple failed attempts. Please try again later.";
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Staff Login Submit
  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanMobile = staffMobile.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length !== 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!staffMpin || staffMpin.trim().length < 4) {
      setErrorMsg("Please enter your 4-6 digit MPIN.");
      return;
    }

    setSubmitting(true);
    try {
      await loginStaff(cleanMobile, staffMpin);
      router.replace(redirectPath);
    } catch (err: any) {
      console.error("Staff login error:", err);
      setErrorMsg(err.message || "Login failed. Please check your mobile number and MPIN.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Subtle soft background accents */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-slate-100/60 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] z-10 space-y-5">
        {/* Company Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#f16623] to-[#ff8c4b] shadow-lg shadow-[#f16623]/25 mb-1">
            <ShieldCheck className="w-7 h-7 text-white stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            RK TRAVELS
          </h1>
          <p className="text-xs text-slate-500 font-normal">
            Fleet, Bookings &amp; Operations Management Portal
          </p>

          {/* <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>256-Bit Encrypted Secure Authentication</span>
          </div> */}
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-xl border border-slate-200/80 p-6 sm:p-7 space-y-5">
          {/* Tabs: Admin Login vs Staff Login */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/90 rounded-[8px] text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveTab("admin");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-[6px] transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "admin"
                  ? "bg-white text-slate-900 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#f16623]" />
              <span>Admin Login</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("staff");
                setErrorMsg(null);
              }}
              className={`py-2 px-3 rounded-[6px] transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "staff"
                  ? "bg-white text-slate-900 font-semibold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#f16623]" />
              <span>Staff Login</span>
            </button>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-tight">{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: ADMIN LOGIN FORM */}
          {activeTab === "admin" && (
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="admin@rktravels.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50/70 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full h-10 pl-9 pr-10 text-xs bg-slate-50/70 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showAdminPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-semibold shadow-md shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in as Admin...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Admin Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <span className="text-[11px] text-slate-500">
                  Are you a staff member?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("staff");
                      setErrorMsg(null);
                    }}
                    className="text-[#f16623] font-semibold hover:underline cursor-pointer"
                  >
                    Login with Mobile &amp; MPIN
                  </button>
                </span>
              </div>
            </form>
          )}

          {/* TAB 2: STAFF LOGIN FORM */}
          {activeTab === "staff" && (
            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">
                  Registered Mobile Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3 flex items-center gap-1 text-slate-500 text-xs font-mono font-medium border-r border-slate-200 pr-2 pointer-events-none">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={staffMobile}
                    onChange={(e) => setStaffMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="w-full h-10 pl-18 pr-3 text-xs bg-slate-50/70 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono transition"
                  />
                </div>
                <span className="text-[10px] text-slate-400">
                  Enter the 10-digit mobile number registered with management
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">
                  Security MPIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showStaffMpin ? "text" : "password"}
                    inputMode="numeric"
                    required
                    maxLength={6}
                    placeholder="••••"
                    value={staffMpin}
                    onChange={(e) => setStaffMpin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full h-10 pl-9 pr-10 text-xs bg-slate-50/70 border border-slate-200 rounded-[6px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#f16623] focus:bg-white font-mono tracking-widest transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffMpin(!showStaffMpin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showStaffMpin ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  4 to 6 digit security MPIN assigned by company admin
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-[6px] bg-[#f16623] hover:bg-[#d95318] text-white text-xs font-semibold shadow-md shadow-[#f16623]/25 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying MPIN...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In with MPIN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <span className="text-[11px] text-slate-500">
                  Are you an administrator?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("admin");
                      setErrorMsg(null);
                    }}
                    className="text-[#f16623] font-semibold hover:underline cursor-pointer"
                  >
                    Login with Email &amp; Password
                  </button>
                </span>
              </div>
            </form>
          )}
        </div>

        {/* Security badge at bottom */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Protected by RK Travels Security Layer</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#f16623] animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
