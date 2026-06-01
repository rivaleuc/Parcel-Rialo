"use client";

import { createSimulatorClient, type ParcelClient } from "@parcel/sdk";

// Single shared simulator instance for the whole client session.
// In-memory only: refresh wipes state. That is intentional for the demo;
// real persistence will come from Rialo state when testnet ships.

let _client: ParcelClient | null = null;

export function getClient(): ParcelClient {
  if (!_client) {
    _client = createSimulatorClient({
      carrierBaseUrl: "/api/mock-carrier",
    });
  }
  return _client;
}
