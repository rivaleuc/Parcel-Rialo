"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

// Unified auth surface for the app. Backed by Privy when
// NEXT_PUBLIC_PRIVY_APP_ID is set, otherwise a local dev identity so the app
// stays fully usable before credentials are wired in.

export interface AuthState {
  ready: boolean;
  userId: string | null;
  label: string | null; // short, human-friendly identifier
  login: () => void;
  logout: () => void;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);
const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <Providers>");
  return ctx;
}

export function Providers({ children }: { children: ReactNode }) {
  if (APP_ID) {
    return (
      <PrivyProvider
        appId={APP_ID}
        config={{
          loginMethods: ["email", "google", "wallet"],
          appearance: { theme: "light", accentColor: "#2f6fd0" },
        }}
      >
        <PrivyBridge>{children}</PrivyBridge>
      </PrivyProvider>
    );
  }
  return <DevAuthProvider>{children}</DevAuthProvider>;
}

function short(id: string): string {
  if (id.includes(":")) {
    const tail = id.split(":").pop() ?? id;
    return tail.length > 10 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail;
  }
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

// ---- Privy-backed ----

function PrivyBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();

  const value = useMemo<AuthState>(() => {
    const userId = authenticated && user ? user.id : null;
    const label =
      authenticated && user
        ? user.email?.address ??
          user.google?.email ??
          user.wallet?.address ??
          short(user.id)
        : null;
    return {
      ready,
      userId,
      label: label ? short(label) : null,
      login,
      logout,
      getToken: async () => (authenticated ? await getAccessToken() : null),
    };
  }, [ready, authenticated, user, login, logout, getAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---- Local dev identity ----

const DEV_KEY = "parcel.devUser.v1";

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setUserId(localStorage.getItem(DEV_KEY));
    } catch {}
    setReady(true);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      userId,
      label: userId ? short(userId) : null,
      login: () => {
        const id = `dev:${crypto.randomUUID().slice(0, 8)}`;
        try {
          localStorage.setItem(DEV_KEY, id);
        } catch {}
        setUserId(id);
      },
      logout: () => {
        try {
          localStorage.removeItem(DEV_KEY);
        } catch {}
        setUserId(null);
      },
      // In dev mode the server trusts the token as the user id directly.
      getToken: async () => userId,
    }),
    [ready, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
