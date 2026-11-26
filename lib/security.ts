// Cryptographic and security utilities for RK Travels authentication

const AUTH_SALT =
  process.env.NEXT_PUBLIC_AUTH_SALT || "rk-travels-sec-auth-2026-x9948228877";

/**
 * Hashes an MPIN combined with the staff member's mobile number and a secret salt
 * using SHA-256 via Web Crypto API (supported across browser, Edge runtime, and Node).
 */
export async function hashMpin(
  mpin: string,
  mobileNumber: string
): Promise<string> {
  const cleanPhone = mobileNumber.replace(/\D/g, "").slice(-10);
  const cleanPin = mpin.trim();
  const input = `${cleanPhone}#${cleanPin}#${AUTH_SALT}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifies if an entered MPIN matches the stored hash
 */
export async function verifyMpin(
  mpin: string,
  mobileNumber: string,
  storedHash: string
): Promise<boolean> {
  if (!mpin || !storedHash) return false;
  const computed = await hashMpin(mpin, mobileNumber);
  return computed === storedHash;
}

/**
 * Generates an HMAC-like SHA-256 signature for session verification
 */
export async function signSessionPayload(payloadString: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${payloadString}@@${AUTH_SALT}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AuthSessionData {
  userId: string;
  role: "admin" | "staff";
  name: string;
  email?: string;
  mobileNumber?: string;
  permissions?: Record<string, "view" | "view_edit">;
  expiresAt: number;
}

function safeBase64Encode(str: string): string {
  try {
    if (typeof btoa === "function") {
      return btoa(unescape(encodeURIComponent(str)));
    }
  } catch (e) {}
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return "";
}

function safeBase64Decode(base64: string): string {
  try {
    if (typeof atob === "function") {
      return decodeURIComponent(escape(atob(base64)));
    }
  } catch (e) {}
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf-8");
  }
  return "";
}

/**
 * Encodes session data into a signed string: base64(json).signature
 */
export async function createSignedSessionToken(
  session: AuthSessionData
): Promise<string> {
  const json = JSON.stringify(session);
  const base64 = safeBase64Encode(json);
  const signature = await signSessionPayload(base64);
  return `${base64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token. Returns null if invalid or expired.
 */
export async function verifySignedSessionToken(
  token: string
): Promise<AuthSessionData | null> {
  if (!token || !token.includes(".")) return null;
  const [base64, signature] = token.split(".");
  if (!base64 || !signature) return null;

  const expectedSignature = await signSessionPayload(base64);
  if (signature !== expectedSignature) return null;

  try {
    const json = safeBase64Decode(base64);
    if (!json) return null;
    const data: AuthSessionData = JSON.parse(json);

    // Verify expiry
    if (data.expiresAt && Date.now() > data.expiresAt) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}
