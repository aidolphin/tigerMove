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
	name: text("name").notNull().default("Guest"),
	email: text("email"),
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
