import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getClientIdentifier, createRateLimiter } from "../../../lib/rate-limit";

const profileLimiter = createRateLimiter();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const identifier = getClientIdentifier(request);
    if (!profileLimiter.check(identifier, 10, 60000)) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }

    const payload = (await request.json()) as {
      guestId?: string;
      username?: string;
      email?: string;
      avatar?: string;
      authToken?: string;
    };

    const guestId = payload.guestId?.trim();
    const username = payload.username?.trim();
    const email = payload.email?.trim().toLowerCase();
    const avatar = payload.avatar?.trim() || "";
    const authToken = payload.authToken?.trim();

    if (!guestId || !username || username.length > 40) {
      return Response.json({ error: "A valid username is required" }, { status: 400 });
    }
    if (email && !emailPattern.test(email)) {
      return Response.json({ error: "A valid email is required" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(users).where(eq(users.guestId, guestId)).limit(1);

    const now = new Date().toISOString();
    const baseValues = {
      username,
      email: email || null,
      avatar,
      updatedAt: now,
    };

    if (existing) {
      const storedAuth = (existing as { authToken?: string }).authToken;
      if (storedAuth && storedAuth !== authToken) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const [updated] = await db
        .update(users)
        .set(baseValues)
        .where(eq(users.guestId, guestId))
        .returning();
      return Response.json({ user: updated });
    }

    const [user] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        guestId,
        username,
        email: email || null,
        avatar,
        authToken: authToken || crypto.randomUUID(),
      })
      .returning();

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Profile save failed", error);
    return Response.json({ error: "Could not save profile" }, { status: 500 });
  }
}

