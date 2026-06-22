"use client";

import { useAuth } from "@/lib/auth";

export function AuthButton() {
  const { ready, userId, label, login, logout } = useAuth();

  if (!ready) {
    return (
      <span className="inline-block w-24 h-9 rounded-lg bg-[color:var(--color-line-soft)] animate-pulse" />
    );
  }

  if (!userId) {
    return (
      <button onClick={login} className="btn h-9 px-4">
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="pill h-9" title={userId}>
        <span className="dot" />
        {label}
      </span>
      <button
        onClick={logout}
        className="text-[color:var(--color-ink-faint)] hover:text-[color:var(--color-ink)]"
      >
        Sign out
      </button>
    </div>
  );
}
