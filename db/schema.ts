import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const matches = sqliteTable("matches", {
	id: text("id").primaryKey(),
	state: text("state", { mode: "json" }).notNull(),
	status: text("status").notNull().default("waiting"),
	hostToken: text("host_token").notNull(),
	guestToken: text("guest_token"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const moves = sqliteTable("moves", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	matchId: text("match_id").notNull().references(() => matches.id),
	pieceId: text("piece_id").notNull(),
	toX: integer("to_x").notNull(),
	toY: integer("to_y").notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  guestId: text("guest_id").notNull().unique(),
  username: text("username").notNull().default("Guest"),
  avatar: text("avatar").notNull().default(""),
  rating: integer("rating").notNull().default(1000),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  winRate: integer("win_rate").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  highestRating: integer("highest_rating").notNull().default(1000),
  email: text("email"),
  authProvider: text("auth_provider").notNull().default("guest"),
  authProviderId: text("auth_provider_id"),
  authToken: text("auth_token"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const messages = sqliteTable("messages", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	matchId: text("match_id").notNull().references(() => matches.id),
	senderToken: text("sender_token").notNull(),
	senderName: text("sender_name").notNull(),
	body: text("body").notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const matchHistories = sqliteTable("match_histories", {
	id: text("id").primaryKey(),
	guestId: text("guest_id").notNull(),
	opponentGuestId: text("opponent_guest_id").notNull(),
	matchId: text("match_id").notNull(),
	result: text("result").notNull(),
	winner: text("winner").notNull(),
	moves: text("moves", { mode: "json" }).notNull(),
	moveCount: integer("move_count").notNull(),
	playedAt: text("played_at").notNull(),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
	id: text("id").primaryKey(),
	guestId: text("guest_id").notNull().references(() => users.guestId),
	endpoint: text("endpoint").notNull(),
	p256dh: text("p256dh").notNull(),
	auth: text("auth").notNull(),
	userAgent: text("user_agent"),
	createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
	updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
