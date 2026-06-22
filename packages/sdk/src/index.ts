// Parcel SDK
// Typed client for the pay-on-delivery escrow.
// Backed by an in-memory simulator until Rialo testnet ships; the public
// surface is the only thing the rest of the app should depend on.

export type EscrowId = string;

export type EscrowStatus =
  | "funded"        // buyer locked USDC, waiting on carrier
  | "in_transit"   // carrier has picked up
  | "delivered"    // carrier reported delivered, funds released to seller
  | "refunded"     // deadline passed without delivery, refund sent to buyer
  | "disputed";    // optional: human flagged

export interface EscrowEvent {
  at: number;               // unix seconds
  kind:
    | "created"             // funds locked
    | "carrier_update"      // a new carrier status was observed
    | "released"            // paid to seller
    | "refunded";           // returned to buyer
  detail: string;           // human-readable line
  carrierStatus?: string;   // raw carrier status, when relevant
}

export interface Escrow {
  id: EscrowId;
  owner: string;           // authenticated identity that created the escrow
  buyer: string;
  seller: string;
  amount: string;          // USDC, stringified bigint (6 decimals)
  tracking: string;        // carrier tracking id
  carrier: "mock" | "ups";
  deadline: number;        // unix seconds
  status: EscrowStatus;
  createdAt: number;
  resolvedAt?: number;
  lastCarrierStatus?: string;
  history: EscrowEvent[];  // ordered, append-only
}

export interface CreateEscrowInput {
  owner: string;
  buyer: string;
  seller: string;
  amount: string;
  tracking: string;
  carrier: "mock" | "ups";
  deadlineSeconds: number; // seconds from now
}

// ---------- pure lifecycle (shared by simulator and server) ----------

/** Throws with a human-readable message if the input is invalid. */
export function validateCreateInput(input: CreateEscrowInput): void {
  if (!input.tracking.trim()) throw new Error("tracking id is required");
  if (!input.buyer.trim() || !input.seller.trim())
    throw new Error("buyer and seller are required");
  if (!input.owner.trim()) throw new Error("owner is required");
  let amt: bigint;
  try {
    amt = BigInt(input.amount);
  } catch {
    throw new Error("amount must be an integer (in USDC base units)");
  }
  if (amt <= 0n) throw new Error("amount must be greater than zero");
  if (input.deadlineSeconds <= 0) throw new Error("deadline must be in the future");
}

function usdc(amount: string): string {
  return (Number(amount) / 1_000_000).toFixed(2);
}

/** Build a fresh escrow in the `funded` state. */
export function newEscrow(input: CreateEscrowInput, id: EscrowId, t: number): Escrow {
  return {
    id,
    owner: input.owner,
    buyer: input.buyer,
    seller: input.seller,
    amount: input.amount,
    tracking: input.tracking,
    carrier: input.carrier,
    deadline: t + input.deadlineSeconds,
    status: "funded",
    createdAt: t,
    history: [
      {
        at: t,
        kind: "created",
        detail: `${usdc(input.amount)} USDC locked, watching ${input.tracking}`,
      },
    ],
  };
}

/**
 * Apply one observed carrier status to an escrow at time `t`, mutating it in
 * place. This is the contract's reactive decision, expressed as a pure step so
 * the simulator and the server settle identically.
 */
export function applyCarrierStatus(e: Escrow, carrierStatus: string, t: number): Escrow {
  if (e.status === "delivered" || e.status === "refunded") return e;

  if (carrierStatus !== e.lastCarrierStatus) {
    e.history.push({
      at: t,
      kind: "carrier_update",
      detail: `Carrier reported "${carrierStatus.replace("_", " ")}"`,
      carrierStatus,
    });
  }
  e.lastCarrierStatus = carrierStatus;

  if (carrierStatus === "delivered") {
    e.status = "delivered";
    e.resolvedAt = t;
    e.history.push({
      at: t,
      kind: "released",
      detail: `${usdc(e.amount)} USDC released to ${e.seller}`,
    });
  } else if (carrierStatus === "in_transit" || carrierStatus === "picked_up") {
    e.status = "in_transit";
  } else if (t >= e.deadline) {
    e.status = "refunded";
    e.resolvedAt = t;
    e.history.push({
      at: t,
      kind: "refunded",
      detail: `Deadline passed, ${usdc(e.amount)} USDC refunded to ${e.buyer}`,
    });
  }
  return e;
}

