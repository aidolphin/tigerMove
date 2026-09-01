import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  const rows = await db
    .select({
      guestId: users.guestId,
      username: users.username,
      avatar: users.avatar,
      rating: users.rating,
      wins: users.wins,
      losses: users.losses,
      draws: users.draws,
      gamesPlayed: users.gamesPlayed,
      winRate: users.winRate,
      currentStreak: users.currentStreak,
      highestRating: users.highestRating,
    })
    .from(users)
    .orderBy(desc(users.rating))
    .limit(100);

  return Response.json({ leaderboard: rows });
}
