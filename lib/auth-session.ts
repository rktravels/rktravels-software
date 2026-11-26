import {
  AuthSessionData,
  createSignedSessionToken,
  verifySignedSessionToken,
} from "./security";

export const AUTH_COOKIE_NAME = "rk_auth_session";
export const AUTH_STORAGE_KEY = "rk_auth_user_session";

// 7 days session duration
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function saveAuthSession(
  session: Omit<AuthSessionData, "expiresAt">,
  durationMs: number = SESSION_DURATION_MS
): Promise<string> {
  const fullSession: AuthSessionData = {
    ...session,
    expiresAt: Date.now() + durationMs,
  };

  const token = await createSignedSessionToken(fullSession);

  if (typeof document !== "undefined") {
    // Save to Cookie (accessible to Next.js proxy/server)
    const maxAgeSec = Math.floor(durationMs / 1000);
    const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(
      token
    )}; path=/; max-age=${maxAgeSec}; SameSite=Lax${secureFlag}`;

    // Also store in localStorage as client fallback
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, token);
    } catch (e) {
      // ignore
    }
  }

  return token;
}

export function getClientSessionCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const c of cookies) {
    const trimmed = c.trim();
    if (trimmed.startsWith(`${AUTH_COOKIE_NAME}=`)) {
      const val = trimmed.substring(AUTH_COOKIE_NAME.length + 1);
      return decodeURIComponent(val);
    }
  }

  // Fallback to localStorage
  try {
    const local = localStorage.getItem(AUTH_STORAGE_KEY);
    if (local) return local;
  } catch (e) {}

  return null;
}

export async function getClientSession(): Promise<AuthSessionData | null> {
  const token = getClientSessionCookie();
  if (!token) return null;
  return await verifySignedSessionToken(token);
}

export function clearClientSession(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {}
  }
}
