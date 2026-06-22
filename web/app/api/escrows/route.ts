import { NextResponse } from "next/server";
import {
  newEscrow,
  validateCreateInput,
  type CreateEscrowInput,
} from "@parcel/sdk";
import { getRepo } from "@/lib/server/repo";
import { getIdentity } from "@/lib/server/auth";
import { randomUUID } from "crypto";

// GET /api/escrows  -> escrows owned by the caller
export async function GET(req: Request) {
  const identity = await getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const repo = getRepo();
  const list = await repo.list(identity.userId);
  return NextResponse.json(list);
}

// POST /api/escrows  -> create a new escrow owned by the caller
export async function POST(req: Request) {
  const identity = await getIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: CreateEscrowInput;
  try {
    body = (await req.json()) as CreateEscrowInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  // The owner always comes from the verified identity, never from the body.
  const input: CreateEscrowInput = { ...body, owner: identity.userId };
  try {
    validateCreateInput(input);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "invalid input" },
      { status: 400 }
    );
  }

  const escrow = newEscrow(input, randomUUID(), Math.floor(Date.now() / 1000));
  await getRepo().insert(escrow);
  return NextResponse.json(escrow, { status: 201 });
}
