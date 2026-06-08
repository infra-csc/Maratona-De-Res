import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isImpersonating: boolean;
  realUser: User | null;
  impersonate: (token: string, user: User) => void;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "maratona_token";
const USER_KEY = "maratona_user";
const REAL_TOKEN_KEY = "maratona_real_token";
const REAL_USER_KEY = "maratona_real_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    const savedRealUser = localStorage.getItem(REAL_USER_KEY);
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    if (savedRealUser) setRealUser(JSON.parse(savedRealUser));
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    setRealUser(null);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    localStorage.removeItem(REAL_TOKEN_KEY);
    localStorage.removeItem(REAL_USER_KEY);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setRealUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REAL_TOKEN_KEY);
    localStorage.removeItem(REAL_USER_KEY);
  }, []);

  const impersonate = useCallback((newToken: string, newUser: User) => {
    // Preserve the real (admin) session the first time we enter dev mode.
    if (!localStorage.getItem(REAL_TOKEN_KEY)) {
      const curToken = localStorage.getItem(TOKEN_KEY);
      const curUser = localStorage.getItem(USER_KEY);
      if (curToken && curUser) {
        localStorage.setItem(REAL_TOKEN_KEY, curToken);
        localStorage.setItem(REAL_USER_KEY, curUser);
        setRealUser(JSON.parse(curUser));
      }
    }
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const stopImpersonating = useCallback(() => {
    const realToken = localStorage.getItem(REAL_TOKEN_KEY);
    const real = localStorage.getItem(REAL_USER_KEY);
    setRealUser(null);
    localStorage.removeItem(REAL_TOKEN_KEY);
    localStorage.removeItem(REAL_USER_KEY);
    if (realToken && real) {
      setToken(realToken);
      setUser(JSON.parse(real));
      localStorage.setItem(TOKEN_KEY, realToken);
      localStorage.setItem(USER_KEY, real);
    } else {
      // Real session lost/inconsistent — force a full logout instead of
      // silently leaving the admin on the impersonated session.
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isImpersonating: realUser !== null,
        realUser,
        impersonate,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
