import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const payload = (await request.json()) as { guestId?: string; name?: string; email?: string };
  const guestId = payload.guestId?.trim();
  const name = payload.name?.trim();
  const email = payload.email?.trim().toLowerCase();
  if (!guestId || !name || name.length > 40) return Response.json({ error: "A valid name is required" }, { status: 400 });
  if (!email || !emailPattern.test(email)) return Response.json({ error: "A valid email is required" }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
  if (existing) {
    const [updated] = await db.update(users).set({ name, email, updatedAt: new Date().toISOString() }).where(eq(users.guestId, guestId)).returning();
    return Response.json({ user: updated });
  }
  const [user] = await db.insert(users).values({ id: crypto.randomUUID(), guestId, name, email }).returning();
  return Response.json({ user }, { status: 201 });
}