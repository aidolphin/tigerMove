export type Player = "stone" | "wood";
export type Piece = { id: string; player: Player; x: number; y: number };
export type Point = { x: number; y: number };
export type MoveRecord = { pieceId: string; from: Point; to: Point; captured: Piece[] };
export type GameResult = "win" | "loss" | "draw" | "ongoing";

export interface GameState {
  pieces: Piece[];
  turn: Player;
  history: MoveRecord[];
  result: GameResult;
  winner: Player | null;
  winningLine: Point[] | null;
  winnerCounts: Record<Player, number>;
}

export const BOARD_SIZE = 5;

export function createInitialState(): GameState {
  return {
    pieces: [
      { id: "w1", player: "wood", x: 0, y: 4 },
      { id: "s1", player: "stone", x: 1, y: 4 },
      { id: "w2", player: "wood", x: 2, y: 4 },
      { id: "s2", player: "stone", x: 3, y: 4 },
      { id: "w3", player: "wood", x: 4, y: 4 },
      { id: "s3", player: "stone", x: 4, y: 3 },
      { id: "w4", player: "wood", x: 4, y: 2 },
      { id: "s4", player: "stone", x: 4, y: 1 },
      { id: "w5", player: "wood", x: 4, y: 0 },
      { id: "s5", player: "stone", x: 3, y: 0 },
    ],
    turn: "wood",
    history: [],
    result: "ongoing",
    winner: null,
    winningLine: null,
    winnerCounts: { wood: 0, stone: 0 },
  };
}

export function isAdjacent(from: Point, to: Point): boolean {
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  return dx + dy === 1 || (dx === 1 && dy === 1 && (from.x + from.y) % 2 === 0);
}

export function findWinningLine(pieces: Piece[], player: Player): Point[] | null {
  const positions = new Set(
    pieces
      .filter((piece) => piece.player === player)
      .map((piece) => `${piece.x}-${piece.y}`),
  );
  const lines = [
    ...Array.from({ length: BOARD_SIZE }, (_, index) =>
      Array.from({ length: BOARD_SIZE }, (_, offset) => ({ x: offset, y: index })),
    ),
    ...Array.from({ length: BOARD_SIZE }, (_, index) =>
      Array.from({ length: BOARD_SIZE }, (_, offset) => ({ x: index, y: offset })),
    ),
    Array.from({ length: BOARD_SIZE }, (_, index) => ({ x: index, y: index })),
    Array.from({ length: BOARD_SIZE }, (_, index) => ({ x: BOARD_SIZE - 1 - index, y: index })),
  ];
  return lines.find((line) => line.every((position) => positions.has(`${position.x}-${position.y}`))) ?? null;
}

export function validateMove(state: GameState, pieceId: string, to: Point): { valid: boolean; reason?: string } {
  if (state.result !== "ongoing") {
    return { valid: false, reason: "The match is already over" };
  }
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) {
    return { valid: false, reason: "Piece not found" };
  }
  if (piece.player !== state.turn) {
    return { valid: false, reason: "It is not this player's turn" };
  }
  if (to.x < 0 || to.x >= BOARD_SIZE || to.y < 0 || to.y >= BOARD_SIZE) {
    return { valid: false, reason: "Move is outside the board" };
  }
  if (state.pieces.some((candidate) => candidate.x === to.x && candidate.y === to.y)) {
    return { valid: false, reason: "That point is occupied" };
  }
  if (!isAdjacent(piece, to)) {
    return { valid: false, reason: "Piece can only move to an adjacent point" };
  }
  return { valid: true };
}

export function applyMove(state: GameState, pieceId: string, to: Point): GameState {
  const validation = validateMove(state, pieceId, to);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const piece = state.pieces.find((candidate) => candidate.id === pieceId)!;
  const from = { x: piece.x, y: piece.y };
  const captured: Piece[] = [];

  const pieces = state.pieces.map((candidate) =>
    candidate.id === pieceId ? { ...candidate, ...to } : candidate,
  );

  const nextTurn: Player = state.turn === "wood" ? "stone" : "wood";
  const winningLine = findWinningLine(pieces, state.turn);
  const winner = winningLine ? state.turn : null;
  const result: GameResult = winner ? "win" : "ongoing";
  const winnerCounts = winner
    ? { ...state.winnerCounts, [winner]: state.winnerCounts[winner] + 1 }
    : state.winnerCounts;

  const history: MoveRecord[] = [
    ...state.history,
    { pieceId, from, to, captured },
  ];

  return {
    pieces,
    turn: nextTurn,
    history,
    result,
    winner,
    winningLine,
    winnerCounts,
  };
}

export function getValidMoves(state: GameState): Point[] {
  const occupied = new Set(state.pieces.map((p) => `${p.x}-${p.y}`));
  const moves: Point[] = [];
  for (const piece of state.pieces) {
    if (piece.player !== state.turn) continue;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = piece.x + dx;
        const ny = piece.y + dy;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) continue;
        if (occupied.has(`${nx}-${ny}`)) continue;
        if (!isAdjacent(piece, { x: nx, y: ny })) continue;
        moves.push({ x: nx, y: ny });
      }
    }
  }
  return moves;
}
