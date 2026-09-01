import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { matches, moves } from "../../../../db/schema";
import { applyMove, initialGameState, type GameState, type Point } from "../../../../game/tigermove";
import { getClientIdentifier, createRateLimiter } from "../../../../lib/rate-limit";

const moveLimiter = createRateLimiter();

async function readMatch(id: string) {
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return match;
}

function getRole(match: { hostToken: string; guestToken: string | null }, token: string | null) {
  if (token && token === match.hostToken) return "wood" as const;
  if (token && token === match.guestToken) return "stone" as const;
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const token = request.headers.get("x-player-token");
  const match = await readMatch(id);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  const role = getRole(match, token);
  if (!role) return Response.json({ error: "A valid player token is required" }, { status: 401 });
  return Response.json({
    match: { id: match.id, state: match.state, status: match.status, createdAt: match.createdAt, updatedAt: match.updatedAt },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const identifier = getClientIdentifier(request);
  if (!moveLimiter.check(identifier, 10, 60000)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const payload = (await request.json()) as { pieceId?: string; to?: Point; sequence?: number };
  if (!payload.pieceId || !payload.to || typeof payload.to.x !== "number" || typeof payload.to.y !== "number") {
    return Response.json({ error: "pieceId and valid to coordinates are required" }, { status: 400 });
  }

  const match = await readMatch(id);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  const role = getRole(match, request.headers.get("x-player-token"));
  if (!role) return Response.json({ error: "A valid player token is required" }, { status: 401 });
  if (match.status !== "active") {
    return Response.json({ error: "Match is not active" }, { status: 403 });
  }
  if (role !== (match.state as GameState).turn) {
    return Response.json({ error: "It is not your turn" }, { status: 403 });
  }

  try {
    const state = applyMove(match.state as GameState, payload.pieceId, payload.to);
    const db = getDb();
    await db.insert(moves).values({ matchId: id, pieceId: payload.pieceId, toX: payload.to.x, toY: payload.to.y });
    const [updated] = await db
      .update(matches)
      .set({ state, updatedAt: new Date().toISOString() })
      .where(eq(matches.id, id))
      .returning();
    return Response.json({ match: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid move";
    return Response.json({ error: message }, { status: 422 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const payload = (await request.json()) as { action?: "start" | "end" | "cancel" | "rematch" };
  const match = await readMatch(id);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });

  const role = getRole(match, request.headers.get("x-player-token"));
  if (!role) return Response.json({ error: "A valid player token is required" }, { status: 401 });
  if (!payload.action) return Response.json({ error: "An action is required" }, { status: 400 });

  const allowedActions: Record<string, string> = {
    start: "wood",
    cancel: "wood",
    rematch: "wood",
    end: "stone",
  };

  if (allowedActions[payload.action] !== role) {
    return Response.json({ error: "You are not authorized for this action" }, { status: 403 });
  }

  const db = getDb();
  const currentState = match.state as GameState;
  const state = payload.action === "start" || payload.action === "rematch"
    ? { ...initialGameState(), winnerCounts: currentState.winnerCounts ?? { wood: 0, stone: 0 } }
    : currentState;
  const status = payload.action === "start" || payload.action === "rematch"
    ? "active"
    : payload.action === "cancel"
      ? "cancelled"
      : "ended";
  const [updated] = await db
    .update(matches)
    .set({ state, status, updatedAt: new Date().toISOString() })
    .where(eq(matches.id, id))
    .returning();
  return Response.json({ match: updated });
}
