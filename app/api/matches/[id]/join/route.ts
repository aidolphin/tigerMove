import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { matches } from "../../../../../db/schema";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  if (!match) return Response.json({ error: "Match not found" }, { status: 404 });
  if (match.guestToken) return Response.json({ error: "Match already has two players" }, { status: 409 });

  const guestToken = crypto.randomUUID();
  const [updated] = await db
    .update(matches)
    .set({ guestToken, status: "active", updatedAt: new Date().toISOString() })
    .where(eq(matches.id, id))
    .returning();
  return Response.json({
    match: { id: updated.id, state: updated.state, status: updated.status, createdAt: updated.createdAt, updatedAt: updated.updatedAt },
    role: "stone",
    token: guestToken,
  });
}