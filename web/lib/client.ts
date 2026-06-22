"use client";

import { createHttpClient, type ParcelClient } from "@parcel/sdk";

// Talks to the Next.js escrow API. The token comes from the auth layer (a Privy
// access token in production, the dev user id locally). Escrow state lives
// server-side now, owner-scoped, replacing the old localStorage simulator. On
// Rialo testnet this same client points at an RPC-backed endpoint.

export function makeClient(getToken: () => Promise<string | null>): ParcelClient {
  return createHttpClient({
    baseUrl: "/api/escrows",
    getToken,
  });
}
