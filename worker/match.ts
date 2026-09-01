import { GameState, createInitialState, applyMove, validateMove, type Player, type Point, type MoveRecord } from "../game/engine";

interface Env {
  DB: D1Database;
  MATCH: DurableObjectNamespace;
}

interface MatchMetadata {
  id: string;
  shortCode: string;
  hostToken: string;
  guestToken: string | null;
  hostGuestId: string | null;
  guestGuestId: string | null;
  status: "waiting" | "active" | "ended" | "cancelled";
  createdAt: string;
  updatedAt: string;
  moveSequence: number;
  version: number;
}

interface StoredMatch extends MatchMetadata {
  state: GameState;
  moveSequence: number;
  version: number;
}

interface ClientMessage {
  type: "move" | "resign" | "rematch" | "chat" | "reaction" | "report" | "ping" | "sync";
  payload: Record<string, unknown>;
}

interface ServerMessage {
  type: "state" | "chat" | "error" | "pong";
  payload: Record<string, unknown>;
}

function generateShortCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class Match implements DurableObject {
  private metadata: MatchMetadata | null = null;
  private state: GameState = createInitialState();
  private sessions: Map<string, WebSocket> = new Map();
  private playerSessions: Map<Player, Set<string>> = new Map();
  private reconnectTokens: Map<string, { sessionId: string; player: Player }> = new Map();
  private chatTimestamps: Map<string, number[]> = new Map();
  private readonly CHAT_LIMIT = 160;
  private readonly RATE_LIMIT_WINDOW = 10000;
  private readonly MAX_MESSAGES = 3;
  private readonly MAX_CHAT_LENGTH = 240;

  constructor(private ctx: DurableObjectState, private env: Env) {
    ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<StoredMatch>("match");
      if (stored) {
        this.metadata = {
          id: stored.id,
          shortCode: stored.shortCode,
          hostToken: stored.hostToken,
          guestToken: stored.guestToken,
          hostGuestId: stored.hostGuestId,
          guestGuestId: stored.guestGuestId,
          status: stored.status,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
          moveSequence: stored.moveSequence ?? 0,
          version: stored.version ?? 0,
        };
        this.state = stored.state;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/create") {
      return this.handleCreate(request);
    }

    if (url.pathname === "/join") {
      return this.handleJoin(request);
    }

    if (url.pathname === "/info") {
      return this.handleInfo(request);
    }

    if (url.pathname.startsWith("/invite")) {
      return this.handleInvite(request);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.handleWebSocket(server, request);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleCreate(request: Request): Promise<Response> {
    if (this.metadata) {
      return Response.json({ error: "Match already exists" }, { status: 409 });
    }

    const hostToken = crypto.randomUUID();
    const id = this.ctx.id.toString();
    let shortCode = generateShortCode();
    let hostGuestId: string | null = null;

    try {
      const body = (await request.json()) as { shortCode?: string; guestId?: string };
      if (body.shortCode && body.shortCode.length >= 4) {
        const normalized = body.shortCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{4,10}$/.test(normalized)) {
          return Response.json({ error: "Invalid short code format" }, { status: 400 });
        }
        shortCode = normalized;
      }
      if (body.guestId && body.guestId.length > 0) {
        hostGuestId = body.guestId;
      }
    } catch {
      // ignore body parse error
    }

    this.metadata = {
      id,
      shortCode,
      hostToken,
      guestToken: null,
      hostGuestId,
      guestGuestId: null,
      status: "waiting",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      moveSequence: 0,
      version: 0,
    };
    this.state = createInitialState();

    await this.persist();

    return Response.json({
      match: { id, shortCode, status: this.metadata.status, createdAt: this.metadata.createdAt },
      role: "wood" as Player,
      token: hostToken,
    });
  }

  private async handleJoin(request: Request): Promise<Response> {
    if (!this.metadata) {
      return Response.json({ error: "Match not found" }, { status: 404 });
    }
    if (this.metadata.guestToken) {
      return Response.json({ error: "Match already has two players" }, { status: 409 });
    }
    if (this.metadata.status === "ended" || this.metadata.status === "cancelled") {
      return Response.json({ error: "Match is no longer active" }, { status: 410 });
    }

    const guestToken = crypto.randomUUID();
    let guestGuestId: string | null = null;

    try {
      const body = (await request.json()) as { guestId?: string };
      if (body.guestId && body.guestId.length > 0) {
        guestGuestId = body.guestId;
      }
    } catch {
      // ignore body parse error
    }

    this.metadata.guestToken = guestToken;
    this.metadata.guestGuestId = guestGuestId;
    this.metadata.status = "active";
    this.metadata.updatedAt = new Date().toISOString();

    await this.persist();

    this.broadcast({
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata.status,
        event: "opponent_joined",
        version: this.metadata.version,
      },
    });

    return Response.json({
      match: { id: this.metadata.id, status: this.metadata.status },
      role: "stone" as Player,
      token: guestToken,
    });
  }

  private handleInfo(request: Request): Response {
    if (!this.metadata) {
      return Response.json({ error: "Match not found" }, { status: 404 });
    }

    const token = new URL(request.url).searchParams.get("token");
    const role = this.getPlayerRole(token || "");
    if (!role) {
      return Response.json({ error: "A valid player token is required" }, { status: 401 });
    }

    return Response.json({
      match: {
        id: this.metadata.id,
        shortCode: this.metadata.shortCode,
        status: this.metadata.status,
        state: this.state,
        createdAt: this.metadata.createdAt,
        updatedAt: this.metadata.updatedAt,
        version: this.metadata.version,
      },
    });
  }

  private handleInvite(request: Request): Response {
    if (!this.metadata) {
      return Response.json({ error: "Match not found" }, { status: 404 });
    }

    const token = new URL(request.url).searchParams.get("token");
    const role = this.getPlayerRole(token || "");
    if (!role) {
      return Response.json({ error: "A valid player token is required" }, { status: 401 });
    }

    const inviteUrl = `${new URL(request.url).origin}/join/${this.metadata.shortCode}`;

    return Response.json({
      match: {
        id: this.metadata.id,
        shortCode: this.metadata.shortCode,
        status: this.metadata.status,
        inviteUrl,
        version: this.metadata.version,
      },
    });
  }

  private handleWebSocket(ws: WebSocket, request: Request): void {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !this.metadata) {
      ws.close(4001, "Unauthorized");
      return;
    }

    const player = this.getPlayerRole(token);
    if (!player) {
      ws.close(4001, "Invalid token");
      return;
    }

    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, ws);

    if (!this.playerSessions.has(player)) {
      this.playerSessions.set(player, new Set());
    }
    this.playerSessions.get(player)!.add(sessionId);

    this.reconnectTokens.set(token, { sessionId, player });

    ws.send(this.serialize({
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata.status,
        event: "connected",
        role: player,
        version: this.metadata.version,
      },
    }));

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ClientMessage;
        this.handleMessage(sessionId, player, msg);
      } catch {
        ws.send(this.serialize({
          type: "error",
          payload: { message: "Invalid message format" },
        }));
      }
    });

    ws.addEventListener("close", () => {
      this.sessions.delete(sessionId);
      const playerSet = this.playerSessions.get(player);
      if (playerSet) {
        playerSet.delete(sessionId);
        if (playerSet.size === 0) {
          this.playerSessions.delete(player);
        }
      }
      this.reconnectTokens.delete(token);
    });
  }

  private handleMessage(sessionId: string, player: Player, msg: ClientMessage): void {
    switch (msg.type) {
      case "move":
        this.handleMove(player, msg.payload);
        break;
      case "resign":
        this.handleResign(player);
        break;
      case "rematch":
        this.handleRematch(player);
        break;
      case "chat":
        this.handleChat(player, msg.payload);
        break;
      case "reaction":
        this.handleReaction(player, msg.payload);
        break;
      case "report":
        this.handleReport(player, msg.payload);
        break;
      case "sync":
        this.handleSync(sessionId, player);
        break;
      case "ping":
        this.sendToSession(sessionId, { type: "pong", payload: {} });
        break;
      default:
        this.sendToSession(sessionId, { type: "error", payload: { message: "Unknown message type" } });
    }
  }

  private handleMove(player: Player, payload: Record<string, unknown>): void {
    if (!this.metadata || this.metadata.status !== "active") {
      this.broadcast({ type: "error", payload: { message: "Match is not active" } });
      return;
    }

    const pieceId = typeof payload.pieceId === "string" ? payload.pieceId : "";
    const to = payload.to as Record<string, unknown> | undefined;
    const toX = typeof to?.x === "number" ? to.x : -1;
    const toY = typeof to?.y === "number" ? to.y : -1;
    const clientSequence = typeof payload.sequence === "number" ? payload.sequence : null;

    if (!pieceId || toX < 0 || toY < 0) {
      this.sendToSession(this.getSessionForPlayer(player), { type: "error", payload: { message: "Invalid move payload" } });
      return;
    }

    if (clientSequence !== null && clientSequence <= this.metadata.moveSequence) {
      this.sendToSession(this.getSessionForPlayer(player), { type: "error", payload: { message: "Move already processed" } });
      return;
    }

    if (player !== this.state.turn) {
      this.broadcast({ type: "error", payload: { message: "It is not your turn" } });
      return;
    }

    const validation = validateMove(this.state, pieceId, { x: toX, y: toY });
    if (!validation.valid) {
      this.broadcast({ type: "error", payload: { message: validation.reason } });
      return;
    }

    this.state = applyMove(this.state, pieceId, { x: toX, y: toY });
    this.metadata.moveSequence += 1;
    this.metadata.version += 1;
    this.metadata.updatedAt = new Date().toISOString();

    const lastMove = this.state.history[this.state.history.length - 1];
    const moveMsg = `${
      player === "wood" ? "Wood" : "Stone"
    }: ${String.fromCharCode(65 + lastMove.from.x)}${5 - lastMove.from.y} → ${String.fromCharCode(65 + lastMove.to.x)}${5 - lastMove.to.y}`;

    this.broadcast({
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata.status,
        event: "move",
        move: moveMsg,
        player,
        sequence: this.metadata.moveSequence,
        version: this.metadata.version,
      },
    });

    if (this.state.winner) {
      this.metadata.status = "ended";
      this.persist();
      void this.updateRatings();
      void this.saveMatchHistory();
      this.broadcast({
        type: "state",
        payload: {
          state: this.state,
          status: this.metadata.status,
          event: "game_over",
          winner: this.state.winner,
          version: this.metadata.version,
        },
      });
    } else {
      this.persist();
    }
  }

  private async updateRatings(): Promise<void> {
    if (!this.metadata || !this.metadata.hostGuestId || !this.metadata.guestGuestId) return;
    if (!this.state.winner) return;

    const db = this.env.DB;
    const [hostUser] = await db.prepare("SELECT * FROM users WHERE guest_id = ?").bind(this.metadata.hostGuestId).all();
    const [guestUser] = await db.prepare("SELECT * FROM users WHERE guest_id = ?").bind(this.metadata.guestGuestId).all();

    if (!hostUser?.results?.[0] || !guestUser?.results?.[0]) return;

    const host = hostUser.results[0] as Record<string, unknown>;
    const guest = guestUser.results[0] as Record<string, unknown>;

    const hostRating = Number(host.rating ?? 1000);
    const guestRating = Number(guest.rating ?? 1000);

    const expectedHost = 1 / (1 + Math.pow(10, (guestRating - hostRating) / 400));
    const expectedGuest = 1 / (1 + Math.pow(10, (hostRating - guestRating) / 400));

    const K = 32;
    const hostWon = this.state.winner === "wood";
    const guestWon = this.state.winner === "stone";

    const hostNewRating = Math.round(hostRating + K * ((hostWon ? 1 : 0) - expectedHost));
    const guestNewRating = Math.round(guestRating + K * ((guestWon ? 1 : 0) - expectedGuest));

    const hostWins = Number(host.wins ?? 0) + (hostWon ? 1 : 0);
    const guestWins = Number(guest.wins ?? 0) + (guestWon ? 1 : 0);
    const hostLosses = Number(host.losses ?? 0) + (hostWon ? 0 : 1);
    const guestLosses = Number(guest.losses ?? 0) + (guestWon ? 0 : 1);
    const hostDraws = Number(host.draws ?? 0);
    const guestDraws = Number(guest.draws ?? 0);
    const hostGames = Number(host.games_played ?? 0) + 1;
    const guestGames = Number(guest.games_played ?? 0) + 1;

    const hostWinRate = Math.round((hostWins / hostGames) * 100);
    const guestWinRate = Math.round((guestWins / guestGames) * 100);

    const hostStreak = this.calculateStreak(host, hostWon);
    const guestStreak = this.calculateStreak(guest, guestWon);

    const hostHighest = Math.max(Number(host.highest_rating ?? 1000), hostNewRating);
    const guestHighest = Math.max(Number(guest.highest_rating ?? 1000), guestNewRating);

    await db.prepare(
      "UPDATE users SET rating = ?, wins = ?, losses = ?, draws = ?, games_played = ?, win_rate = ?, current_streak = ?, highest_rating = ?, updated_at = ? WHERE guest_id = ?"
    ).bind(
      hostNewRating,
      hostWins,
      hostLosses,
      hostDraws,
      hostGames,
      hostWinRate,
      hostStreak,
      hostHighest,
      new Date().toISOString(),
      this.metadata.hostGuestId
    ).run();

    await db.prepare(
      "UPDATE users SET rating = ?, wins = ?, losses = ?, draws = ?, games_played = ?, win_rate = ?, current_streak = ?, highest_rating = ?, updated_at = ? WHERE guest_id = ?"
    ).bind(
      guestNewRating,
      guestWins,
      guestLosses,
      guestDraws,
      guestGames,
      guestWinRate,
      guestStreak,
      guestHighest,
      new Date().toISOString(),
      this.metadata.guestGuestId
    ).run();
  }

  private async saveMatchHistory(): Promise<void> {
    if (!this.metadata || !this.metadata.hostGuestId || !this.metadata.guestGuestId || !this.state.winner) return;

    const db = this.env.DB;
    const [hostUser] = await db.prepare("SELECT username FROM users WHERE guest_id = ?").bind(this.metadata.hostGuestId).all();
    const [guestUser] = await db.prepare("SELECT username FROM users WHERE guest_id = ?").bind(this.metadata.guestGuestId).all();

    const hostName = (hostUser?.results?.[0] as Record<string, unknown> | undefined)?.username as string | undefined || "Guest";
    const guestName = (guestUser?.results?.[0] as Record<string, unknown> | undefined)?.username as string | undefined || "Guest";

    const moves = this.state.history.map((move) => ({
      pieceId: move.pieceId,
      from: move.from,
      to: move.to,
    }));

    const id = crypto.randomUUID();
    const result = this.state.winner === "wood" ? "win" : "loss";
    const winner = this.state.winner;

    await db.prepare(
      "INSERT INTO match_histories (id, guest_id, opponent_guest_id, match_id, result, winner, moves, move_count, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      this.metadata.hostGuestId,
      this.metadata.guestGuestId,
      this.metadata.id,
      result,
      winner,
      JSON.stringify(moves),
      moves.length,
      new Date().toISOString()
    ).run();

    const guestResult = this.state.winner === "stone" ? "win" : "loss";
    const guestId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO match_histories (id, guest_id, opponent_guest_id, match_id, result, winner, moves, move_count, played_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      guestId,
      this.metadata.guestGuestId,
      this.metadata.hostGuestId,
      this.metadata.id,
      guestResult,
      winner,
      JSON.stringify(moves),
      moves.length,
      new Date().toISOString()
    ).run();
  }

  private calculateStreak(user: Record<string, unknown>, won: boolean): number {
    const currentStreak = Number(user.current_streak ?? 0);
    if (won) {
      return currentStreak >= 0 ? currentStreak + 1 : 1;
    } else {
      return currentStreak <= 0 ? currentStreak - 1 : -1;
    }
  }

  private handleResign(player: Player): void {
    if (!this.metadata || this.metadata.status !== "active") return;

    const winner = player === "wood" ? "stone" : "wood";
    this.state.winner = winner;
    this.state.result = "win";
    this.state.winningLine = null;
    this.state.winnerCounts = {
      ...this.state.winnerCounts,
      [winner]: this.state.winnerCounts[winner] + 1,
    };
    this.metadata.status = "ended";
    this.metadata.version += 1;
    this.metadata.updatedAt = new Date().toISOString();

    this.persist();
    void this.updateRatings();
    void this.saveMatchHistory();

    this.broadcast({
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata.status,
        event: "resign",
        winner,
        resigned: player,
        version: this.metadata.version,
      },
    });
  }

  private handleChat(player: Player, payload: Record<string, unknown>): void {
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (!body || body.length > this.MAX_CHAT_LENGTH) return;

    const now = Date.now();
    const timestamps = this.chatTimestamps.get(player) || [];
    const recent = timestamps.filter((t) => now - t < this.RATE_LIMIT_WINDOW);
    if (recent.length >= this.MAX_MESSAGES) return;
    recent.push(now);
    this.chatTimestamps.set(player, recent);

    this.broadcast({
      type: "chat",
      payload: {
        sender: player,
        name: typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "Guest",
        body,
        timestamp: now,
      },
    });
  }

  private handleRematch(player: Player): void {
    if (!this.metadata || this.metadata.status !== "ended") return;
    if (!this.metadata.hostToken || !this.metadata.guestToken) return;

    this.state = {
      ...createInitialState(),
      winnerCounts: this.state.winnerCounts,
    };
    this.metadata.status = "active";
    this.metadata.updatedAt = new Date().toISOString();
    this.metadata.moveSequence = 0;
    this.metadata.version = 0;

    this.persist();

    this.broadcast({
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata.status,
        event: "rematch",
        version: this.metadata.version,
      },
    });
  }

  private handleReaction(player: Player, payload: Record<string, unknown>): void {
    const emoji = typeof payload.emoji === "string" ? payload.emoji.trim() : "";
    if (!emoji) return;

    this.broadcast({
      type: "chat",
      payload: {
        sender: player,
        name: typeof payload.name === "string" ? payload.name.trim().slice(0, 40) : "Guest",
        body: emoji,
        timestamp: Date.now(),
        reaction: true,
      },
    });
  }

  private handleReport(player: Player, payload: Record<string, unknown>): void {
    const targetToken = typeof payload.targetToken === "string" ? payload.targetToken : "";
    if (!targetToken) return;

    const reporterRole = player;
    const reportedRole = targetToken === this.metadata?.hostToken ? "wood" : targetToken === this.metadata?.guestToken ? "stone" : null;
    if (!reportedRole) return;

    console.log(`Report: ${reporterRole} reported ${reportedRole} in match ${this.metadata?.id}`);
  }

  private handleSync(sessionId: string, player: Player): void {
    this.sendToSession(sessionId, {
      type: "state",
      payload: {
        state: this.state,
        status: this.metadata?.status ?? "waiting",
        event: "sync",
        role: player,
        version: this.metadata?.version ?? 0,
      },
    });
  }

  private getPlayerRole(token: string): Player | null {
    if (!this.metadata) return null;
    if (token === this.metadata.hostToken) return "wood";
    if (token === this.metadata.guestToken) return "stone";
    return null;
  }

  private getSessionForPlayer(player: Player): string | null {
    const sessionIds = this.playerSessions.get(player);
    if (!sessionIds || sessionIds.size === 0) return null;
    const sessionId = sessionIds.values().next().value;
    return sessionId || null;
  }

  private broadcast(message: ServerMessage): void {
    const data = this.serialize(message);
    for (const ws of this.sessions.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private sendToSession(sessionId: string | null, message: ServerMessage): void {
    if (!sessionId) return;
    const ws = this.sessions.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(this.serialize(message));
    }
  }

  private serialize(message: ServerMessage): string {
    return JSON.stringify(message);
  }

  private async persist(): Promise<void> {
    if (!this.metadata) return;
    await this.ctx.storage.put("match", {
      ...this.metadata,
      state: this.state,
    });
  }
}
