import { getDb } from "../../../../db";
import { matchHistories } from "../../../../db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const guestId = url.searchParams.get("guestId");
  if (!guestId) {
    return Response.json({ error: "guestId is required" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db.select().from(matchHistories).where(eq(matchHistories.guestId, guestId)).orderBy(matchHistories.playedAt);

  const histories = rows.map((row) => ({
    id: row.id,
    matchId: row.matchId,
    result: row.result,
    winner: row.winner,
    moves: JSON.parse(row.moves as unknown as string),
    moveCount: row.moveCount,
    playedAt: row.playedAt,
    opponentGuestId: row.opponentGuestId,
  }));

  return Response.json({ histories });
}
