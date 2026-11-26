"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  saveAuthSession,
  getClientSession,
  clearClientSession,
} from "@/lib/auth-session";
import { verifyMpin, AuthSessionData } from "@/lib/security";

export interface AuthUser {
  userId: string;
  role: "admin" | "staff";
  name: string;
  email?: string;
  mobileNumber?: string;
  permissions?: Record<string, "view" | "view_edit">;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  loginStaff: (mobileNumber: string, mpin: string) => Promise<void>;
  logout: () => Promise<void>;
  canView: (pathOrId: string) => boolean;
  canEdit: (pathOrId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to normalize route / module paths for permission checks
export function normalizePermissionKey(pathOrId: string): string {
  if (!pathOrId) return "dashboard";
  let clean = pathOrId.trim().toLowerCase();
  // Strip query params or hash
  clean = clean.split("?")[0].split("#")[0];
  // Strip leading and trailing slashes
  clean = clean.replace(/^\/+|\/+$/g, "");
  if (!clean) return "dashboard";

  // Match nested reports e.g. "reports/bookings" -> "report-bookings" or "reports"
  if (clean.startsWith("reports/")) {
    const sub = clean.replace("reports/", "");
    return `report-${sub}`;
  }

  return clean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize session on mount
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // 1. Check existing signed session cookie/storage
        const existingSession = await getClientSession();
        if (existingSession && isMounted) {
          setUser({
            userId: existingSession.userId,
            role: existingSession.role,
            name: existingSession.name,
            email: existingSession.email,
            mobileNumber: existingSession.mobileNumber,
            permissions: existingSession.permissions || {},
          });
          setLoading(false);
          return;
        }

        // 2. Fallback check Firebase Auth
        const unsub = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
          if (!isMounted) return;
          if (fbUser) {
            const adminUser: AuthUser = {
              userId: fbUser.uid,
              role: "admin",
              name: fbUser.displayName || fbUser.email?.split("@")[0] || "Administrator",
              email: fbUser.email || undefined,
            };
            setUser(adminUser);
            await saveAuthSession(adminUser);
          } else {
            // Check if staff session exists before resetting
            const staffSession = await getClientSession();
            if (staffSession && staffSession.role === "staff") {
              setUser({
                userId: staffSession.userId,
                role: "staff",
                name: staffSession.name,
                mobileNumber: staffSession.mobileNumber,
                permissions: staffSession.permissions || {},
              });
            } else {
              setUser(null);
              clearClientSession();
            }
          }
          setLoading(false);
        });

        return () => unsub();
      } catch (err) {
        console.warn("Auth initialization warning:", err);
        if (isMounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // --- Login as Admin (Firebase Auth Email/Password) ---
  const loginAdmin = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = cred.user;
      const adminSession: AuthUser = {
        userId: fbUser.uid,
        role: "admin",
        name: fbUser.displayName || fbUser.email?.split("@")[0] || "Administrator",
        email: fbUser.email || email.trim(),
      };
      await saveAuthSession(adminSession);
      setUser(adminSession);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Login as Staff (Mobile Number + MPIN) ---
  const loginStaff = useCallback(async (mobileNumber: string, mpin: string) => {
    setLoading(true);
    try {
      const cleanPhone = mobileNumber.replace(/\D/g, "").slice(-10);
      if (cleanPhone.length !== 10) {
        throw new Error("Please enter a valid 10-digit mobile number.");
      }
      if (!mpin || mpin.trim().length < 4) {
        throw new Error("Please enter your 4-6 digit MPIN.");
      }

      // Query staff record in Firestore
      const q = query(
        collection(db, "staff"),
        where("mobileNumber", "==", cleanPhone),
        limit(1)
      );
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        throw new Error("Staff account not found with this mobile number.");
      }

      const staffDoc = querySnap.docs[0];
      const data = staffDoc.data();

      // Check account status
      if (data.status === "Inactive") {
        throw new Error("Your account has been deactivated. Please contact your manager.");
      }

      // Verify MPIN against salted SHA-256 hash
      const isValid = await verifyMpin(mpin.trim(), cleanPhone, data.mpinHash);
      if (!isValid) {
        throw new Error("Invalid MPIN. Please try again.");
      }

      const staffSession: AuthUser = {
        userId: staffDoc.id,
        role: "staff",
        name: data.name || "Staff Member",
        mobileNumber: cleanPhone,
        permissions: data.permissions || {},
      };

      await saveAuthSession(staffSession);
      setUser(staffSession);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Logout ---
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    clearClientSession();
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  // --- Permission Helpers ---
  const canView = useCallback(
    (pathOrId: string): boolean => {
      if (!user) return false;
      // Administrator has full view access to all modules
      if (user.role === "admin") return true;

      const key = normalizePermissionKey(pathOrId);

      // Staff access is strictly determined by permissions
      const perm = user.permissions?.[key];
      return perm === "view" || perm === "view_edit";
    },
    [user]
  );

  const canEdit = useCallback(
    (pathOrId: string): boolean => {
      if (!user) return false;
      // Administrator has full edit access to all modules
      if (user.role === "admin") return true;

      const key = normalizePermissionKey(pathOrId);

      // Staff access: requires view_edit
      const perm = user.permissions?.[key];
      return perm === "view_edit";
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginAdmin,
        loginStaff,
        logout,
        canView,
        canEdit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
