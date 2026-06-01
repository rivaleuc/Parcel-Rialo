"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/client";
import type { Escrow } from "@parcel/sdk";

export default function EscrowsPage() {
  const [escrows, setEscrows] = useState<Escrow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const list = await getClient().listEscrows();
      if (!cancelled) setEscrows(list);
    }
    load();
    const i = setInterval(load, 2_000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);

  return (
    <main>
      <div className="flex items-end justify-between mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Escrows</h1>
        <Link href="/escrow/new" className="btn">
          New escrow
        </Link>
      </div>

      {escrows.length === 0 ? (
        <div className="card text-center text-[color:var(--color-ink-soft)]">
          No escrows yet. Create one to see the lifecycle.
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
