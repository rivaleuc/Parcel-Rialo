"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { makeClient } from "@/lib/client";
import { useAuth } from "@/lib/auth";
import type { Escrow } from "@parcel/sdk";

export default function EscrowsPage() {
  const { ready, userId, login, getToken } = useAuth();
  const client = useMemo(() => makeClient(getToken), [getToken]);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const list = await client.listEscrows().catch(() => []);
      if (!cancelled) {
        setEscrows(list);
        setLoaded(true);
      }
    }
    load();
    const i = setInterval(load, 2_000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, [client, userId]);

  if (ready && !userId) {
    return (
      <main>
        <div className="card text-center py-16">
          <h1 className="text-xl font-bold">Sign in to view your escrows</h1>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
            Each escrow is tied to the account that created it.
          </p>
          <button onClick={login} className="btn mt-5 inline-flex">
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Escrows</h1>
        <Link href="/escrow/new" className="btn">
          New escrow
        </Link>
      </div>

      {!loaded ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-32 bg-[color:var(--color-line)] rounded" />
              <div className="mt-3 h-3 w-48 bg-[color:var(--color-line-soft)] rounded" />
            </div>
          ))}
        </div>
      ) : escrows.length === 0 ? (
        <div className="card text-center">
          <div className="text-base font-semibold">No escrows yet</div>
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            Create one to see the contract drive the lifecycle on its own.
          </p>
          <Link href="/escrow/new" className="btn mt-5 inline-flex">
            Create the first escrow
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {escrows.map((e) => (
            <Link
              key={e.id}
              href={`/escrow/${e.id}`}
              className="card block hover:border-[color:var(--color-accent)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{e.tracking}</div>
                  <div className="text-xs text-[color:var(--color-ink-soft)] mt-1">
                    {e.buyer} → {e.seller}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`tag tag-${e.status}`}>{e.status.replace("_", " ")}</span>
                  <div className="mt-2 font-bold tabular-nums">
                    {(Number(e.amount) / 1_000_000).toFixed(2)} USDC
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
