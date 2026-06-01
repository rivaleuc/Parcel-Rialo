"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { getClient } from "@/lib/client";
import type { Escrow } from "@parcel/sdk";

export default function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const e = await getClient().getEscrow(id);
        if (!cancelled) setEscrow(e);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    }
    load();
  }, [id]);

  // Auto-tick every 3 seconds while not resolved. On Rialo this happens inside
  // the chain — here the UI nudges the simulator on the user's behalf.
  useEffect(() => {
    if (!escrow) return;
    if (escrow.status === "delivered" || escrow.status === "refunded") return;
    const i = setInterval(async () => {
      setTicking(true);
      try {
        const next = await getClient().tick(id);
        setEscrow(next);
      } catch (err) {
        setError(String(err));
      } finally {
        setTicking(false);
      }
    }, 3_000);
    return () => clearInterval(i);
  }, [id, escrow?.status]);

  if (error) return <main className="card text-red-700">{error}</main>;
  if (!escrow)
    return (
      <main className="card text-[color:var(--color-ink-soft)]">Loading...</main>
    );

  const amount = (Number(escrow.amount) / 1_000_000).toFixed(2);
  const deadlineDate = new Date(escrow.deadline * 1000).toLocaleString();

  return (
    <main className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            Escrow
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">
            {escrow.tracking}
          </h1>
        </div>
        <span className={`tag tag-${escrow.status}`}>
          {escrow.status.replace("_", " ")}
        </span>
      </header>

      <div className="card grid md:grid-cols-2 gap-x-8 gap-y-5">
        <Field label="Amount" value={`${amount} USDC`} />
        <Field label="Carrier" value={escrow.carrier} />
        <Field label="Buyer" value={escrow.buyer} mono />
        <Field label="Seller" value={escrow.seller} mono />
        <Field label="Deadline" value={deadlineDate} />
        <Field
          label="Last carrier status"
          value={escrow.lastCarrierStatus ?? "not polled yet"}
        />
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              Reactive workflow
            </div>
            <p className="mt-2 text-sm text-[color:var(--color-ink-soft)] max-w-md">
              On Rialo, the contract polls the carrier on a schedule by itself.
              The simulator approximates that by ticking every three seconds.
            </p>
          </div>
          <div className="text-xs font-mono text-[color:var(--color-ink-soft)]">
            {ticking ? "polling..." : "idle"}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
        {label}
      </div>
      <div className={`mt-1 ${mono ? "font-mono text-sm" : "font-semibold"}`}>
        {value}
      </div>
    </div>
  );
}
