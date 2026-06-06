"use client";

import { createSimulatorClient, type ParcelClient } from "@parcel/sdk";

// Single shared simulator instance for the whole client session. Persists to
// localStorage so escrows survive a refresh; on Rialo testnet this is replaced
// by a real RPC-backed client and persistence lives on chain.

let _client: ParcelClient | null = null;

export function getClient(): ParcelClient {
  if (!_client) {
    _client = createSimulatorClient({
      carrierBaseUrl: "/api/mock-carrier",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    });
  }
  return _client;
}
