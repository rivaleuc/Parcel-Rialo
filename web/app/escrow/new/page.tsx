"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getClient } from "@/lib/client";

export default function NewEscrowPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    buyer: "buyer.rialo",
    seller: "seller.rialo",
    amount: "100",
    tracking: "DEMO-FAST-001",
    carrier: "mock" as "mock" | "ups",
    deadlineDays: "30",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const escrow = await getClient().createEscrow({
        buyer: form.buyer,
        seller: form.seller,
        amount: String(BigInt(Math.round(Number(form.amount) * 1_000_000))),
        tracking: form.tracking,
        carrier: form.carrier,
        deadlineSeconds: Number(form.deadlineDays) * 86_400,
      });
      router.push(`/escrow/${escrow.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <main className="max-w-xl">
      <h1 className="text-3xl font-extrabold tracking-tight">New escrow</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">
        Tracking ids containing <code>fast</code>, <code>slow</code>, or <code>lost</code> drive the mock carrier timeline. Anything else is a normal delivery.
      </p>

      <form onSubmit={submit} className="card mt-8 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Buyer</label>
            <input className="input" value={form.buyer} onChange={(e) => set("buyer", e.target.value)} />
          </div>
          <div>
            <label className="label">Seller</label>
            <input className="input" value={form.seller} onChange={(e) => set("seller", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount (USDC)</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Deadline (days)</label>
            <input
              className="input"
              type="number"
              min="1"
              value={form.deadlineDays}
              onChange={(e) => set("deadlineDays", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tracking id</label>
            <input className="input" value={form.tracking} onChange={(e) => set("tracking", e.target.value)} />
          </div>
          <div>
            <label className="label">Carrier</label>
            <select
              className="input"
              value={form.carrier}
              onChange={(e) => set("carrier", e.target.value as "mock" | "ups")}
            >
              <option value="mock">Mock (built-in)</option>
              <option value="ups">UPS sandbox (needs API key)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Locking funds..." : "Create escrow"}
        </button>
      </form>
    </main>
  );
}
