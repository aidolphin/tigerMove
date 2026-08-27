import { getDb } from "../../../db";
import { matches } from "../../../db/schema";
import { initialGameState } from "../../../game/tigermove";

export async function POST() {
  const db = getDb();
  const id = crypto.randomUUID();
  const hostToken = crypto.randomUUID();
  const state = initialGameState();
  const [match] = await db
    .insert(matches)
    .values({ id, state, hostToken })
    .returning();

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
  const db = getDb();
  const rows = await db.select().from(matches).limit(20);
  return Response.json({
    matches: rows.map(({ id, state, status, createdAt, updatedAt }) => ({
      id,
      state,
      status,
      createdAt,
      updatedAt,
    })),
  });
}
