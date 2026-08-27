export type Player = "stone" | "wood";
export type Piece = { id: string; player: Player; x: number; y: number };
export type Point = { x: number; y: number };
export type GameState = {
  pieces: Piece[];
  turn: Player;
  winner: Player | null;
  winnerCounts: Record<Player, number>;
  winningLine: Point[] | null;
};

export const BOARD_SIZE = 5;

export const initialGameState = (): GameState => ({
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
  winner: null,
  winnerCounts: { wood: 0, stone: 0 },
  winningLine: null,
});

export function isAdjacent(from: Point, to: Point) {
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

export function hasWinningLine(pieces: Piece[], player: Player) {
  return findWinningLine(pieces, player) !== null;
}

export function applyMove(state: GameState, pieceId: string, to: Point): GameState {
  if (state.winner) throw new Error("The match is already over");
  const piece = state.pieces.find((candidate) => candidate.id === pieceId);
  if (!piece) throw new Error("Piece not found");
  if (piece.player !== state.turn) throw new Error("It is not this player's turn");
  if (to.x < 0 || to.x >= BOARD_SIZE || to.y < 0 || to.y >= BOARD_SIZE) {
    throw new Error("Move is outside the board");
  }
  if (state.pieces.some((candidate) => candidate.x === to.x && candidate.y === to.y)) {
    throw new Error("That point is occupied");
  }
  if (!isAdjacent(piece, to)) throw new Error("Piece can only move to an adjacent point");

  const pieces = state.pieces.map((candidate) =>
    candidate.id === pieceId ? { ...candidate, ...to } : candidate,
  );
  const nextTurn: Player = state.turn === "wood" ? "stone" : "wood";
  const winningLine = findWinningLine(pieces, state.turn);
  const winner = winningLine ? state.turn : null;
  const winnerCounts = state.winnerCounts ?? { wood: 0, stone: 0 };
  return {
    pieces,
    turn: nextTurn,
    winner,
    winnerCounts: winner
      ? { ...winnerCounts, [winner]: winnerCounts[winner] + 1 }
      : winnerCounts,
    winningLine,
  };
}
