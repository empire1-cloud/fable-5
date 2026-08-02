import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, api, tokenStore } from "../lib/api";
import type { Me } from "../lib/api";

const USER_STORAGE_KEY = "fable5:user";

interface AuthState {
  user: Me | null;
  /** True while we are still asking the server who we are on first paint. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, orgName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const user = await api.auth.me();
      setUser(user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // A stored token the server no longer honours is not a session.
      tokenStore.clear();
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const token = await api.auth.login({ email, password });
    tokenStore.set(token.access_token);
    try {
      const user = await api.auth.me();
      setUser(user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // If we cannot fetch the user, we still have the token but no user.
      // We'll clear the user state and the stored user.
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, orgName: string) => {
    const token = await api.auth.register({ email, password, org_name: orgName });
    tokenStore.set(token.access_token);
    try {
      const user = await api.auth.me();
      setUser(user);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      setUser(null);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}