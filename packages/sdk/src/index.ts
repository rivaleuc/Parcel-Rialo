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

export interface Escrow {
  id: EscrowId;
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
}

export interface CreateEscrowInput {
  buyer: string;
  seller: string;
  amount: string;
  tracking: string;
  carrier: "mock" | "ups";
  deadlineSeconds: number; // seconds from now
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
}

export function createSimulatorClient(cfg: SimulatorConfig): ParcelClient {
  const store = new Map<EscrowId, Escrow>();
  const now = cfg.now ?? (() => Math.floor(Date.now() / 1000));

  async function pollCarrier(tracking: string, carrier: "mock" | "ups"): Promise<string> {
    const url = `${cfg.carrierBaseUrl}/${encodeURIComponent(tracking)}?carrier=${carrier}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`carrier ${res.status}`);
    const json = (await res.json()) as { status: string };
    return json.status;
  }

  return {
    async createEscrow(input) {
      const id = crypto.randomUUID();
      const e: Escrow = {
        id,
        buyer: input.buyer,
        seller: input.seller,
        amount: input.amount,
        tracking: input.tracking,
        carrier: input.carrier,
        deadline: now() + input.deadlineSeconds,
        status: "funded",
        createdAt: now(),
      };
      store.set(id, e);
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

      // Reactive logic: poll carrier, then check deadline.
      const carrierStatus = await pollCarrier(e.tracking, e.carrier).catch(() => "unknown");
      e.lastCarrierStatus = carrierStatus;

      if (carrierStatus === "delivered") {
        e.status = "delivered";
        e.resolvedAt = now();
      } else if (carrierStatus === "in_transit" || carrierStatus === "picked_up") {
        e.status = "in_transit";
      } else if (now() >= e.deadline) {
        e.status = "refunded";
        e.resolvedAt = now();
      }

      store.set(id, e);
      return e;
    },
  };
}
