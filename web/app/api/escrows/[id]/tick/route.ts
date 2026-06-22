import { NextResponse } from "next/server";
import { applyCarrierStatus } from "@parcel/sdk";
import { getRepo } from "@/lib/server/repo";
import { getIdentity } from "@/lib/server/auth";
import { pollCarrier } from "@/lib/server/carrier";

// POST /api/escrows/:id/tick
// Server-authoritative settlement step. Stands in for the Rialo contract's
// reactive loop: poll the carrier, apply the decision, persist.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const identity = await getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const repo = getRepo();
  const escrow = await repo.get(id);
  if (!escrow || escrow.owner !== identity.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (escrow.status === "delivered" || escrow.status === "refunded") {
    return NextResponse.json(escrow);
  }

  const carrierStatus = await pollCarrier(req, escrow.tracking, escrow.carrier);
  applyCarrierStatus(escrow, carrierStatus, Math.floor(Date.now() / 1000));
  await repo.update(escrow);
  return NextResponse.json(escrow);
}
