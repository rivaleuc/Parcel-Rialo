"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import { makeClient } from "@/lib/client";
import { useAuth } from "@/lib/auth";
import type { Escrow } from "@parcel/sdk";

export default function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { ready, userId, login, getToken } = useAuth();
  const client = useMemo(() => makeClient(getToken), [getToken]);
  const [escrow, setEscrow] = useState<Escrow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticking, setTicking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const e = await client.getEscrow(id);
        if (!cancelled) {
          setEscrow(e);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoaded(true);
        }
      }
    }
    load();
  }, [client, id, userId]);

  // Auto-tick every 3 seconds while not resolved. On Rialo this happens inside
  // the chain itself; here the UI nudges the server-authoritative tick.
  useEffect(() => {
    if (!escrow) return;
    if (escrow.status === "delivered" || escrow.status === "refunded") return;
    const i = setInterval(async () => {
      setTicking(true);
      try {
        const next = await client.tick(id);
        setEscrow(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setTicking(false);
      }
    }, 3_000);
    return () => clearInterval(i);
  }, [client, id, escrow?.status]);

  if (ready && !userId) {
    return (
      <main>
        <div className="card text-center py-16">
          <h1 className="text-xl font-bold">Sign in to view this escrow</h1>
          <button onClick={login} className="btn mt-5 inline-flex">
            Sign in
          </button>
        </div>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main className="card animate-pulse">
        <div className="h-6 w-48 bg-[color:var(--color-line)] rounded" />
        <div className="mt-3 h-4 w-32 bg-[color:var(--color-line-soft)] rounded" />
      </main>
    );
  }
  if (!escrow) {
    return (
      <main className="card text-center py-16">
        <div className="text-base font-semibold">Escrow not found</div>
        <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
          This escrow may have been created in a different browser, or local
          state was cleared.
        </p>
        <a href="/escrow/new" className="btn mt-5 inline-flex">
          Create a new one
        </a>
      </main>
    );
  }

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

      {error && (
        <div
          className="rounded-lg border border-[#f8c8c8] bg-[#fcefef] text-[#7a1f1f] text-sm font-semibold px-4 py-3"
          role="status"
        >
          Carrier poll failed: {error}. Retrying.
        </div>
      )}

      <StageBar status={escrow.status} />

      <div className="grid md:grid-cols-[1.1fr_1fr] gap-4">
        <div className="card grid grid-cols-2 gap-x-8 gap-y-5 content-start">
          <Field label="Amount" value={`${amount} USDC`} />
          <Field label="Carrier" value={escrow.carrier} />
          <Field label="Buyer" value={escrow.buyer} mono />
          <Field label="Seller" value={escrow.seller} mono />
          <Field label="Deadline" value={deadlineDate} />
          <Field
            label="Last carrier status"
            value={(escrow.lastCarrierStatus ?? "not polled yet").replace("_", " ")}
          />
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-ink-soft)]">
              Lifecycle
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[color:var(--color-ink-faint)]">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  ticking ? "bg-[color:var(--color-accent)]" : "bg-[color:var(--color-line)]"
                }`}
              />
              {isResolved(escrow.status)
                ? "settled"
                : ticking
                ? "polling carrier"
                : "waiting"}
            </div>
          </div>
          <Timeline events={escrow.history} />
        </div>
      </div>

      <p className="text-xs text-[color:var(--color-ink-faint)] max-w-2xl">
        On Rialo the contract drives this loop itself: HTTPS Pulse reads the
        carrier, a native timer puts it back to sleep. Here the page ticks
        every three seconds to stand in for the chain.
      </p>
    </main>
  );
}

function isResolved(s: Escrow["status"]) {
  return s === "delivered" || s === "refunded";
}

const STAGES = [
  { key: "funded", label: "Funded" },
  { key: "in_transit", label: "In transit" },
  { key: "settled", label: "Settled" },
] as const;

function StageBar({ status }: { status: Escrow["status"] }) {
  // Map the four statuses onto three visual stages.
  const activeIndex =
    status === "funded" ? 0 : status === "in_transit" ? 1 : 2;
  const settledLabel =
    status === "refunded" ? "Refunded" : status === "delivered" ? "Delivered" : "Settled";

  return (
    <div className="card">
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          const label = i === 2 ? settledLabel : stage.label;
          const reached = done || active;
          return (
            <div key={stage.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-colors ${
                    reached
                      ? status === "refunded" && i === 2
                        ? "bg-[#7a1f1f] border-[#7a1f1f] text-white"
                        : "bg-[color:var(--color-accent)] border-[color:var(--color-accent)] text-white"
                      : "bg-white border-[color:var(--color-line)] text-[color:var(--color-ink-faint)]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    reached ? "text-[color:var(--color-ink)]" : "text-[color:var(--color-ink-faint)]"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 -mt-6 rounded ${
                    i < activeIndex
                      ? "bg-[color:var(--color-accent)]"
                      : "bg-[color:var(--color-line)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: Escrow["history"] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-[color:var(--color-ink-faint)]">No events yet.</p>
    );
  }
  const dotColor: Record<string, string> = {
    created: "var(--color-accent)",
    carrier_update: "var(--color-ink-faint)",
    released: "#14532d",
    refunded: "#7a1f1f",
  };
  return (
    <ol className="relative">
      {events.map((e, i) => (
        <li key={i} className="relative pl-6 pb-5 last:pb-0">
          {i < events.length - 1 && (
            <span className="absolute left-[5px] top-3 bottom-0 w-px bg-[color:var(--color-line)]" />
          )}
          <span
            className="absolute left-0 top-1 w-[11px] h-[11px] rounded-full border-2 border-white"
            style={{ background: dotColor[e.kind] ?? "var(--color-ink-faint)" }}
          />
          <div className="text-sm font-semibold leading-snug">{e.detail}</div>
          <div className="text-xs text-[color:var(--color-ink-faint)] mt-0.5 font-mono">
            {new Date(e.at * 1000).toLocaleTimeString()}
          </div>
        </li>
      ))}
    </ol>
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
