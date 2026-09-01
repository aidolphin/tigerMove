import { getDb } from "../../../db";
import { matches } from "../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const active = await db.select().from(matches).where(eq(matches.status, "active"));
  const waiting = await db.select().from(matches).where(eq(matches.status, "waiting"));
  const onlinePlayers = (active.length + waiting.length) * 2;
  return Response.json({ onlinePlayers, activeMatches: active.length, waitingMatches: waiting.length });
}
