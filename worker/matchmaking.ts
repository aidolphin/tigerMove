interface QueuedPlayer {
  token: string;
  ws: WebSocket;
  sessionId: string;
}

export class MatchmakingQueue implements DurableObject {
  private queue: QueuedPlayer[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Not found", { status: 404 });
    }

    const token = url.searchParams.get("token");
    if (!token || token.length < 8) {
      return new Response("Missing or invalid token", { status: 400 });
    }

    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      return new Response("Queue is full", { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.handleWebSocket(server, token);

    return new Response(null, { status: 101, webSocket: client });
  }

  private handleWebSocket(ws: WebSocket, token: string): void {
    const sessionId = crypto.randomUUID();

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", payload: {} }));
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.addEventListener("close", () => {
      this.queue = this.queue.filter((p) => p.sessionId !== sessionId);
    });

    if (this.queue.length > 0) {
      const opponent = this.queue.shift()!;
      opponent.ws.close(1000, "Matched");
      this.queue = this.queue.filter((p) => p.sessionId !== sessionId);

      const hostToken = crypto.randomUUID();
      const guestToken = crypto.randomUUID();
      const matchId = crypto.randomUUID();

      opponent.ws.send(JSON.stringify({
        type: "matched",
        payload: {
          matchId,
          role: "wood",
          token: hostToken,
        },
      }));

      ws.send(JSON.stringify({
        type: "matched",
        payload: {
          matchId,
          role: "stone",
          token: guestToken,
        },
      }));
    } else {
      this.queue.push({ token, ws, sessionId });
      ws.send(JSON.stringify({
        type: "searching",
        payload: { message: "Searching for opponent..." },
      }));
    }
  }
}
