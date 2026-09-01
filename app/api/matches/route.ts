import { getDb } from "../../../db";
import { matches } from "../../../db/schema";
import { initialGameState } from "../../../game/tigermove";
import { getClientIdentifier, createRateLimiter } from "../../../lib/rate-limit";

const moveLimiter = createRateLimiter();

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request);
  if (!moveLimiter.check(identifier, 5, 60000)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const db = getDb();
  const id = crypto.randomUUID();
  const hostToken = crypto.randomUUID();
  const state = initialGameState();

  let shortCode: string | undefined;
  try {
    const body = (await request.json()) as { shortCode?: string };
    if (body.shortCode && typeof body.shortCode === "string") {
      const normalized = body.shortCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,10}$/.test(normalized)) {
        return Response.json({ error: "Invalid short code format" }, { status: 400 });
      }
      shortCode = normalized;
    }
  } catch {
    // ignore body parse error
  }

  const values: { id: string; state: unknown; hostToken: string; status?: string; shortCode?: string } = { id, state, hostToken, status: "waiting" };
  if (shortCode) {
    values.shortCode = shortCode;
  }

  const [match] = await db.insert(matches).values(values).returning();

  return Response.json(
    {
      match: { id: match.id, state: match.state, status: match.status, createdAt: match.createdAt, updatedAt: match.updatedAt },
      role: "wood",
      token: hostToken,
    },
    { status: 201 },
  );
}

export async function GET() {
  return Response.json({ matches: [] });
}
