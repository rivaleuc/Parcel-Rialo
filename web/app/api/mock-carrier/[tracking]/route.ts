import { NextRequest, NextResponse } from "next/server";

// Mock carrier endpoint.
// Behavior is deterministic based on the tracking id, so the same id always
// produces the same timeline relative to its creation time stored in memory.
// Real UPS sandbox can be enabled via UPS_API_KEY (proxy off to it).

interface Memory {
  createdAt: number;
  scenario: Scenario;
}

type Scenario = "fast" | "normal" | "slow" | "lost";

const created = new Map<string, Memory>();

function scenarioFor(tracking: string): Scenario {
  const t = tracking.toLowerCase();
  if (t.includes("fast")) return "fast";
  if (t.includes("lost") || t.includes("stuck")) return "lost";
  if (t.includes("slow")) return "slow";
  return "normal";
}

function statusFor(scenario: Scenario, ageSeconds: number): string {
  // Each scenario has its own timeline.
  const timeline: Record<Scenario, Array<[number, string]>> = {
    fast:   [[0, "picked_up"], [15, "in_transit"], [30, "delivered"]],
    normal: [[0, "picked_up"], [60, "in_transit"], [180, "delivered"]],
    slow:   [[0, "label_created"], [120, "picked_up"], [600, "in_transit"], [1800, "delivered"]],
    lost:   [[0, "label_created"], [60, "picked_up"], [120, "in_transit"]],
  };
  let current = "unknown";
  for (const [t, s] of timeline[scenario]) {
    if (ageSeconds >= t) current = s;
  }
  return current;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tracking: string }> }
) {
  const { tracking } = await ctx.params;
  const carrier = req.nextUrl.searchParams.get("carrier") ?? "mock";

  if (carrier === "ups" && process.env.UPS_API_KEY) {
    // Real UPS sandbox path. Kept minimal — proxy and surface the same shape.
    try {
      const r = await fetch(
        `https://wwwcie.ups.com/api/track/v1/details/${encodeURIComponent(tracking)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPS_API_KEY}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );
      if (!r.ok) throw new Error(`ups ${r.status}`);
      const data = await r.json();
      const raw =
        data?.trackResponse?.shipment?.[0]?.package?.[0]?.currentStatus
          ?.description ?? "unknown";
      const status = normalizeUps(String(raw));
      return NextResponse.json({ status, source: "ups", raw });
    } catch (e) {
      return NextResponse.json(
        { status: "unknown", source: "ups", error: String(e) },
        { status: 200 }
      );
    }
  }

  // Mock path.
  let mem = created.get(tracking);
  if (!mem) {
    mem = { createdAt: Math.floor(Date.now() / 1000), scenario: scenarioFor(tracking) };
    created.set(tracking, mem);
  }
  const age = Math.floor(Date.now() / 1000) - mem.createdAt;
  const status = statusFor(mem.scenario, age);

  return NextResponse.json({
    status,
    source: "mock",
    scenario: mem.scenario,
    ageSeconds: age,
  });
}

function normalizeUps(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("delivered")) return "delivered";
  if (r.includes("transit") || r.includes("on the way")) return "in_transit";
  if (r.includes("picked up") || r.includes("origin scan")) return "picked_up";
  if (r.includes("label")) return "label_created";
  return "unknown";
}
