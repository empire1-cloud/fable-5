import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, api, tokenStore } from "../lib/api";
import type { Actor } from "../lib/api";

const USER_STORAGE_KEY = "fable5:user";

interface AuthState {
  user: Actor | null;
  /** True while we are still asking the server who we are on first paint. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates the organisation and signs the founder straight in — the server
   *  returns a session, so there is no second credential entry. */
  signup: (organisationName: string, email: string, password: string) => Promise<{ endsAt: string; days: number }>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.auth.me();
      setUser(me.actor);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(me.actor));
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
    const session = await api.auth.login({ email, password });
    tokenStore.set(session.token);
    setUser(session.actor);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.actor));
  }, []);

  const signup = useCallback(async (organisationName: string, email: string, password: string) => {
    const session = await api.auth.signup({ organisationName, email, password });
    tokenStore.set(session.token);
    setUser(session.actor);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(session.actor));
    return session.trial;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    localStorage.removeItem(USER_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
