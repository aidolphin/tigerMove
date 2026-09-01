import { eq, and } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    guestId?: string;
    subscription?: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
  };

  const guestId = payload.guestId?.trim();
  const subscription = payload.subscription;

  if (!guestId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return Response.json({ error: "guestId and subscription are required" }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.guestId, guestId)).limit(1);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const [existing] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, subscription.endpoint)).limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ guestId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, updatedAt: now })
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    return Response.json({ subscription: { ...subscription, guestId } });
  }

  const [record] = await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      guestId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    })
    .returning();

  return Response.json({ subscription: record }, { status: 201 });
}

export async function DELETE(request: Request) {
  const payload = (await request.json()) as { guestId?: string; endpoint?: string };

  const guestId = payload.guestId?.trim();
  const endpoint = payload.endpoint?.trim();

  if (!guestId && !endpoint) {
    return Response.json({ error: "guestId or endpoint is required" }, { status: 400 });
  }

  const db = getDb();

  if (endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return Response.json({ success: true });
  }

  if (guestId) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.guestId, guestId));
    return Response.json({ success: true });
  }

  return Response.json({ error: "Invalid request" }, { status: 400 });
}

export async function GET(request: Request) {
  const guestId = new URL(request.url).searchParams.get("guestId");
  if (!guestId) {
    return Response.json({ error: "guestId is required" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.guestId, guestId));
  return Response.json({ subscriptions: rows });
}
