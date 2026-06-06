"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getClient } from "@/lib/client";

type Form = {
  buyer: string;
  seller: string;
  amount: string;
  tracking: string;
  carrier: "mock" | "ups";
  deadlineDays: string;
};

function validate(f: Form): Partial<Record<keyof Form, string>> {
  const errs: Partial<Record<keyof Form, string>> = {};
  if (!f.buyer.trim()) errs.buyer = "Required";
  if (!f.seller.trim()) errs.seller = "Required";
  if (!f.tracking.trim()) errs.tracking = "Required";
  const amt = Number(f.amount);
  if (!Number.isFinite(amt) || amt <= 0) errs.amount = "Must be greater than zero";
  const days = Number(f.deadlineDays);
  if (!Number.isFinite(days) || days <= 0) errs.deadlineDays = "Must be at least one day";
  return errs;
}

export default function NewEscrowPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [form, setForm] = useState<Form>({
    buyer: "buyer.rialo",
    seller: "seller.rialo",
    amount: "100",
    tracking: "DEMO-FAST-001",
    carrier: "mock",
    deadlineDays: "30",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    try {
      const escrow = await getClient().createEscrow({
        buyer: form.buyer.trim(),
        seller: form.seller.trim(),
        amount: String(BigInt(Math.round(Number(form.amount) * 1_000_000))),
        tracking: form.tracking.trim(),
        carrier: form.carrier,
        deadlineSeconds: Number(form.deadlineDays) * 86_400,
      });
      router.push(`/escrow/${escrow.id}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : String(err));
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

      <form onSubmit={submit} className="card mt-8 space-y-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Buyer"
            error={errors.buyer}
            input={
              <input className="input" value={form.buyer} onChange={(e) => set("buyer", e.target.value)} />
            }
          />
          <Field
            label="Seller"
            error={errors.seller}
            input={
              <input className="input" value={form.seller} onChange={(e) => set("seller", e.target.value)} />
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Amount (USDC)"
            error={errors.amount}
            input={
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            }
          />
          <Field
            label="Deadline (days)"
            error={errors.deadlineDays}
            input={
              <input
                className="input"
                type="number"
                min="1"
                value={form.deadlineDays}
                onChange={(e) => set("deadlineDays", e.target.value)}
              />
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Tracking id"
            error={errors.tracking}
            input={
              <input className="input" value={form.tracking} onChange={(e) => set("tracking", e.target.value)} />
            }
          />
          <Field
            label="Carrier"
            input={
              <select
                className="input"
                value={form.carrier}
                onChange={(e) => set("carrier", e.target.value as "mock" | "ups")}
              >
                <option value="mock">Mock (built-in)</option>
                <option value="ups">UPS sandbox (needs API key)</option>
              </select>
            }
          />
        </div>

        {serverError && (
          <div
            className="rounded-lg border border-[#f8c8c8] bg-[#fcefef] text-[#7a1f1f] text-sm font-semibold px-4 py-3"
            role="alert"
          >
            {serverError}
          </div>
        )}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Locking funds..." : "Create escrow"}
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  input,
  error,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {input}
      {error && (
        <div className="mt-1.5 text-xs font-semibold text-[#7a1f1f]">{error}</div>
      )}
    </div>
  );
}
