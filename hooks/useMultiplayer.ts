import { useEffect, useRef, useCallback } from "react";

type MatchRole = "wood" | "stone" | null;
type MatchStatus = "waiting" | "active" | "ended" | "cancelled" | null;

interface UseMultiplayerOptions {
  matchId: string | null;
  playerToken: string | null;
  matchRole: MatchRole;
  onStateUpdate: (state: unknown, status: MatchStatus) => void;
  onChatMessage: (message: unknown) => void;
  onError: (message: string) => void;
  onOpponentJoined: () => void;
  onGameOver: (winner: "wood" | "stone") => void;
  onResign: (winner: "wood" | "stone") => void;
}

export function useMultiplayer({
  matchId,
  playerToken,
  matchRole,
  onStateUpdate,
  onChatMessage,
  onError,
  onOpponentJoined,
  onGameOver,
  onResign,
}: UseMultiplayerOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!matchId || !playerToken) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/matches/${matchId}?token=${playerToken}`;

    intentionalCloseRef.current = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      reconnectAttemptsRef.current = 0;
    });

    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch {
        onError("Failed to parse server message");
      }
    });

    ws.addEventListener("close", () => {
      wsRef.current = null;
      if (!intentionalCloseRef.current && matchId) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (matchId && playerToken && !intentionalCloseRef.current) {
            connect();
          }
        }, delay);
      }
    });

    ws.addEventListener("error", () => {
      onError("Connection error");
    });
  }, [matchId, playerToken, onError, onStateUpdate, onChatMessage, onOpponentJoined, onGameOver, onResign]);

  const handleMessage = useCallback((msg: { type: string; payload: Record<string, unknown> }) => {
    switch (msg.type) {
      case "state":
        const { state, status, event } = msg.payload;
        onStateUpdate(state, status as MatchStatus);
        if (event === "opponent_joined") onOpponentJoined();
        if (event === "game_over" && msg.payload.winner) onGameOver(msg.payload.winner as "wood" | "stone");
        if (event === "resign" && msg.payload.winner) onResign(msg.payload.winner as "wood" | "stone");
        break;
      case "chat":
        onChatMessage(msg.payload);
        break;
      case "error":
        onError((msg.payload.message as string) || "Server error");
        break;
      case "pong":
        break;
    }
  }, [onStateUpdate, onChatMessage, onError, onOpponentJoined, onGameOver, onResign]);

  useEffect(() => {
    if (!matchId || !playerToken || matchRole === null) return;

    intentionalCloseRef.current = false;
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }
    };
  }, [matchId, playerToken, matchRole, connect]);

  const sendMessage = useCallback((message: { type: string; payload: Record<string, unknown> }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendMove = useCallback((pieceId: string, to: { x: number; y: number }) => {
    sendMessage({ type: "move", payload: { pieceId, to } });
  }, [sendMessage]);

  const sendResign = useCallback(() => {
    sendMessage({ type: "resign", payload: {} });
  }, [sendMessage]);

  const sendRematch = useCallback(() => {
    sendMessage({ type: "rematch", payload: {} });
  }, [sendMessage]);

  const sendChat = useCallback((body: string, name: string) => {
    sendMessage({ type: "chat", payload: { body, name } });
  }, [sendMessage]);

  return {
    sendMove,
    sendResign,
    sendRematch,
    sendChat,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
}
