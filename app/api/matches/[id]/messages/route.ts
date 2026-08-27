import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { matches, messages } from "../../../../../db/schema";

function getRole(match: { hostToken: string; guestToken: string | null }, token: string | null) {
  if (token && token === match.hostToken) return "wood";
  if (token && token === match.guestToken) return "stone";
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("x-player-token");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (!getRole(match, token)) return Response.json({ error: "A valid player token is required" }, { status: 401 });
  const cursor = Number(new URL(request.url).searchParams.get("after") ?? 0);
  const rows = await db.select().from(messages).where(cursor ? and(eq(messages.matchId, id), gt(messages.id, cursor)) : eq(messages.matchId, id)).limit(100);
  return Response.json({ messages: rows });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("x-player-token");
  const payload = (await request.json()) as { name?: string; body?: string };
  const body = payload.body?.trim();
  if (!body || body.length > 240) return Response.json({ error: "Message must be 1 to 240 characters" }, { status: 400 });
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match || !getRole(match, token)) return Response.json({ error: "A valid player token is required" }, { status: 401 });
  const [message] = await db.insert(messages).values({ matchId: id, senderToken: token!, senderName: payload.name?.trim().slice(0, 40) || "Guest", body }).returning();
  return Response.json({ message }, { status: 201 });
}