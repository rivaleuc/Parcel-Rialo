import { NextResponse } from "next/server";
import { getRepo } from "@/lib/server/repo";
import { getIdentity } from "@/lib/server/auth";

// GET /api/escrows/:id -> single escrow, owner-scoped
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const identity = await getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const escrow = await getRepo().get(id);
  if (!escrow || escrow.owner !== identity.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(escrow);
}
