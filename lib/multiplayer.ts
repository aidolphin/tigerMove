type MessageHandler = (msg: Record<string, unknown>) => void;

export interface MultiplayerClient {
  connect(matchId: string, token: string): void;
  disconnect(): void;
  sendMove(pieceId: string, to: { x: number; y: number }): void;
  sendResign(): void;
  sendRematch(): void;
  sendChat(body: string, name: string): void;
  sendMessage(message: { type: string; payload: Record<string, unknown> }): void;
  connectMatchmaking(token: string, onMatched: (matchId: string, role: string, token: string) => void): void;
  disconnectMatchmaking(): void;
  onMessage(handler: MessageHandler): () => void;
  onMatchmakingMessage(handler: MessageHandler): () => void;
  isConnected(): boolean;
  isReconnecting(): boolean;
}

export function createMultiplayerClient(): MultiplayerClient {
  let ws: WebSocket | null = null;
  let handlers: MessageHandler[] = [];
  let reconnectAttempts = 0;
  let reconnectTimeout: number | null = null;
  let intentionalClose = false;
  let currentMatchId: string | null = null;
  let currentToken: string | null = null;
  let matchmakingWs: WebSocket | null = null;
  let matchmakingHandlers: MessageHandler[] = [];
  let matchmakingOnMatched: ((matchId: string, role: string, token: string) => void) | null = null;
  let intentionalMatchmakingClose = false;
  let matchmakingReconnectAttempts = 0;
  let matchmakingReconnectTimeout: number | null = null;
  let lastSentMove: { pieceId: string; to: { x: number; y: number } } | null = null;
  let pendingMoveAck = false;
  let lastServerSequence = 0;

  function connect(matchId: string, token: string): void {
    if (ws?.readyState === WebSocket.OPEN && currentMatchId === matchId) return;

    intentionalClose = false;
    currentMatchId = matchId;
    currentToken = token;
    lastServerSequence = 0;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/matches/${matchId}?token=${token}`;

    ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      reconnectAttempts = 0;
      pendingMoveAck = false;
      ws?.send(JSON.stringify({ type: "sync", payload: {} }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        handlers.forEach((handler) => handler(msg));
        if (msg.type === "state" && msg.payload.move) {
          const move = msg.payload.move as string;
          const match = move.match(/\(([^)]+)\)/);
          const coords = move.match(/([A-Z])(\d+) → ([A-Z])(\d+)/);
          if (match && coords) {
            const pieceId = match[1];
            const to = { x: coords[3].charCodeAt(0) - 65, y: 5 - Number(coords[4]) };
            lastSentMove = { pieceId, to };
            pendingMoveAck = true;
            window.setTimeout(() => {
              if (pendingMoveAck && lastSentMove?.pieceId === pieceId && lastSentMove.to.x === to.x && lastSentMove.to.y === to.y) {
                lastSentMove = null;
                pendingMoveAck = false;
              }
            }, 1000);
          }
        }
        if (msg.type === "state" && typeof msg.payload.sequence === "number") {
          lastServerSequence = Math.max(lastServerSequence, msg.payload.sequence);
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.addEventListener("close", () => {
      ws = null;
      if (!intentionalClose && currentMatchId) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts += 1;
        reconnectTimeout = window.setTimeout(() => {
          if (currentMatchId && currentToken && !intentionalClose) {
            connect(currentMatchId, currentToken);
          }
        }, delay);
      }
    });

    ws.addEventListener("error", () => {
      // error handler
    });
  }

  function disconnect(): void {
    intentionalClose = true;
    if (reconnectTimeout) {
      window.clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (ws) {
      ws.close(1000, "Client disconnect");
      ws = null;
    }
    currentMatchId = null;
    currentToken = null;
    lastServerSequence = 0;
  }

  function send(data: Record<string, unknown>): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function sendMove(pieceId: string, to: { x: number; y: number }): void {
    const move = { pieceId, to, sequence: lastServerSequence + 1 };
    if (pendingMoveAck && lastSentMove && lastSentMove.pieceId === pieceId && lastSentMove.to.x === to.x && lastSentMove.to.y === to.y) {
      return;
    }
    lastSentMove = move;
    pendingMoveAck = true;
    send({ type: "move", payload: move });
    window.setTimeout(() => {
      if (pendingMoveAck && lastSentMove?.pieceId === pieceId && lastSentMove.to.x === to.x && lastSentMove.to.y === to.y) {
        lastSentMove = null;
        pendingMoveAck = false;
      }
    }, 1000);
  }

  function sendResign(): void {
    send({ type: "resign", payload: {} });
  }

  function sendRematch(): void {
    send({ type: "rematch", payload: {} });
  }

  function sendChat(body: string, name: string): void {
    send({ type: "chat", payload: { body, name } });
  }

  function sendMessage(message: { type: string; payload: Record<string, unknown> }): void {
    send(message);
  }

  function onMessage(handler: MessageHandler): () => void {
    handlers = [...handlers, handler];
    return () => {
      handlers = handlers.filter((h) => h !== handler);
    };
  }

  function isConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  }

  function isReconnecting(): boolean {
    return !isConnected() && !intentionalClose && currentMatchId !== null;
  }

  function connectMatchmaking(token: string, onMatched: (matchId: string, role: string, token: string) => void): void {
    intentionalMatchmakingClose = false;
    matchmakingOnMatched = onMatched;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/matchmaking/quick?token=${token}`;

    matchmakingWs = new WebSocket(wsUrl);

    matchmakingWs.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        matchmakingHandlers.forEach((handler) => handler(msg));
        if (msg.type === "matched" && matchmakingOnMatched) {
          const { matchId, role, token: matchedToken } = msg.payload as {
            matchId: string;
            role: string;
            token: string;
          };
          matchmakingOnMatched(matchId, role, matchedToken);
        }
      } catch {
        // ignore parse errors
      }
    });

    matchmakingWs.addEventListener("close", () => {
      matchmakingWs = null;
      if (!intentionalMatchmakingClose) {
        const delay = Math.min(1000 * Math.pow(2, matchmakingReconnectAttempts), 30000);
        matchmakingReconnectAttempts += 1;
        matchmakingReconnectTimeout = window.setTimeout(() => {
          if (currentToken && !intentionalMatchmakingClose) {
            connectMatchmaking(currentToken, matchmakingOnMatched!);
          }
        }, delay);
      }
    });

    matchmakingWs.addEventListener("error", () => {
      // error handler
    });
  }

  function disconnectMatchmaking(): void {
    intentionalMatchmakingClose = true;
    if (matchmakingReconnectTimeout) {
      window.clearTimeout(matchmakingReconnectTimeout);
      matchmakingReconnectTimeout = null;
    }
    if (matchmakingWs) {
      matchmakingWs.close(1000, "Client disconnect");
      matchmakingWs = null;
    }
    matchmakingOnMatched = null;
  }

  function onMatchmakingMessage(handler: MessageHandler): () => void {
    matchmakingHandlers = [...matchmakingHandlers, handler];
    return () => {
      matchmakingHandlers = matchmakingHandlers.filter((h) => h !== handler);
    };
  }

  return {
    connect,
    disconnect,
    sendMove,
    sendResign,
    sendRematch,
    sendChat,
    sendMessage,
    connectMatchmaking,
    disconnectMatchmaking,
    onMessage,
    onMatchmakingMessage,
    isConnected,
    isReconnecting,
  };
}