/** Poll a carrier endpoint and return the raw status string. */
export async function pollCarrierStatus(
  carrierBaseUrl: string,
  tracking: string,
  carrier: "mock" | "ups"
): Promise<string> {
  const url = `${carrierBaseUrl}/${encodeURIComponent(tracking)}?carrier=${carrier}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`carrier ${res.status}`);
  const json = (await res.json()) as { status: string };
  return json.status;
}

export interface ParcelClient {
  createEscrow(input: CreateEscrowInput): Promise<Escrow>;
  getEscrow(id: EscrowId): Promise<Escrow | null>;
  listEscrows(): Promise<Escrow[]>;
  // The contract is supposed to do this on its own (reactive). In the simulator
  // we expose it so the UI can trigger a tick. On Rialo testnet this call is a
  // no-op (the chain itself drives the workflow).
  tick(id: EscrowId): Promise<Escrow>;
}

// ---------- simulator backend ----------

interface SimulatorConfig {
  carrierBaseUrl: string; // e.g. "/api/mock-carrier" or full URL for ups proxy
  now?: () => number;
  /**
   * Optional key/value store for persistence across reloads. Pass `localStorage`
   * in the browser; omit on the server to fall back to in-memory only.
   */
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
  storageKey?: string;
}

export function createSimulatorClient(cfg: SimulatorConfig): ParcelClient {
  const now = cfg.now ?? (() => Math.floor(Date.now() / 1000));
  const key = cfg.storageKey ?? "parcel.escrows.v1";

  // Hydrate from storage on boot. Bad JSON is silently dropped.
  const store = new Map<EscrowId, Escrow>();
  if (cfg.storage) {
    try {
      const raw = cfg.storage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw) as Escrow[];
        for (const e of arr) store.set(e.id, e);
      }
    } catch {}
  }
  function persist() {
    if (!cfg.storage) return;
    try {
      cfg.storage.setItem(key, JSON.stringify(Array.from(store.values())));
    } catch {}
  }

  return {
    async createEscrow(input) {
      validateCreateInput(input);
      const e = newEscrow(input, crypto.randomUUID(), now());
      store.set(e.id, e);
      persist();
      return e;
    },
    async getEscrow(id) {
      return store.get(id) ?? null;
    },
    async listEscrows() {
      return Array.from(store.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    async tick(id) {
      const e = store.get(id);
      if (!e) throw new Error("escrow not found");
      if (e.status === "delivered" || e.status === "refunded") return e;

      const carrierStatus = await pollCarrierStatus(
        cfg.carrierBaseUrl,
        e.tracking,
        e.carrier
      ).catch(() => "unknown");

      applyCarrierStatus(e, carrierStatus, now());
      store.set(id, e);
      persist();
      return e;
    },
  };
}

// ---------- http backend (talks to the Next.js API) ----------

interface HttpConfig {
  /** Base path of the escrow API, e.g. "/api/escrows" or an absolute URL. */
  baseUrl: string;
  /** Optional bearer token (e.g. a Privy access token) for authenticated calls. */
  getToken?: () => Promise<string | null> | string | null;
}

export function createHttpClient(cfg: HttpConfig): ParcelClient {
  async function authHeaders(): Promise<Record<string, string>> {
    const token = cfg.getToken ? await cfg.getToken() : null;
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(await authHeaders()),
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let msg = `request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }
    return (await res.json()) as T;
  }

  return {
    createEscrow(input) {
      validateCreateInput(input);
      return req<Escrow>("", { method: "POST", body: JSON.stringify(input) });
    },
    async getEscrow(id) {
      try {
        return await req<Escrow>(`/${encodeURIComponent(id)}`);
      } catch (e) {
        if (e instanceof Error && /404|not found/i.test(e.message)) return null;
        throw e;
      }
    },
    listEscrows() {
      return req<Escrow[]>("");
    },
    tick(id) {
      return req<Escrow>(`/${encodeURIComponent(id)}/tick`, { method: "POST" });
    },
  };
}
