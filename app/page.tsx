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
} from "lucide-react";
import {
  applyMove,
  initialGameState,
  isAdjacent,
  type Point,
} from "@/game/tigermove";
import { type Difficulty, findBestMove, getAIDelay } from "@/game/ai";
type InstallPrompt = Event & { prompt: () => Promise<void> };
type MatchRole = "wood" | "stone";
type ChatMessage = { id: number; senderToken: string; senderName: string; body: string; createdAt: string };
type SavedGame = { id: string; result: "win" | "loss" | "draw"; winner: MatchRole; moves: number; playedAt: string };
type GameMode = "local" | "ai" | "online";
const points: Point[] = Array.from({ length: 25 }, (_, i) => ({
  x: i % 5,
  y: Math.floor(i / 5),
}));
const key = (x: number, y: number) => `${x}-${y}`;
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
    [online, setOnline] = useState(true),
    [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null),
    [guestId, setGuestId] = useState<string | null>(null),
    [profileName, setProfileName] = useState("Guest"),
    [profileEmail, setProfileEmail] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [profileBusy, setProfileBusy] = useState(false),
    [savedGames, setSavedGames] = useState<SavedGame[]>([]),
    [chatMessages, setChatMessages] = useState<ChatMessage[]>([]),
    [chatDraft, setChatDraft] = useState(""),
    [chatBusy, setChatBusy] = useState(false),
    [gameMode, setGameMode] = useState<GameMode>("local"),
    [aiDifficulty, setAiDifficulty] = useState<Difficulty>("medium"),
    [aiThinking, setAiThinking] = useState(false),
    [woodTime, setWoodTime] = useState(300),
    [stoneTime, setStoneTime] = useState(300),
    [timerActive, setTimerActive] = useState(false),
    [isDraw, setIsDraw] = useState(false),
    audioContext = useRef<AudioContext | null>(null),
    draggedRef = useRef(false),
    recordedGame = useRef<string | null>(null);
  const { pieces, turn } = game;
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js");
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
    if (!matchId) return;
    const syncMatch = async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}`);
        if (!response.ok) return;
        const data = (await response.json()) as {
          match: { state: typeof game; status: string };
        };
        setGame(data.match.state);
        setMatchStatus(data.match.status as "waiting" | "active" | "ended" | "cancelled");
        setStarted(data.match.status === "active");
        setLobbyMessage(
          data.match.status === "active"
            ? `Playing as ${matchRole}`
            : data.match.status === "waiting"
              ? "Waiting for Player 2"
              : data.match.status === "cancelled"
                ? "Match cancelled"
                : "Match ended",
        );
      } catch {
        setLobbyMessage("Match connection unavailable");
      }
    };
    void syncMatch();
    const interval = window.setInterval(syncMatch, 1500);
    return () => window.clearInterval(interval);
  }, [matchId, matchRole]);
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
    if (!matchId || !playerToken) return;
    const syncChat = async () => {
      const after = chatMessages.at(-1)?.id ?? 0;
      const response = await fetch(`/api/matches/${matchId}/messages?after=${after}`, { headers: { "x-player-token": playerToken } });
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      if (data.messages.length) setChatMessages((current) => [...current, ...data.messages]);
    };
    void syncChat();
    const interval = window.setInterval(syncChat, 1500);
    return () => window.clearInterval(interval);
  }, [matchId, playerToken, chatMessages]);
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
    const target = occupied.get(key(point.x, point.y));
    if (target) {
      if (target.player === turn) setSelected(target.id);
      return;
    }
    if (!selectedPiece || !isAdjacent(selectedPiece, point)) return;
    const nextGame = applyMove(game, selectedPiece.id, point);
    const move = `${turn === "wood" ? "Wood" : "Stone"}: ${String.fromCharCode(65 + selectedPiece.x)}${5 - selectedPiece.y} → ${String.fromCharCode(65 + point.x)}${5 - point.y}`;
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
    if (matchId && playerToken) {
      void fetch(`/api/matches/${matchId}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-player-token": playerToken,
        },
        body: JSON.stringify({ pieceId: selectedPiece.id, to: point }),
      });
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
    const piece = occupied.get(key(point.x, point.y));
    if (!piece || piece.player !== turn) return;
    setSelected(piece.id);
    setDragging(piece.id);
    setDragPosition({ x: event.clientX, y: event.clientY });
    setDragTarget(point);
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
    setHistory(["Ready to start", gameMode === "ai" ? "You are Wood, AI is Stone" : "Wood moves first"]);
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
      const response = await fetch("/api/matches", { method: "POST" });
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
      const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guestId, name: profileName, email: profileEmail }) });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) return setLobbyMessage(data.error ?? "Could not save profile");
      localStorage.setItem("tigermove-profile-name", profileName.trim());
      localStorage.setItem("tigermove-profile-email", profileEmail.trim().toLowerCase());
      setProfileOpen(false);
      setLobbyMessage("Your player profile is now permanent");
    } finally {
      setProfileBusy(false);
    }
  }
  async function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const body = chatDraft.trim();
    if (!matchId || !playerToken || !body || chatBusy) return;
    setChatBusy(true);
    try {
      const response = await fetch(`/api/matches/${matchId}/messages`, { method: "POST", headers: { "content-type": "application/json", "x-player-token": playerToken }, body: JSON.stringify({ name: profileName, body }) });
      if (response.ok) {
        const data = (await response.json()) as { message: ChatMessage };
        setChatMessages((current) => [...current, data.message]);
        setChatDraft("");
      }
    } finally {
      setChatBusy(false);
    }
  }
  async function updateMatch(action: "start" | "end" | "cancel" | "rematch") {
    if (!matchId || !playerToken) return false;
    const response = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-player-token": playerToken },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      setLobbyMessage("Could not update match");
      return false;
    }
    const data = (await response.json()) as { match: { state: typeof game; status: string } };
    setGame(data.match.state);
    setMatchStatus(data.match.status as "waiting" | "active" | "ended" | "cancelled");
    setStarted(data.match.status === "active");
    return true;
  }
  async function cancelMatch() {
    await updateMatch("cancel");
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
      const response = await fetch(`/api/matches/${id}/join`, { method: "POST" });
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
  async function endGame() {
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
  return (
    <main className="app-shell">
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
          <Button className="install" onClick={install}>
            <Sparkles size={16} /> Install app
          </Button>
        </div>
      </header>
      <section className="game-layout">
        <aside className="match-panel left-panel">
          <div className="mode-tabs">
            <button type="button" className={`mode-tab ${gameMode === "local" ? "active" : ""}`} onClick={() => { setGameMode("local"); resetGameState(); }}>
              <span className="mode-tab-icon">👥</span>
              <span>Local</span>
            </button>
            <button type="button" className={`mode-tab ${gameMode === "ai" ? "active" : ""}`} onClick={() => { setGameMode("ai"); resetGameState(); }}>
              <span className="mode-tab-icon">🤖</span>
              <span>vs AI</span>
            </button>
            <button type="button" className={`mode-tab ${gameMode === "online" ? "active" : ""}`} onClick={() => { setGameMode("online"); resetGameState(); }}>
              <span className="mode-tab-icon">🌐</span>
              <span>Online</span>
            </button>
          </div>

          <h1>Stone vs Wood</h1>
          <div className="multiplayer-lobby">
            <div className="lobby-heading">
              <strong>{gameMode === "ai" ? "🤖 Play vs AI" : gameMode === "online" ? "🌐 Play Online" : "👥 2-Player Local"}</strong>
              <small>{lobbyMessage}</small>
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
            ) : gameMode === "online" && !matchId ? (
              <div className="lobby-actions">
                <Button size="lg" onClick={() => void createMatch()} disabled={lobbyBusy} className="create-match-btn">
                  {lobbyBusy ? "Connecting..." : "Create Match"}
                </Button>
                <div className="join-row">
                  <input
                    value={joinCode}
                    onChange={(event) => setJoinCode(event.target.value)}
                    placeholder="Paste match ID"
                    aria-label="Match ID"
                  />
                  <Button size="sm" variant="outline" onClick={() => void joinMatch()} disabled={lobbyBusy}>Join</Button>
                </div>
              </div>
            ) : matchId && matchStatus === "waiting" ? (
              <div className="lobby-actions">
                <div className="waiting-state">
                  <div className="waiting-spinner" />
                  <p>Waiting for opponent to join...</p>
                  <small>Share the match ID below</small>
                </div>
                <div className="match-code-wrap">
                  {copied && <span className="copy-confirmation" role="status"><Check size={12} /> Copied!</span>}
                  <button type="button" className="match-code" title="Copy match ID" aria-label="Copy match ID" onClick={() => void copyMatchId()}>
                    <span>Match ID: <strong>{matchId}</strong></span>
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  </button>
                </div>
                <Button size="sm" variant="outline" className="cancel-match" onClick={() => void cancelMatch()} disabled={lobbyBusy}>
                  <X size={14} /> Cancel
                </Button>
              </div>
            ) : null}

            {gameMode === "online" && matchId && matchStatus === "active" && (
              <div className="lobby-actions">
                <div className="match-code-wrap">
                  {copied && <span className="copy-confirmation" role="status"><Check size={12} /> Copied!</span>}
                  <button type="button" className="match-code" title="Copy match ID" aria-label="Copy match ID" onClick={() => void copyMatchId()}>
                    <span>Match ID: <strong>{matchId}</strong></span>
                    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="game-status-card">
            <div className="status-row">
              <span className="status-label">Mode</span>
              <span className="status-value">{gameMode === "ai" ? "vs AI" : gameMode === "online" ? "Online" : "Local"}</span>
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
            <div className={`turn-pill ${game.winner ? "winner" : ""} ${isDraw ? "draw" : ""} ${gameMode === "ai" && turn === "stone" && started && !game.winner ? "ai-turn" : ""} ${!started && !game.winner ? "idle" : ""}`}>
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
              {aiThinking && <span className="ai-thinking-indicator">AI thinking...</span>}
              <small className="match-mode">{gameMode === "ai" ? "VS AI" : gameMode === "online" && matchId ? "ONLINE" : "2-PLAYER LOCAL"}</small>
              {started && !game.winner && !isDraw && (
                <div className="timer-display">
                  <span className={`timer wood ${turn === "wood" ? "active" : ""}`}>🪵 {Math.floor(woodTime / 60)}:{(woodTime % 60).toString().padStart(2, "0")}</span>
                  <span className="timer-divider">|</span>
                  <span className={`timer stone ${turn === "stone" ? "active" : ""}`}>🪨 {Math.floor(stoneTime / 60)}:{(stoneTime % 60).toString().padStart(2, "0")}</span>
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

          <div className="board-wrap" onPointerMove={updateDrag} onPointerUp={() => finishDrag(dragTarget ?? undefined)} onPointerCancel={() => finishDrag()}>
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
          {matchId && playerToken && (
            <section className="chat-panel" aria-label="Match chat">
              <div className="chat-heading"><strong><MessageCircle size={16} /> Match chat</strong><small>Live for both players</small></div>
              <div className="chat-messages" aria-live="polite">
                {chatMessages.length === 0 ? <p className="chat-empty">Say hello to your opponent.</p> : chatMessages.map((message) => (
                  <div className={message.senderToken === playerToken ? "chat-message mine" : "chat-message"} key={message.id}><b>{message.senderName}</b><span>{message.body}</span></div>
                ))}
              </div>
              <form className="chat-form" onSubmit={sendChat}><input value={chatDraft} onChange={(event) => setChatDraft(event.target.value)} maxLength={240} placeholder="Message opponent" aria-label="Message opponent" /><Button size="icon" type="submit" disabled={chatBusy || !chatDraft.trim()} aria-label="Send message"><Send size={15} /></Button></form>
            </section>
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
            <span className="profile-icon"><UserRound size={20} /></span><h2 id="profile-title">{profileName}</h2><p>{profileEmail ? "Permanent player profile" : "Temporary player profile"}. Your match history is saved on this device.</p>
            <div className="profile-stats"><div><strong>{savedGames.filter((game) => game.result === "win").length}</strong><small>WINS</small></div><div><strong>{savedGames.filter((game) => game.result === "loss").length}</strong><small>LOSSES</small></div><div><strong>{savedGames.filter((game) => game.result === "draw").length}</strong><small>DRAWS</small></div><div><strong>{savedGames.length}</strong><small>GAMES</small></div></div>
            {savedGames.length > 0 && <div className="profile-history"><strong>Recent games</strong>{savedGames.slice(0, 5).map((game) => <div key={game.id}><span className={game.result}>{game.result === "win" ? "WIN" : game.result === "loss" ? "LOSS" : "DRAW"}</span><p>{game.winner === "wood" ? "Wood" : "Stone"} won · {game.moves} moves</p><small>{new Date(game.playedAt).toLocaleDateString()}</small></div>)}</div>}
            <label>Name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} required maxLength={40} /></label>
            <label>Valid email<input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} required placeholder="you@example.com" /></label>
            <div className="profile-actions"><Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>Later</Button><Button type="submit" disabled={profileBusy}>{profileBusy ? "Saving..." : "Make permanent"}</Button></div>
          </form>
        </div>
      )}
    </main>
  );
}
