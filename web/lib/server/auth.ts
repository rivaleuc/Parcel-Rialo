import "server-only";

// Resolve the caller's identity from the Authorization header.
//
// With Privy configured (PRIVY_APP_ID + PRIVY_APP_SECRET), the bearer token is
// a Privy access token we verify and turn into a stable user id. Without those
// env vars, we run in dev mode: the token is taken at face value as the id, so
// the app stays usable locally before credentials are wired in.

export interface Identity {
  userId: string;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function getIdentity(req: Request): Promise<Identity | null> {
  const token = bearer(req);
  if (!token) return null;

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  // Dev mode: no Privy credentials, trust the token as the user id.
  if (!appId || !appSecret) {
    return { userId: token };
  }

  try {
    const { PrivyClient } = await import("@privy-io/server-auth");
    const privy = new PrivyClient(appId, appSecret);
    const claims = await privy.verifyAuthToken(token);
    return { userId: claims.userId };
  } catch {
    return null;
  }
}
