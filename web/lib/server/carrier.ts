import "server-only";
import { pollCarrierStatus } from "@parcel/sdk";

// Resolve the carrier base URL for server-side polling. Uses an explicit base
// (env) when present, otherwise derives it from the incoming request origin so
// the same deployment serves both the API and the mock carrier.
export function carrierBaseUrl(req: Request): string {
  const explicit = process.env.CARRIER_BASE_URL;
  if (explicit) return explicit;
  const origin = new URL(req.url).origin;
  return `${origin}/api/mock-carrier`;
}

export async function pollCarrier(
  req: Request,
  tracking: string,
  carrier: "mock" | "ups"
): Promise<string> {
  return pollCarrierStatus(carrierBaseUrl(req), tracking, carrier).catch(
    () => "unknown"
  );
}
