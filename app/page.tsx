"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  Play,
  Sparkles,
  Square,
  X,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  MessageCircle,
  Send,
  UserRound,
  Check,
  Copy,
  Search,
  Link,
  Users,
  UserPlus,
  Trophy,
  Sword,
  Shield,
  Crown,
  Bot,
  Gamepad2,
  Smile,
  MoreHorizontal,
  Flag,
  Eye,
  EyeOff,
  Bell,
  BellOff,
  Leaf,
} from "lucide-react";
import {
  applyMove,
  initialGameState,
  isAdjacent,
  type Point,
} from "@/game/tigermove";
import { type Difficulty, findBestMove, getAIDelay } from "@/game/ai";
import { createMultiplayerClient } from "@/lib/multiplayer";
type InstallPrompt = Event & { prompt: () => Promise<void> };
type MatchRole = "wood" | "stone";
type ChatMessage = { id: number; senderToken: string; senderName: string; body: string; createdAt: string };
type SavedGame = { id: string; result: "win" | "loss" | "draw"; winner: MatchRole; moves: number; playedAt: string };
type GameMode = "local" | "ai" | "online";
type UserProfile = {
  id: string;
  guestId: string;
  username: string;
  avatar: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  highestRating: number;
  email: string | null;
  authProvider: string;
  authProviderId: string | null;
  createdAt: string;
  updatedAt: string;
};
const points: Point[] = Array.from({ length: 25 }, (_, i) => ({
  x: i % 5,
  y: Math.floor(i / 5),
}));
const key = (x: number, y: number) => `${x}-${y}`;
const QUICK_MESSAGES = ["Good game!", "Nice move", "Well played", "Haha", "Oops", "Rematch?", "GG", "Thanks"];
const REACTION_EMOJIS = ["👍", "👎", "😂", "🔥", "👏", "😮"];
const MAX_MESSAGE_LENGTH = 160;
const RATE_LIMIT_WINDOW = 10000;
const MAX_MESSAGES_PER_WINDOW = 3;
export default function Home() {
  const [game, setGame] = useState(initialGameState),
    [started, setStarted] = useState(false),
    [moveCount, setMoveCount] = useState(0),
    [matchId, setMatchId] = useState<string | null>(null),
    [matchRole, setMatchRole] = useState<MatchRole | null>(null),
    [playerToken, setPlayerToken] = useState<string | null>(null),
    [matchStatus, setMatchStatus] = useState<"waiting" | "active" | "ended" | "cancelled" | null>(null),
    [joinCode, setJoinCode] = useState(""),
    [lobbyMessage, setLobbyMessage] = useState("2-player local"),
    [lobbyBusy, setLobbyBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [dragging, setDragging] = useState<string | null>(null),
    [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null),
    [dragTarget, setDragTarget] = useState<Point | null>(null),
    [history, setHistory] = useState(["Ready to start", "Wood moves first"]),
    [sound, setSound] = useState(true),
    [notificationsEnabled, setNotificationsEnabled] = useState(false),
    [online, setOnline] = useState(true),
    [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null),
    [guestId, setGuestId] = useState<string | null>(null),
    [profileName, setProfileName] = useState("Guest"),
    [profileEmail, setProfileEmail] = useState(""),
    [profileAvatar, setProfileAvatar] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [profileBusy, setProfileBusy] = useState(false),
    [savedGames, setSavedGames] = useState<SavedGame[]>([]),
    [chatMessages, setChatMessages] = useState<ChatMessage[]>([]),
    [chatDraft, setChatDraft] = useState(""),
    [chatBusy, setChatBusy] = useState(false),
    [chatEnabled, setChatEnabled] = useState(true),
    [muted, setMuted] = useState(false),
    [reactions, setReactions] = useState<{ id: number; emoji: string; x: number; y: number }[]>([]),
    [lastMessageTime, setLastMessageTime] = useState(0),
    [messageCount, setMessageCount] = useState(0),
    [reportOpen, setReportOpen] = useState(false),
    [reportTarget, setReportTarget] = useState<string | null>(null),
    [gameMode, setGameMode] = useState<GameMode>("local"),
    [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium"),
    [aiThinking, setAiThinking] = useState(false),
    [woodTime, setWoodTime] = useState(300),
    [stoneTime, setStoneTime] = useState(300),
    [timerActive, setTimerActive] = useState(false),
    [isDraw, setIsDraw] = useState(false),
    [matchmakingMode, setMatchmakingMode] = useState<"quick" | "private" | null>(null),
    [matchmakingState, setMatchmakingState] = useState<"idle" | "searching" | "matched" | "connecting" | "playing" | "disconnected" | "finished">("idle"),
    [privateCode, setPrivateCode] = useState(""),
    [inviteLink, setInviteLink] = useState(""),
    [copiedInvite, setCopiedInvite] = useState(false),
    [matchmakingError, setMatchmakingError] = useState(""),
    [onlinePlayers, setOnlinePlayers] = useState(0),
    [leaderboardOpen, setLeaderboardOpen] = useState(false),
    [leaderboard, setLeaderboard] = useState<{ guestId: string; username: string; avatar: string; rating: number; wins: number; losses: number; draws: number; gamesPlayed: number; winRate: number; currentStreak: number; highestRating: number }[]>([]),
    [reconnecting, setReconnecting] = useState(false),
    [myMatchesOpen, setMyMatchesOpen] = useState(false),
    [myMatches, setMyMatches] = useState<{ id: string; matchId: string; result: string; winner: string; moves: { pieceId: string; from: Point; to: Point }[]; moveCount: number; playedAt: string; opponentGuestId: string }[]>([]),
    [replayOpen, setReplayOpen] = useState(false),
    [replayMatch, setReplayMatch] = useState<{ id: string; matchId: string; result: string; winner: string; moves: { pieceId: string; from: Point; to: Point }[]; moveCount: number; playedAt: string; opponentGuestId: string } | null>(null),
    [replayStep, setReplayStep] = useState(0),
    [swUpdate, setSwUpdate] = useState(false),
    [pendingMove, setPendingMove] = useState(false),
    [expectedVersion, setExpectedVersion] = useState(0),
    audioContext = useRef<AudioContext | null>(null),
    draggedRef = useRef(false),
    recordedGame = useRef<string | null>(null),
    multiplayerRef = useRef(createMultiplayerClient());
  const { pieces, turn } = game;
  const wins = useMemo(() => savedGames.filter((g) => g.result === "win").length, [savedGames]);
  const losses = useMemo(() => savedGames.filter((g) => g.result === "loss").length, [savedGames]);
  const draws = useMemo(() => savedGames.filter((g) => g.result === "draw").length, [savedGames]);
  const rating = useMemo(() => {
    let r = 1000;
    for (const g of savedGames) {
      if (g.result === "win") r += 25;
      else if (g.result === "loss") r -= 15;
      else r += 5;
    }
    return r;
  }, [savedGames]);
  const gamesPlayed = savedGames.length;
  const winRate = useMemo(() => (gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0), [gamesPlayed, wins]);
  const currentStreak = useMemo(() => {
    if (savedGames.length === 0) return 0;
    const last = savedGames[savedGames.length - 1].result;
    let streak = last === "win" ? 1 : last === "loss" ? -1 : 0;
    for (let i = savedGames.length - 2; i >= 0; i--) {
      const r = savedGames[i].result;
      if (r === last) streak += last === "win" ? 1 : last === "loss" ? -1 : 0;
      else break;
    }
    return streak;
  }, [savedGames]);
  const highestRating = useMemo(() => {
    let peak = 1000;
    let current = 1000;
    for (const g of savedGames) {
      if (g.result === "win") current += 25;
      else if (g.result === "loss") current -= 15;
      else current += 5;
      if (current > peak) peak = current;
    }
    return peak;
  }, [savedGames]);
  const replayGame = useMemo(() => {
    if (!replayMatch) return initialGameState();
    let state = initialGameState();
    const movesToApply = replayMatch.moves.slice(0, replayStep + 1);
    for (const move of movesToApply) {
      state = applyMove(state, move.pieceId, move.to);
    }
    return state;
  }, [replayMatch, replayStep]);
  const replayPieces = replayGame.pieces;
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setSwUpdate(true);
            }
          });
        });
      }).catch((error) => {
        console.error("SW registration failed:", error);
      });
    }
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    const install = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", install);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);
  useEffect(() => {
    const initializeGuest = () => {
      const storedGuestId = localStorage.getItem("tigermove-guest-id") ?? crypto.randomUUID();
      localStorage.setItem("tigermove-guest-id", storedGuestId);
      setGuestId(storedGuestId);
      setProfileName(localStorage.getItem("tigermove-profile-name") ?? `Guest ${storedGuestId.slice(0, 4)}`);
      setProfileEmail(localStorage.getItem("tigermove-profile-email") ?? "");
      const storedGames = localStorage.getItem("tigermove-game-history");
      if (storedGames) {
        try { setSavedGames(JSON.parse(storedGames) as SavedGame[]); } catch { localStorage.removeItem("tigermove-game-history"); }
      }
    };
    const frame = window.requestAnimationFrame(initializeGuest);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const stored = localStorage.getItem("tigermove-notifications-enabled");
    if (stored === "true") {
      setNotificationsEnabled(true);
    }
  }, []);
  useEffect(() => {
    if (!matchId || !playerToken || matchRole === null) return;
    const client = multiplayerRef.current;
    client.connect(matchId, playerToken);

    const unsubscribe = client.onMessage((msg) => {
      if (msg.type === "state") {
        const { state, status, event, move, player, version } = msg.payload as {
          state: typeof game;
          status: string;
          event?: string;
          move?: string;
          player?: string;
          winner?: string;
          version?: number;
        };

        if (typeof version === "number") {
          if (version < expectedVersion) {
            client.send({ type: "sync", payload: {} });
            return;
          }
          if (version > expectedVersion && event !== "sync" && event !== "connected") {
            setExpectedVersion(version);
          }
        }

        setGame(state);
        setMatchStatus(status as "waiting" | "active" | "ended" | "cancelled");
        setStarted(status === "active");
        if (state.turn && (event === "sync" || event === "connected")) {
          setReconnecting(false);
          setPendingMove(false);
          if (typeof version === "number") {
            setExpectedVersion(version);
          }
        }
        if (pendingMove && event === "move" && player === matchRole) {
          setPendingMove(false);
          if (typeof version === "number") {
            setExpectedVersion(version);
          }
        }
        if (event === "move" && move && state.winner) {
          setHistory((old) => [move, `${state.winner === "wood" ? "Wood" : "Stone"} wins`, ...old].slice(0, 6));
          playEventSound("win");
          import("@/lib/notifications").then(({ isDocumentHidden, showForegroundNotification }) => {
            if (isDocumentHidden()) {
              showForegroundNotification("Match ended", `${state.winner === "wood" ? "Wood" : "Stone"} wins`, "match-ended");
            }
          });
        } else if (event === "move" && move && !state.winner) {
          setHistory((old) => [move, ...old].slice(0, 6));
          setMoveCount(state.history.length);
        }
        if (event === "move" && !state.winner && matchRole && state.turn !== matchRole) {
          import("@/lib/notifications").then(({ isDocumentHidden, showForegroundNotification }) => {
            if (isDocumentHidden()) {
              showForegroundNotification("Your turn", "It's your move", "your-turn");
            }
          });
        }
        if (event === "opponent_joined" && matchRole === "wood") {
          import("@/lib/notifications").then(({ isDocumentHidden, showForegroundNotification }) => {
            if (isDocumentHidden()) {
              showForegroundNotification("Opponent joined", "Your match is ready to start", "opponent-joined");
            }
          });
        } else if (status === "active") {
          setLobbyMessage("Playing as " + matchRole);
        } else if (status === "waiting") {
          setLobbyMessage("Waiting for Player 2");
        } else if (status === "cancelled") {
          setLobbyMessage("Match cancelled");
        } else if (status === "ended") {
          setLobbyMessage("Match ended");
        }
      } else if (msg.type === "chat") {
        const { sender, name, body, timestamp, reaction } = msg.payload as {
          sender: string;
          name: string;
          body: string;
          timestamp: number;
          reaction?: boolean;
        };
        if (reaction && matchId && playerToken) {
          const id = Number(timestamp) + Math.random();
          const x = 30 + Math.random() * 40;
          const y = 30 + Math.random() * 40;
          setReactions((current) => [...current, { id, emoji: body, x, y }]);
          window.setTimeout(() => {
            setReactions((current) => current.filter((r) => r.id !== id));
          }, 2000);
        } else {
          setChatMessages((current) => [
            ...current,
            {
              id: Number(timestamp),
              senderToken: sender === "wood" ? "host" : "guest",
              senderName: name,
              body,
              createdAt: new Date(timestamp).toISOString(),
            },
          ]);
          if (sender !== matchRole?.charAt(0)) {
            import("@/lib/notifications").then(({ isDocumentHidden, showForegroundNotification }) => {
              if (isDocumentHidden()) {
                showForegroundNotification(`Chat from ${name}`, body, "chat-" + String(timestamp));
              }
            });
          }
        }
      } else if (msg.type === "error") {
        setPendingMove(false);
        setLobbyMessage((msg.payload as { message?: string }).message || "Match error");
      }
    });

    return () => {
      unsubscribe();
      setPendingMove(false);
      setExpectedVersion(0);
      client.disconnect();
    };
  }, [matchId, playerToken, matchRole]);
  useEffect(() => {
    if (matchmakingMode !== "quick" || !guestId) return;
    const client = multiplayerRef.current;
    setMatchmakingState("searching");
    setMatchmakingError("");

    const unsubscribe = client.onMatchmakingMessage((msg) => {
      if (msg.type === "searching") {
        setMatchmakingState("searching");
      } else if (msg.type === "matched") {
        setMatchmakingState("matched");
      }
    });

    client.connectMatchmaking(guestId, (matchedMatchId, role, token) => {
      setMatchId(matchedMatchId);
      setMatchRole(role as MatchRole);
      setPlayerToken(token);
      setMatchmakingState("playing");
      setMatchStatus("active");
      setStarted(true);
      setLobbyMessage("Playing as " + role);
      playEventSound("start");
    });

    return () => {
      unsubscribe();
      client.disconnectMatchmaking();
    };
  }, [matchmakingMode, guestId]);
  useEffect(() => {
    if (!matchId || !playerToken || matchRole === null) return;
    const client = multiplayerRef.current;
    const interval = window.setInterval(() => {
      setReconnecting(client.isReconnecting());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [matchId, playerToken, matchRole]);
  useEffect(() => {
    if (gameMode !== "online") return;
    const fetchOnline = async () => {
      try {
        const response = await fetch("/api/online");
        if (response.ok) {
          const data = await response.json() as { onlinePlayers: number };
          setOnlinePlayers(data.onlinePlayers);
        }
      } catch {
        // ignore
      }
    };
    fetchOnline();
    const interval = window.setInterval(fetchOnline, 5000);
    return () => window.clearInterval(interval);
  }, [gameMode]);
  useEffect(() => {
    if (!leaderboardOpen) return;
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch("/api/leaderboard");
        if (response.ok) {
          const data = await response.json() as { leaderboard: { guestId: string; username: string; avatar: string; rating: number; wins: number; losses: number; draws: number; gamesPlayed: number; winRate: number; currentStreak: number; highestRating: number }[] };
          setLeaderboard(data.leaderboard);
        }
      } catch {
        // ignore
      }
    };
    fetchLeaderboard();
    const interval = window.setInterval(fetchLeaderboard, 10000);
    return () => window.clearInterval(interval);
  }, [leaderboardOpen]);
  useEffect(() => {
    const recordKey = `${matchId ?? "local"}-${game.winner}-${isDraw}-${game.winnerCounts.wood}-${game.winnerCounts.stone}`;
    if ((!game.winner && !isDraw) || recordedGame.current === recordKey) return;
    const gameId = `${matchId ?? "local"}-${Date.now()}`;
    const result: SavedGame = {
      id: gameId,
      result: isDraw ? "draw" : matchId ? (game.winner === matchRole ? "win" : "loss") : "win",
      winner: game.winner ?? "wood",
      moves: moveCount,
      playedAt: new Date().toISOString(),
    };
    recordedGame.current = recordKey;
    setSavedGames((current) => {
      const next = [result, ...current].slice(0, 20);
      localStorage.setItem("tigermove-game-history", JSON.stringify(next));
      return next;
    });
  }, [game.winner, game.winnerCounts, matchId, matchRole, moveCount, isDraw]);
  useEffect(() => {
    if (gameMode !== "ai" || !started || game.winner || isDraw || turn !== "stone" || aiThinking) return;
    const timeout = window.setTimeout(() => {
      setAiThinking(true);
      window.setTimeout(() => {
        const bestMove = findBestMove(game, aiDifficulty);
        if (bestMove) {
          const nextGame = applyMove(game, bestMove.pieceId, bestMove.to);
          const piece = game.pieces.find((p) => p.id === bestMove.pieceId);
          const move = `AI (Stone): ${piece ? `${String.fromCharCode(65 + piece.x)}${5 - piece.y}` : ""} → ${String.fromCharCode(65 + bestMove.to.x)}${5 - bestMove.to.y}`;
          setGame(nextGame);
          setHistory((old) => [
            move,
            ...(nextGame.winner ? [`${nextGame.winner === "wood" ? "Wood" : "Stone"} wins`] : []),
            ...old,
          ].slice(0, 6));
          setMoveCount((count) => count + 1);
          setSelected(null);
          playMoveSound("stone");
          if (nextGame.winner) playEventSound("win");
        }
        setAiThinking(false);
      }, getAIDelay(aiDifficulty));
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [game, started, game.winner, isDraw, turn, gameMode, aiDifficulty, aiThinking]);
  useEffect(() => {
    if (!timerActive || game.winner || isDraw) return;
    const interval = window.setInterval(() => {
      setStoneTime((s) => {
        if (turn === "stone") {
          const next = s - 1;
          if (next <= 0) {
            setTimerActive(false);
            setIsDraw(true);
            setStarted(false);
            setHistory((old) => ["Time's up! Draw!", ...old].slice(0, 6));
            playEventSound("end");
            return 0;
          }
          return next;
        }
        return s;
      });
      setWoodTime((w) => {
        if (turn === "wood") {
          const next = w - 1;
          if (next <= 0) {
            setTimerActive(false);
            setIsDraw(true);
            setStarted(false);
            setHistory((old) => ["Time's up! Draw!", ...old].slice(0, 6));
            playEventSound("end");
            return 0;
          }
          return next;
        }
        return w;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerActive, game.winner, isDraw, turn]);
  const occupied = useMemo(
    () => new Map(pieces.map((p) => [key(p.x, p.y), p])),
    [pieces],
  );
  const selectedPiece = pieces.find((p) => p.id === selected);
  const valid = selectedPiece
    ? started && !game.winner ? points.filter(
        (p) => !occupied.has(key(p.x, p.y)) &&
          isAdjacent(selectedPiece, p),
      ) : []
    : [];
  function playPoint(point: Point) {
    if (!started || game.winner || isDraw || (matchId && matchRole !== turn)) return;
    if (gameMode === "ai" && turn === "stone") return;
    if (pendingMove) return;
    const target = occupied.get(key(point.x, point.y));
    if (target) {
      if (target.player === turn) setSelected(target.id);
      return;
    }
    if (!selectedPiece || !isAdjacent(selectedPiece, point)) return;
    const isOnline = Boolean(matchId && playerToken);
    const move = `${turn === "wood" ? "Wood" : "Stone"}: ${String.fromCharCode(65 + selectedPiece.x)}${5 - selectedPiece.y} → ${String.fromCharCode(65 + point.x)}${5 - point.y}`;
    if (isOnline) {
      setPendingMove(true);
      multiplayerRef.current.sendMove(selectedPiece.id, point);
      playMoveSound(selectedPiece.player);
      if ("vibrate" in navigator) {
        navigator.vibrate(12);
      }
      return;
    }
    const nextGame = applyMove(game, selectedPiece.id, point);
    setGame(nextGame);
    setHistory((old) => [
      move,
      ...(nextGame.winner ? [`${nextGame.winner === "wood" ? "Wood" : "Stone"} wins`] : []),
      ...old,
    ].slice(0, 6));
    setMoveCount((count) => count + 1);
    setSelected(null);
    playMoveSound(selectedPiece.player);
    if (nextGame.winner) playEventSound("win");
    if ("vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }
  function playMoveSound(player: MatchRole) {
    if (!sound) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    if (player === "stone") {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(75, now + 0.18);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      oscillator.start(now);
      oscillator.stop(now + 0.23);
    } else {
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(280, now);
      oscillator.frequency.exponentialRampToValueAtTime(95, now + 0.16);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    }
  }
  function playEventSound(event: "start" | "rematch" | "end" | "join" | "win") {
    if (!sound) return;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    const notes: Record<typeof event, number[]> = {
      start: [392, 523],
      rematch: [330, 440, 659],
      end: [392, 330],
      join: [523, 659],
      win: [392, 494, 587, 784],
    };
    const duration = event === "win" ? 0.18 : 0.12;
    notes[event].forEach((frequency, index) => {
      const start = context.currentTime + index * (duration * 0.72);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = event === "end" ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(event === "win" ? 0.12 : 0.075, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
  }
  function beginDrag(point: Point, event: React.PointerEvent<HTMLButtonElement>) {
    if (!started || game.winner || (matchId && matchRole !== turn)) return;
    if (pendingMove) return;
    const piece = occupied.get(key(point.x, point.y));
    if (!piece || piece.player !== turn) return;
    setSelected(piece.id);
    setDragging(piece.id);
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDragTarget(point);
    if ("vibrate" in navigator) {
      navigator.vibrate(8);
    }
  }
  function updateDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragging) return;
    setDragPosition({ x: event.clientX, y: event.clientY });
    const node = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-point]");
    if (!node) return;
    const [x, y] = node.dataset.point!.split("-").map(Number);
    setDragTarget({ x, y });
    draggedRef.current = true;
  }
  function finishDrag(point?: Point) {
    if (!dragging) return;
    if (point) playPoint(point);
    setDragging(null);
    setDragPosition(null);
    setDragTarget(null);
  }
  async function reset() {
    resetGameState();
    if (matchId && playerToken) {
      if (await updateMatch("rematch")) playEventSound("rematch");
    } else {
      playEventSound("rematch");
    }
  }
  function resetGameState() {
    const nextGame = initialGameState();
    nextGame.winnerCounts = game.winnerCounts ?? { wood: 0, stone: 0 };
    setGame(nextGame);
    setStarted(false);
    setMoveCount(0);
    setSelected(null);
    setAiThinking(false);
    setIsDraw(false);
    setWoodTime(300);
    setStoneTime(300);
    setTimerActive(false);
    setPendingMove(false);
    setExpectedVersion(0);
    setHistory(["Ready to start", gameMode === "ai" ? "You are Wood, AI is Stone" : "Wood moves first"]);
  }
  async function toggleNotifications() {
    const { requestNotificationPermission, subscribeToPush, unsubscribeFromPush } = await import("@/lib/notifications");
    const enabled = !notificationsEnabled;
    if (enabled) {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") {
        return;
      }
      if (guestId) {
        await subscribeToPush(guestId);
      }
    } else {
      if (guestId) {
        await unsubscribeFromPush(guestId);
      }
    }
    setNotificationsEnabled(enabled);
    localStorage.setItem("tigermove-notifications-enabled", String(enabled));
  }
  async function startGame() {
    if (matchId && matchRole === "stone") return;
    if (game.winner) {
      const nextGame = initialGameState();
      nextGame.winnerCounts = game.winnerCounts ?? { wood: 0, stone: 0 };
      setGame(nextGame);
    }
    setStarted(true);
    setMatchStatus("active");
    setMoveCount(0);
    setSelected(null);
    setAiThinking(false);
    setIsDraw(false);
    setWoodTime(300);
    setStoneTime(300);
    setTimerActive(true);
    setHistory(["Match started", gameMode === "ai" ? "You are Wood, AI is Stone" : "Wood moves first"]);
    if (matchId && playerToken) {
      if (await updateMatch("start")) playEventSound("start");
    } else {
      playEventSound("start");
    }
  }
  async function createMatch() {
    setLobbyBusy(true);
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (!response.ok) return setLobbyMessage("D1 database is not connected");
      const data = (await response.json()) as {
        match: { id: string };
        token: string;
        role: MatchRole;
      };
      setMatchId(data.match.id);
      setMatchRole(data.role);
      setPlayerToken(data.token);
      setMatchStatus("waiting");
      setStarted(false);
      setCopied(false);
      setLobbyMessage("Share this match ID with Player 2");
    } catch {
      setLobbyMessage("Cannot connect to match server");
    } finally {
      setLobbyBusy(false);
    }
  }
  async function copyMatchId() {
    if (!matchId) return;
    try {
      await navigator.clipboard.writeText(matchId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setLobbyMessage("Copy unavailable. Select the ID and copy it manually.");
    }
  }
  async function makeProfilePermanent(event: React.FormEvent) {
    event.preventDefault();
    if (!guestId) return;
    setProfileBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          guestId,
          username: profileName,
          email: profileEmail,
          avatar: profileAvatar,
        }),
      });

      const rawText = await response.text();
      let data: { error?: string } = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as { error?: string };
        } catch {
          data = { error: "Could not save profile" };
        }
      }

      const trimmedName = profileName.trim();
      const trimmedEmail = profileEmail.trim().toLowerCase();

      if (!response.ok) {
        const isLocalOnlyFallback = response.status === 500 || (data.error ?? "").includes("Could not save profile") || (data.error ?? "").includes("D1") || (data.error ?? "").includes("database");

        if (isLocalOnlyFallback) {
          localStorage.setItem("tigermove-profile-name", trimmedName);
          localStorage.setItem("tigermove-profile-email", trimmedEmail);
          setProfileOpen(false);
          setLobbyMessage("Your profile was saved on this device.");
          return;
        }

        return setLobbyMessage(data.error ?? "Could not save profile");
      }

      localStorage.setItem("tigermove-profile-name", trimmedName);
      localStorage.setItem("tigermove-profile-email", trimmedEmail);
      setProfileOpen(false);
      setLobbyMessage("Your player profile is now permanent");
    } catch {
      const trimmedName = profileName.trim();
      const trimmedEmail = profileEmail.trim().toLowerCase();
      localStorage.setItem("tigermove-profile-name", trimmedName);
      localStorage.setItem("tigermove-profile-email", trimmedEmail);
      setProfileOpen(false);
      setLobbyMessage("Your profile was saved on this device.");
    } finally {
      setProfileBusy(false);
    }
  }
  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const body = chatDraft.trim();
    if (!matchId || !playerToken || !body || chatBusy) return;
    if (body.length > MAX_MESSAGE_LENGTH) return;
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_WINDOW && messageCount >= MAX_MESSAGES_PER_WINDOW) {
      setLobbyMessage("Slow down! Wait a moment before sending another message.");
      return;
    }
    setChatBusy(true);
    multiplayerRef.current.sendChat(body, profileName);
    setChatDraft("");
    setLastMessageTime(now);
    setMessageCount((count) => (now - lastMessageTime < RATE_LIMIT_WINDOW ? count + 1 : 1));
    setChatBusy(false);
  }
  function sendQuickMessage(message: string) {
    if (!matchId || !playerToken || chatBusy) return;
    if (message.length > MAX_MESSAGE_LENGTH) return;
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_WINDOW && messageCount >= MAX_MESSAGES_PER_WINDOW) {
      setLobbyMessage("Slow down! Wait a moment before sending another message.");
      return;
    }
    multiplayerRef.current.sendChat(message, profileName);
    setLastMessageTime(now);
    setMessageCount((count) => (now - lastMessageTime < RATE_LIMIT_WINDOW ? count + 1 : 1));
  }
  function sendReaction(emoji: string) {
    if (!matchId || !playerToken) return;
    const id = Date.now() + Math.random();
    const x = 30 + Math.random() * 40;
    const y = 30 + Math.random() * 40;
    setReactions((current) => [...current, { id, emoji, x, y }]);
    multiplayerRef.current.sendMessage({ type: "reaction", payload: { emoji, x, y } });
    window.setTimeout(() => {
      setReactions((current) => current.filter((r) => r.id !== id));
    }, 2000);
  }
  function toggleMute() {
    setMuted((current) => !current);
  }
  function openReport(senderToken: string) {
    setReportTarget(senderToken);
    setReportOpen(true);
  }
  function submitReport() {
    if (!reportTarget) return;
    multiplayerRef.current.sendMessage({ type: "report", payload: { targetToken: reportTarget, reason: "Inappropriate behavior" } });
    setReportOpen(false);
    setReportTarget(null);
    setLobbyMessage("Report submitted. Thank you for keeping TigerMove friendly.");
  }
  function toggleChat() {
    setChatEnabled((current) => !current);
  }
  async function updateMatch(action: "start" | "end" | "cancel" | "rematch") {
    if (!matchId || !playerToken) return false;
    if (action === "start") {
      multiplayerRef.current.sendMessage({ type: "start", payload: {} });
      setStarted(true);
      setMatchStatus("active");
      setMoveCount(0);
      setSelected(null);
      setAiThinking(false);
      setIsDraw(false);
      setWoodTime(300);
      setStoneTime(300);
      setTimerActive(true);
      setHistory(["Match started", gameMode === "ai" ? "You are Wood, AI is Stone" : "Wood moves first"]);
      playEventSound("start");
      return true;
    }
    if (action === "cancel") {
      multiplayerRef.current.sendMessage({ type: "resign", payload: {} });
      setMatchId(null);
      setMatchRole(null);
      setPlayerToken(null);
      setMatchStatus(null);
      setLobbyMessage("Match cancelled. Create a new match when ready.");
      return true;
    }
    if (action === "end") {
      setStarted(false);
      setMatchStatus("ended");
      setSelected(null);
      setHistory((old) => ["Match ended", ...old].slice(0, 6));
      multiplayerRef.current.sendMessage({ type: "resign", payload: {} });
      playEventSound("end");
      return true;
    }
    if (action === "rematch") {
      multiplayerRef.current.sendMessage({ type: "rematch", payload: {} });
      const nextGame = initialGameState();
      nextGame.winnerCounts = game.winnerCounts ?? { wood: 0, stone: 0 };
      setGame(nextGame);
      setStarted(true);
      setMoveCount(0);
      setSelected(null);
      setAiThinking(false);
      setIsDraw(false);
      setWoodTime(300);
      setStoneTime(300);
      setTimerActive(true);
      setHistory(["Match started", gameMode === "ai" ? "You are Wood, AI is Stone" : "Wood moves first"]);
      playEventSound("rematch");
      return true;
    }
    return false;
  }
  async function cancelMatch() {
    await updateMatch("cancel");
    setPendingMove(false);
    setExpectedVersion(0);
    setMatchId(null);
    setMatchRole(null);
    setPlayerToken(null);
    setMatchStatus(null);
    setLobbyMessage("Match cancelled. Create a new match when ready.");
  }
  async function joinMatch() {
    const id = joinCode.trim();
    if (!id) return;
    setLobbyBusy(true);
    try {
      const response = await fetch(`/api/matches/${id}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (!response.ok) return setLobbyMessage("Match not found or already full");
      const data = (await response.json()) as { token: string; role: MatchRole };
      setMatchId(id);
      setMatchRole(data.role);
      setPlayerToken(data.token);
      setStarted(true);
      setLobbyMessage("Joined as Stone");
      playEventSound("join");
    } catch {
      setLobbyMessage("Cannot connect to match server");
    } finally {
      setLobbyBusy(false);
    }
  }
  async function startQuickMatch() {
    setMatchmakingMode("quick");
    setMatchmakingState("idle");
    setMatchmakingError("");
    setGameMode("online");
    resetGameState();
  }
  async function createPrivateMatch() {
    setLobbyBusy(true);
    setMatchmakingError("");
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (!response.ok) return setLobbyMessage("Cannot create match");
      const data = (await response.json()) as {
        match: { id: string; shortCode: string };
        token: string;
        role: MatchRole;
      };
      const link = `${window.location.origin}/join/${data.match.shortCode}`;
      setMatchId(data.match.id);
      setMatchRole(data.role);
      setPlayerToken(data.token);
      setPrivateCode(data.match.shortCode);
      setInviteLink(link);
      setMatchStatus("waiting");
      setStarted(false);
      setLobbyMessage("Share invite link with friend");
    } catch {
      setLobbyMessage("Cannot connect to match server");
    } finally {
      setLobbyBusy(false);
    }
  }
  async function joinPrivateMatch() {
    const code = privateCode.trim();
    if (!code) return;
    setLobbyBusy(true);
    setMatchmakingError("");
    try {
      const response = await fetch(`/api/matches/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestId }),
      });
      if (!response.ok) return setMatchmakingError("Room not found or already full");
      const data = (await response.json()) as { token: string; role: MatchRole };
      setMatchId(code);
      setMatchRole(data.role);
      setPlayerToken(data.token);
      setStarted(true);
      setLobbyMessage("Joined as Stone");
      playEventSound("join");
    } catch {
      setMatchmakingError("Cannot connect to match server");
    } finally {
      setLobbyBusy(false);
    }
  }
  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      window.setTimeout(() => setCopiedInvite(false), 1600);
    } catch {
      setMatchmakingError("Copy unavailable. Share link manually.");
    }
  }
  function cancelMatchmaking() {
    multiplayerRef.current.disconnectMatchmaking();
    setMatchmakingMode(null);
    setMatchmakingState("idle");
    setPrivateCode("");
    setInviteLink("");
    setCopiedInvite(false);
    setMatchmakingError("");
    setMatchId(null);
    setMatchRole(null);
    setPlayerToken(null);
    setMatchStatus(null);
    setLobbyMessage("2-player local");
  }
  function openLeaderboard() {
    setLeaderboardOpen(true);
  }
  function openMyMatches() {
    setMyMatchesOpen(true);
    fetchMyMatches();
  }
  function openReplay(match: { id: string; matchId: string; result: string; winner: string; moves: { pieceId: string; from: Point; to: Point }[]; moveCount: number; playedAt: string; opponentGuestId: string }) {
    setReplayMatch(match);
    setReplayStep(0);
    setReplayOpen(true);
  }
  function replayPrev() {
    setReplayStep((step) => Math.max(0, step - 1));
  }
  function replayNext() {
    setReplayStep((step) => Math.min(replayMatch ? replayMatch.moves.length - 1 : 0, step + 1));
  }
  async function fetchMyMatches() {
    if (!guestId) return;
    try {
      const response = await fetch(`/api/matches/history?guestId=${guestId}`);
      if (response.ok) {
        const data = await response.json() as { histories: { id: string; matchId: string; result: string; winner: string; moves: { pieceId: string; from: Point; to: Point }[]; moveCount: number; playedAt: string; opponentGuestId: string }[] };
        setMyMatches(data.histories);
      }
    } catch {
      // ignore
    }
  }
  async function endGame() {
    setPendingMove(false);
    setExpectedVersion(0);
    setStarted(false);
    setMatchStatus("ended");
    setSelected(null);
    setHistory((old) => ["Match ended", ...old].slice(0, 6));
    if (matchId && playerToken) {
      if (await updateMatch("end")) playEventSound("end");
    } else {
      playEventSound("end");
    }
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    }
  }
  function applySwUpdate() {
    setSwUpdate(false);
    window.location.reload();
  }
  return (
    <main className="app-shell">
      {swUpdate && (
        <div style={{ background: "#183f2b", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", fontSize: "13px", fontWeight: 800 }}>
          <span>New version available</span>
          <Button size="sm" variant="outline" onClick={applySwUpdate} style={{ background: "#fff", color: "#183f2b", border: "1px solid #fff" }}>Update</Button>
        </div>
      )}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-label="TigerMove logo"><span>Tiger</span><em>Move</em></span>
          <div>
            <small>by Quantum Leaf Automation</small>
          </div>
        </div>
        <div className="top-actions">
          <button className="top-profile" type="button" onClick={() => setProfileOpen(true)} aria-label="Open player profile">
            <UserRound size={15} /><span>{profileName}</span>
          </button>
          <Button variant="ghost" size="icon" onClick={openLeaderboard} aria-label="Leaderboard">
            <Trophy size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={openMyMatches} aria-label="My Matches">
            <Square size={15} />
          </Button>
          <span className={`network ${online ? "online" : "offline"}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
            {online ? "Online" : "Offline"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle sound"
            onClick={() => setSound(!sound)}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle notifications"
            onClick={toggleNotifications}
          >
            {notificationsEnabled ? <Bell /> : <BellOff />}
          </Button>
          <Button className="install" onClick={install}>
            <Sparkles size={16} /> Install app
          </Button>
        </div>
      </header>
      <section className="game-layout">
        <aside className="match-panel left-panel">
          {gameMode === "online" && !matchId ? (
            <div className="modern-lobby">
              <div className="lobby-player-card">
                <div className="lobby-avatar">
                  <span>{profileAvatar || profileName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="lobby-player-info">
                  <strong>{profileName}</strong>
                  <small>Rating {rating}</small>
                </div>
                <div className="lobby-player-stats">
                  <div className="lobby-stat">
                    <Sword size={14} />
                    <span>{wins}</span>
                  </div>
                  <div className="lobby-stat">
                    <Shield size={14} />
                    <span>{losses}</span>
                  </div>
                </div>
              </div>

              <div className="lobby-online">
                <Users size={14} />
                <span>{onlinePlayers} online</span>
              </div>

              <div className="lobby-actions-grid">
                <Button size="lg" onClick={() => void startQuickMatch()} className="lobby-btn primary">
                  <Search size={18} /> Quick Match
                </Button>
                <Button size="lg" onClick={() => { setMatchmakingMode("private"); setMatchmakingError(""); }} className="lobby-btn secondary">
                  <UserPlus size={18} /> Private Match
                </Button>
                <Button size="lg" onClick={() => { setMatchmakingMode("private"); setJoinCode(""); }} className="lobby-btn outline">
                  <Link size={18} /> Join Match
                </Button>
              </div>

              <div className="lobby-divider" />

              <div className="lobby-actions-grid small">
                <Button size="sm" variant="ghost" onClick={() => { setGameMode("ai"); resetGameState(); }} className="lobby-btn ghost">
                  <Bot size={16} /> vs AI
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setGameMode("local"); resetGameState(); }} className="lobby-btn ghost">
                  <Gamepad2 size={16} /> Local 2P
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mode-tabs">
                <button type="button" className={`mode-tab ${gameMode === "local" ? "active" : ""}`} onClick={() => { setGameMode("local"); resetGameState(); cancelMatchmaking(); }}>
                  <span className="mode-tab-icon"><Users size={16} /></span>
                  <span>Local</span>
                </button>
                <button type="button" className={`mode-tab ${gameMode === "ai" ? "active" : ""}`} onClick={() => { setGameMode("ai"); resetGameState(); cancelMatchmaking(); }}>
                  <span className="mode-tab-icon"><Bot size={16} /></span>
                  <span>vs AI</span>
                </button>
                <button type="button" className={`mode-tab ${gameMode === "online" ? "active" : ""}`} onClick={() => { setGameMode("online"); resetGameState(); cancelMatchmaking(); }}>
                  <span className="mode-tab-icon"><Wifi size={16} /></span>
                  <span>Online</span>
                </button>
              </div>

              <h1>Stone vs Wood</h1>
              <div className="multiplayer-lobby">
                <div className="lobby-heading">
                  <strong>{gameMode === "ai" ? "Play vs AI" : gameMode === "online" ? (matchmakingMode === "quick" ? "Quick Match" : matchmakingMode === "private" ? "Private Match" : "Play Online") : "2-Player Local"}</strong>
                  <small>{matchmakingMode === "quick" && matchmakingState === "searching" ? "Searching for opponent..." : matchmakingMode === "quick" && matchmakingState === "matched" ? "Opponent found! Connecting..." : lobbyMessage}</small>
                </div>

                {gameMode === "ai" && !started && !game.winner ? (
                  <div className="lobby-actions">
                    <div className="difficulty-selector">
                      <label>Difficulty</label>
                      <div className="difficulty-options">
                        {(["easy", "medium", "hard"] as Difficulty[]).map((diff) => (
                          <button
                            key={diff}
                            type="button"
                            className={`diff-btn ${aiDifficulty === diff ? "active" : ""}`}
                            onClick={() => setAiDifficulty(diff)}
                          >
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button size="lg" onClick={() => void startGame()} className="start-game-btn">
                      <Play size={18} /> Start Game
                    </Button>
                  </div>
                ) : gameMode === "local" && !started && !game.winner ? (
                  <div className="lobby-actions">
                    <Button size="lg" onClick={() => void startGame()} className="start-game-btn">
                      <Play size={18} /> Start Game
                    </Button>
                  </div>
                ) : gameMode === "online" && !matchId && matchmakingMode === null ? (
                  <div className="matchmaking-modes">
                    <Button size="lg" onClick={() => void startQuickMatch()} className="matchmaking-btn quick">
                      <Search size={18} /> Quick Match
                    </Button>
                    <Button size="lg" onClick={() => { setMatchmakingMode("private"); setMatchmakingError(""); }} className="matchmaking-btn private">
                      <UserPlus size={18} /> Private Match
                    </Button>
                  </div>
                ) : matchmakingMode === "quick" && matchmakingState === "searching" ? (
                  <div className="matchmaking-state">
                    <div className="matchmaking-spinner" />
                    <p>Searching for opponent...</p>
                    <small>This usually takes a few seconds</small>
                    <Button size="sm" variant="outline" onClick={() => cancelMatchmaking()}>Cancel</Button>
                  </div>
                ) : matchmakingMode === "quick" && matchmakingState === "matched" ? (
                  <div className="matchmaking-state">
                    <p>Opponent found!</p>
                    <small>Connecting...</small>
                  </div>
                ) : matchmakingMode === "private" && !matchId ? (
                  <div className="private-match-form">
                    <input
                      value={privateCode}
                      onChange={(event) => setPrivateCode(event.target.value.toUpperCase())}
                      placeholder="ROOM CODE"
                      maxLength={6}
                      aria-label="Room code"
                    />
                    <Button size="lg" onClick={() => void joinPrivateMatch()} disabled={lobbyBusy}>
                      <Link size={18} /> Join Room
                    </Button>
                    <div style={{ textAlign: "center", fontSize: "10px", color: "#71847a", margin: "4px 0" }}>— or —</div>
                    <Button size="lg" onClick={() => void createPrivateMatch()} disabled={lobbyBusy}>
                      <Users size={18} /> Create Room
                    </Button>
                    {matchmakingError && <small style={{ color: "#a85a43", textAlign: "center" }}>{matchmakingError}</small>}
                  </div>
                ) : matchId && matchStatus === "waiting" ? (
                  <div className="matchmaking-state">
                    <p>Waiting for opponent...</p>
                    <small>Share the code or invite link</small>
                    <div className="invite-link">
                      <code>{privateCode || matchId}</code>
                      <button type="button" className="copy-invite-btn" onClick={() => void copyInviteLink()}>
                        {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                        {copiedInvite ? "Copied" : "Copy"}
                      </button>
                    </div>
                    {inviteLink && (
                      <div className="invite-link" style={{ marginTop: "8px" }}>
                        <code>{inviteLink}</code>
                        <button type="button" className="copy-invite-btn" onClick={() => void copyInviteLink()}>
                          {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                          {copiedInvite ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => cancelMatchmaking()} style={{ marginTop: "10px" }}>
                      <X size={14} /> Cancel
                    </Button>
                  </div>
                ) : null}

                {gameMode === "online" && matchId && matchStatus === "active" && (
                  <div className="lobby-actions" style={{ marginTop: "10px" }}>
                    <div className="invite-link">
                      <code>{privateCode || matchId}</code>
                      <button type="button" className="copy-invite-btn" onClick={() => void copyInviteLink()}>
                        {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                        {copiedInvite ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="game-status-card">
            <div className="status-row">
              <span className="status-label">Mode</span>
              <span className="status-value">{gameMode === "ai" ? "vs AI" : gameMode === "online" ? (matchmakingMode === "quick" ? "Quick Match" : matchmakingMode === "private" ? "Private Match" : "Online") : "Local"}</span>
            </div>
            {gameMode === "ai" && (
              <div className="status-row">
                <span className="status-label">Difficulty</span>
                <span className="status-value difficulty-badge">{aiDifficulty}</span>
              </div>
            )}
            {matchId && (
              <div className="status-row">
                <span className="status-label">Role</span>
                <span className={`status-value role-badge ${matchRole}`}>{matchRole === "wood" ? "Wood (You)" : "Stone (You)"}</span>
              </div>
            )}
          </div>
        </aside>
        <section className="board-stage" aria-label="TigerMove game board">
          <div className="board-status">
            <div className={`turn-pill ${game.winner ? "winner" : ""} ${isDraw ? "draw" : ""} ${gameMode === "ai" && turn === "stone" && started && !game.winner ? "ai-turn" : ""} ${!started && !game.winner ? "idle" : ""} ${reconnecting ? "reconnecting" : ""}`}>
              <span className={`dot ${game.winner ?? turn}`} />
              <span className="turn-text">
                {isDraw
                  ? "Draw!"
                  : !started
                  ? matchStatus === "cancelled" ? "Match cancelled" : matchStatus === "ended" ? "Match ended" : "Ready to start"
                  : game.winner
                  ? `${game.winner === "wood" ? "Wood" : "Stone"} wins!`
                  : `${turn === "wood" ? "Wood" : "Stone"} to move`}
              </span>
              {reconnecting && <span className="ai-thinking-indicator">Reconnecting...</span>}
              {aiThinking && !reconnecting && <span className="ai-thinking-indicator">AI thinking...</span>}
              <small className="match-mode">{gameMode === "ai" ? "VS AI" : gameMode === "online" && matchmakingMode === "quick" ? "QUICK MATCH" : gameMode === "online" && matchmakingMode === "private" ? "PRIVATE MATCH" : gameMode === "online" && matchId ? "ONLINE" : "2-PLAYER LOCAL"}</small>
              {started && !game.winner && !isDraw && (
                <div className="timer-display">
                  <span className={`timer wood ${turn === "wood" ? "active" : ""}`}><Leaf size={10} /> {Math.floor(woodTime / 60)}:{(woodTime % 60).toString().padStart(2, "0")}</span>
                  <span className="timer-divider">|</span>
                  <span className={`timer stone ${turn === "stone" ? "active" : ""}`}><Shield size={10} /> {Math.floor(stoneTime / 60)}:{(stoneTime % 60).toString().padStart(2, "0")}</span>
                </div>
              )}
            </div>

            {started && !game.winner && (
              <div className="board-hint">
                {gameMode === "ai" && turn === "stone" ? "AI is thinking..." : "Drag a piece to an adjacent dot, or tap piece then tap destination"}
              </div>
            )}

            {started && (
              <div className="top-score" aria-label={`Wood ${game.winnerCounts.wood} wins, Stone ${game.winnerCounts.stone} wins`}>
                <span className="score-item wood">
                  <span className="score-dot" />
                  <span className="score-label">WOOD</span>
                  <strong className="score-num">{game.winnerCounts.wood}</strong>
                </span>
                <span className="score-divider">VS</span>
                <span className="score-item stone">
                  <span className="score-dot" />
                  <span className="score-label">STONE</span>
                  <strong className="score-num">{game.winnerCounts.stone}</strong>
                </span>
              </div>
            )}
          </div>

           <div className={`board-wrap${pendingMove ? " pending" : ""}`} onPointerMove={updateDrag} onPointerUp={() => finishDrag(dragTarget ?? undefined)} onPointerCancel={() => finishDrag()}>
            <div className="coordinates cols">
              <i>A</i>
              <i>B</i>
              <i>C</i>
              <i>D</i>
              <i>E</i>
            </div>
            <div className="coordinates rows">
              <i>5</i>
              <i>4</i>
              <i>3</i>
              <i>2</i>
              <i>1</i>
            </div>
            <svg
              className="board-lines"
              viewBox="0 0 400 400"
              aria-hidden="true"
            >
              {[0, 100, 200, 300, 400].map((n) => (
                <g key={n}>
                  <line x1={n} y1="0" x2={n} y2="400" />
                  <line x1="0" y1={n} x2="400" y2={n} />
                </g>
              ))}
              <path d="M0 0L400 400M400 0L0 400M0 0L200 200L400 0M0 400L200 200L400 400M0 200L200 0L400 200L200 400Z" />
            </svg>
            {points.map((p) => {
              const piece = occupied.get(key(p.x, p.y)),
                isValid = valid.some((v) => v.x === p.x && v.y === p.y);
              const isWinning = game.winningLine?.some((linePoint) => linePoint.x === p.x && linePoint.y === p.y);
              return (
                <button
                  key={key(p.x, p.y)}
                  className={`node ${piece ? "occupied" : ""} ${isValid ? "valid" : ""} ${isWinning ? "winning" : ""} ${dragging === piece?.id ? "dragging" : ""}`}
                  data-point={key(p.x, p.y)}
                  style={{ left: `${8 + p.x * 21}%`, top: `${8 + p.y * 21}%` }}
                  onPointerDown={(event) => beginDrag(p, event)}
                  onClick={() => { if (draggedRef.current) { draggedRef.current = false; return; } playPoint(p); }}
                  aria-label={
                    piece
                      ? `${piece.player} at ${key(p.x, p.y)}`
                      : `empty point ${key(p.x, p.y)}`
                  }
                >
                  {piece && (
                    <span
                      className={`piece ${piece.player} ${selected === piece.id ? "selected" : ""}`}
                    >
                      {piece.player === "wood" && (
                        <span className="wood-grain" />
                      )}
                    </span>
                  )}
                </button>
              );
            })}
            {dragging && dragPosition && (
              <span className="drag-ghost" style={{ left: dragPosition.x, top: dragPosition.y }} aria-hidden="true">
                <span className={`piece ${pieces.find((candidate) => candidate.id === dragging)?.player ?? "wood"}`} />
              </span>
            )}
            {(game.winner || isDraw) && (
              <div className="victory-overlay" role="status" aria-live="assertive">
                <span>{isDraw ? "TIME'S UP" : "CONGRATULATIONS"}</span>
                <strong>{isDraw ? "DRAW" : `${game.winner === "wood" ? "WOOD" : "STONE"} WINS`}</strong>
              </div>
            )}
            {reactions.map((reaction) => (
              <div
                key={reaction.id}
                className="board-reaction"
                style={{ left: `${reaction.x}%`, top: `${reaction.y}%` }}
                aria-hidden="true"
              >
                {reaction.emoji}
              </div>
            ))}
          </div>
        </section>
        <aside className="match-panel right-panel">
          <div className="panel-head">
            <div>
              <h2>Move log</h2>
            </div>
            <span>MOVE {String(moveCount).padStart(2, "0")}</span>
          </div>
          <div className="history">
            {history.map((item, i) => (
              <div key={`${item}-${i}`}>
                <span>{String(history.length - i).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          {matchId && playerToken && chatEnabled && (
            <section className="chat-panel" aria-label="Match chat">
              <div className="chat-heading">
                <strong><MessageCircle size={16} /> Chat</strong>
                <div className="chat-actions">
                  <Button size="icon" variant="ghost" onClick={toggleChat} aria-label="Hide chat"><EyeOff size={14} /></Button>
                </div>
              </div>
              <div className="chat-messages" aria-live="polite">
                {chatMessages.length === 0 ? <p className="chat-empty">Say hello or use quick messages below.</p> : chatMessages.map((message) => (
                  <div className={`chat-message ${message.senderToken === playerToken ? "mine" : ""} ${muted && message.senderToken !== playerToken ? "muted" : ""}`} key={message.id}>
                    <div className="chat-message-header">
                      <b>{message.senderName}</b>
                      {message.senderToken !== playerToken && (
                        <div className="chat-message-actions">
                          <button type="button" className="chat-icon-btn" onClick={() => toggleMute()} aria-label={muted ? "Unmute opponent" : "Mute opponent"}>
                            {muted ? <Eye size={12} /> : <VolumeX size={12} />}
                          </button>
                          <button type="button" className="chat-icon-btn" onClick={() => openReport(message.senderToken)} aria-label="Report player">
                            <Flag size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    <span>{message.body}</span>
                  </div>
                ))}
              </div>
              <div className="chat-quick-messages">
                {QUICK_MESSAGES.map((msg) => (
                  <button key={msg} type="button" className="quick-msg" onClick={() => sendQuickMessage(msg)}>{msg}</button>
                ))}
              </div>
              <div className="chat-reactions">
                {REACTION_EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" className="reaction-btn" onClick={() => sendReaction(emoji)} aria-label={`React ${emoji}`}>
                    {emoji}
                  </button>
                ))}
              </div>
              <form className="chat-form" onSubmit={sendChat}>
                <input
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Message opponent"
                  aria-label="Message opponent"
                />
                <span className="chat-limit">{chatDraft.length}/{MAX_MESSAGE_LENGTH}</span>
                <Button size="icon" type="submit" disabled={chatBusy || !chatDraft.trim()} aria-label="Send message"><Send size={15} /></Button>
              </form>
            </section>
          )}
          {matchId && playerToken && !chatEnabled && (
            <Button size="sm" variant="outline" onClick={toggleChat} className="chat-toggle-btn">
              <MessageCircle size={14} /> Show Chat
            </Button>
          )}
          <div className="match-controls">
            {!started && !game.winner && (
              <Button className="start-game" onClick={() => void startGame()} disabled={matchId !== null && matchRole === "stone"}>
                <Play size={16} /> Start Game
              </Button>
            )}
            {started && !game.winner && (
              <Button variant="outline" className="end-game" onClick={() => void endGame()}>
                <Square size={15} /> End Game
              </Button>
            )}
            {(game.winner || started) && (
              <Button variant="outline" className="restart" onClick={() => void reset()}>
                <RotateCcw size={16} /> {game.winner ? "Play Again" : "Restart"}
              </Button>
            )}
          </div>
        </aside>
      </section>
      <footer>
        <span>© 2026 Quantum Leaf Automation</span>
      </footer>
      {profileOpen && (
        <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setProfileOpen(false); }}>
          <form className="profile-dialog" onSubmit={makeProfilePermanent} role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <span className="profile-icon"><UserRound size={20} /></span>
            <h2 id="profile-title">{profileName}</h2>
            <p>{profileEmail ? "Permanent player profile" : "Temporary player profile"}. Your match history is saved on this device.</p>
            <div className="profile-stats">
              <div><strong>{rating}</strong><small>RATING</small></div>
              <div><strong>{winRate}%</strong><small>WIN RATE</small></div>
              <div><strong>{currentStreak > 0 ? `+${currentStreak}` : currentStreak}</strong><small>STREAK</small></div>
              <div><strong>{highestRating}</strong><small>PEAK</small></div>
            </div>
            <div className="profile-stats" style={{ marginTop: "6px" }}>
              <div><strong>{wins}</strong><small>WINS</small></div>
              <div><strong>{losses}</strong><small>LOSSES</small></div>
              <div><strong>{draws}</strong><small>DRAWS</small></div>
              <div><strong>{gamesPlayed}</strong><small>GAMES</small></div>
            </div>
            {savedGames.length > 0 && <div className="profile-history"><strong>Recent games</strong>{savedGames.slice(0, 5).map((game) => <div key={game.id}><span className={game.result}>{game.result === "win" ? "WIN" : game.result === "loss" ? "LOSS" : "DRAW"}</span><p>{game.winner === "wood" ? "Wood" : "Stone"} won · {game.moves} moves</p><small>{new Date(game.playedAt).toLocaleDateString()}</small></div>)}</div>}
            <label>Username<input value={profileName} onChange={(event) => setProfileName(event.target.value)} required maxLength={40} /></label>
            <label>Avatar<input value={profileAvatar} onChange={(event) => setProfileAvatar(event.target.value)} maxLength={40} placeholder="Optional" /></label>
            <label>Email<input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} placeholder="you@example.com" /></label>
            <div className="profile-actions"><Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Later</Button><Button type="submit" disabled={profileBusy}>{profileBusy ? "Saving..." : "Make permanent"}</Button></div>
          </form>
        </div>
      )}
      {reportOpen && (
        <div className="report-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setReportOpen(false); }}>
          <form className="report-dialog" onSubmit={(event) => { event.preventDefault(); submitReport(); }} role="dialog" aria-modal="true" aria-labelledby="report-title">
            <h3 id="report-title">Report Player</h3>
            <p>Are you sure you want to report this player for inappropriate behavior? This will flag the match for review.</p>
            <div className="report-actions">
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Report</Button>
            </div>
          </form>
        </div>
      )}
      {leaderboardOpen && (
        <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setLeaderboardOpen(false); }}>
          <div className="profile-dialog" style={{ maxHeight: "80vh", overflow: "auto" }} role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
            <h2 id="leaderboard-title">Leaderboard</h2>
            <div style={{ display: "grid", gap: "6px" }}>
              {leaderboard.length === 0 ? (
                <p style={{ color: "#6f7c71", fontSize: "12px" }}>No players yet.</p>
              ) : (
                leaderboard.map((entry, index) => (
                  <div key={entry.guestId} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: "8px", alignItems: "center", padding: "8px", border: "1px solid #d8e3cd", borderRadius: "8px", background: "#f5f8ec" }}>
                    <span style={{ fontWeight: 900, color: index < 3 ? "#b17e1d" : "#315844" }}>#{index + 1}</span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#254b35", fontSize: "13px" }}>{entry.username}</div>
                      <div style={{ fontSize: "10px", color: "#7e8c78" }}>{entry.gamesPlayed} games · {entry.winRate}% win rate</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "#315844", fontSize: "14px" }}>{entry.rating}</div>
                      <div style={{ fontSize: "9px", color: "#7e8c78" }}>{entry.wins}W / {entry.losses}L / {entry.draws}D</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="profile-actions" style={{ marginTop: "10px" }}>
              <Button type="button" variant="outline" onClick={() => setLeaderboardOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      {myMatchesOpen && (
        <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setMyMatchesOpen(false); }}>
          <div className="profile-dialog" style={{ maxHeight: "80vh", overflow: "auto" }} role="dialog" aria-modal="true" aria-labelledby="my-matches-title">
            <h2 id="my-matches-title">My Matches</h2>
            <div style={{ display: "grid", gap: "6px" }}>
              {myMatches.length === 0 ? (
                <p style={{ color: "#6f7c71", fontSize: "12px" }}>No completed matches yet.</p>
              ) : (
                myMatches.map((match) => (
                  <div key={match.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "center", padding: "10px", border: "1px solid #d8e3cd", borderRadius: "10px", background: "#f5f8ec" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "#254b35", fontSize: "13px" }}>
                        <span className={match.result}>{match.result === "win" ? "WIN" : match.result === "loss" ? "LOSS" : "DRAW"}</span>
                        {" · "}
                        {match.winner === "wood" ? "Wood" : "Stone"} won
                      </div>
                      <div style={{ fontSize: "10px", color: "#7e8c78" }}>
                        {new Date(match.playedAt).toLocaleDateString()} · {match.moveCount} moves
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openReplay(match)}>
                      <Play size={14} /> Replay
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="profile-actions" style={{ marginTop: "10px" }}>
              <Button type="button" variant="outline" onClick={() => setMyMatchesOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
      {replayOpen && replayMatch && (
        <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setReplayOpen(false); }}>
          <div className="profile-dialog" style={{ maxHeight: "90vh", overflow: "auto" }} role="dialog" aria-modal="true" aria-labelledby="replay-title">
            <h2 id="replay-title">Match Replay</h2>
            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", color: "#6f7c71" }}>
                  Move {replayStep + 1} of {replayMatch.moves.length}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button size="sm" variant="outline" onClick={replayPrev} disabled={replayStep === 0}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={replayNext} disabled={replayStep >= replayMatch.moves.length - 1}>Next</Button>
                  <Button size="sm" variant="outline" onClick={() => setReplayOpen(false)}>Close</Button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", maxWidth: "320px", margin: "0 auto" }}>
                {points.map((p) => {
                  const piece = replayPieces.find((piece) => piece.x === p.x && piece.y === p.y);
                  const isWinning = replayGame.winner && replayGame.winningLine?.some((linePoint) => linePoint.x === p.x && linePoint.y === p.y);
                  return (
                    <div
                      key={key(p.x, p.y)}
                      style={{
                        aspectRatio: "1",
                        border: "1px solid #c6beaf",
                        borderRadius: "8px",
                        background: "#f8f4e9",
                        display: "grid",
                        placeItems: "center",
                        position: "relative",
                      }}
                    >
                      {piece && (
                        <span
                          style={{
                            width: "70%",
                            height: "70%",
                            borderRadius: piece.player === "stone" ? "50%" : "0",
                            background: piece.player === "stone" ? "#7a7a7a" : "#c9a66b",
                            boxShadow: isWinning ? "0 0 0 3px #4ade80" : "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
