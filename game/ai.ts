import { BOARD_SIZE, type GameState, type Piece, type Point, applyMove, findWinningLine, initialGameState, isAdjacent } from "./tigermove";

export type Difficulty = "easy" | "medium" | "hard";

const EMPTY = -1;
const WOOD = 0;
const STONE = 1;

function toBoard(state: GameState): number[][] {
  const board: number[][] = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
  for (const piece of state.pieces) {
    board[piece.y][piece.x] = piece.player === "wood" ? WOOD : STONE;
  }
  return board;
}

function countDirection(board: number[][], x: number, y: number, dx: number, dy: number, player: number): number {
  let count = 0;
  let nx = x + dx;
  let ny = y + dy;
  while (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && board[ny][nx] === player) {
    count++;
    nx += dx;
    ny += dy;
  }
  return count;
}

function getLineSegments(board: number[][], player: number): { count: number; openEnds: number }[] {
  const segments: { count: number; openEnds: number }[] = [];
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  const visited = new Set<string>();

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== player) continue;
      for (const [dx, dy] of directions) {
        const key = `${x},${y},${dx},${dy}`;
        if (visited.has(key)) continue;

        const count = 1 + countDirection(board, x, y, dx, dy, player);
        if (count < 2) continue;

        const beforeX = x - dx;
        const beforeY = y - dy;
        const afterX = x + dx * count;
        const afterY = y + dy * count;
        let openEnds = 0;
        if (beforeX >= 0 && beforeX < BOARD_SIZE && beforeY >= 0 && beforeY < BOARD_SIZE && board[beforeY][beforeX] === EMPTY) openEnds++;
        if (afterX >= 0 && afterX < BOARD_SIZE && afterY >= 0 && afterY < BOARD_SIZE && board[afterY][afterX] === EMPTY) openEnds++;

        for (let i = 0; i < count; i++) {
          visited.add(`${x + i * dx},${y + i * dy},${dx},${dy}`);
        }

        segments.push({ count, openEnds });
      }
    }
  }
  return segments;
}

function scoreSegments(segments: { count: number; openEnds: number }[]): number {
  let total = 0;
  for (const seg of segments) {
    if (seg.count >= 5) total += 100000;
    else if (seg.count === 4) total += seg.openEnds === 2 ? 10000 : 1000;
    else if (seg.count === 3) total += seg.openEnds === 2 ? 500 : 50;
    else if (seg.count === 2) total += seg.openEnds === 2 ? 20 : 5;
    else total += seg.count;
  }
  return total;
}

function evaluateBoard(board: number[][]): number {
  const woodSegments = getLineSegments(board, WOOD);
  const stoneSegments = getLineSegments(board, STONE);

  const woodScore = scoreSegments(woodSegments);
  const stoneScore = scoreSegments(stoneSegments);

  let centerBonus = 0;
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const dist = Math.abs(x - 2) + Math.abs(y - 2);
      if (board[y][x] === STONE) centerBonus += Math.max(0, 4 - dist);
      else if (board[y][x] === WOOD) centerBonus -= Math.max(0, 4 - dist);
    }
  }

  const woodThreats = woodSegments.filter(s => s.count >= 3 && s.openEnds >= 1).length;
  const stoneThreats = stoneSegments.filter(s => s.count >= 3 && s.openEnds >= 1).length;
  const threatBonus = (stoneThreats - woodThreats) * 300;

  return (stoneScore - woodScore) + centerBonus * 3 + threatBonus;
}

function getValidMoves(state: GameState): Point[] {
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

function getDepth(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy": return 2;
    case "medium": return 3;
    case "hard": return 5;
  }
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (state.winner) return state.winner === "stone" ? 100000 : -100000;
  if (depth === 0) return evaluateBoard(toBoard(state));

  const moves = getValidMoves(state);
  if (moves.length === 0) return 0;

  const isMaximizing = state.turn === "stone";

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const piece = state.pieces.find((p) => p.player === state.turn && isAdjacent(p, move));
      if (!piece) continue;
      const nextState = applyMove(state, piece.id, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const piece = state.pieces.find((p) => p.player === state.turn && isAdjacent(p, move));
      if (!piece) continue;
      const nextState = applyMove(state, piece.id, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function getMoveThreatLevel(state: GameState, pieceId: string, to: Point): number {
  const nextState = applyMove(state, pieceId, to);
  const board = toBoard(nextState);
  const segments = getLineSegments(board, STONE);
  let maxThreat = 0;
  for (const seg of segments) {
    if (seg.count >= 4 && seg.openEnds >= 1) maxThreat = Math.max(maxThreat, 4);
    else if (seg.count === 3 && seg.openEnds === 2) maxThreat = Math.max(maxThreat, 3);
    else if (seg.count === 3 && seg.openEnds === 1) maxThreat = Math.max(maxThreat, 2);
    else if (seg.count === 2 && seg.openEnds === 2) maxThreat = Math.max(maxThreat, 1);
  }
  return maxThreat;
}

function getBlockLevel(state: GameState, pieceId: string, to: Point): number {
  const nextState = applyMove(state, pieceId, to);
  const board = toBoard(nextState);
  const opponent: GameState["turn"] = state.turn === "wood" ? "stone" : "wood";
  const testState = { ...nextState, turn: opponent };
  const oppMoves = getValidMoves(testState);
  let maxOppThreat = 0;
  for (const oppMove of oppMoves) {
    const oppPiece = nextState.pieces.find((p) => p.player === opponent && isAdjacent(p, oppMove));
    if (!oppPiece) continue;
    const oppNext = applyMove(testState, oppPiece.id, oppMove);
    if (oppNext.winner === opponent) return 0;
    const oppBoard = toBoard(oppNext);
    const oppSegments = getLineSegments(oppBoard, opponent === "wood" ? WOOD : STONE);
    for (const seg of oppSegments) {
      if (seg.count >= 4 && seg.openEnds >= 1) maxOppThreat = Math.max(maxOppThreat, 4);
      else if (seg.count === 3 && seg.openEnds === 2) maxOppThreat = Math.max(maxOppThreat, 3);
    }
  }
  return maxOppThreat === 0 ? 1 : 0;
}

export function findBestMove(state: GameState, difficulty: Difficulty): { pieceId: string; to: Point } | null {
  if (state.winner) return null;
  const moves = getValidMoves(state);
  if (moves.length === 0) return null;

  const validMoves: { piece: Piece; to: Point }[] = [];
  for (const move of moves) {
    const piece = state.pieces.find((p) => p.player === state.turn && isAdjacent(p, move));
    if (piece) validMoves.push({ piece, to: move });
  }

  for (const { piece, to } of validMoves) {
    const nextState = applyMove(state, piece.id, to);
    if (nextState.winner === state.turn) {
      return { pieceId: piece.id, to };
    }
  }

  const opponent: GameState["turn"] = state.turn === "wood" ? "stone" : "wood";
  const oppState = { ...state, turn: opponent };
  const oppMoves = getValidMoves(oppState);
  
  for (const oppMove of oppMoves) {
    const oppPiece = state.pieces.find((p) => p.player === opponent && isAdjacent(p, oppMove));
    if (!oppPiece) continue;
    const oppNext = applyMove(oppState, oppPiece.id, oppMove);
    if (oppNext.winner === opponent) {
      const blockingMoves: { piece: Piece; to: Point }[] = [];
      for (const { piece, to } of validMoves) {
        const nextState = applyMove(state, piece.id, to);
        const testState = { ...nextState, turn: opponent };
        const oppMovesAfter = getValidMoves(testState);
        let stillLoses = false;
        for (const oppMoveAfter of oppMovesAfter) {
          const oppPieceAfter = nextState.pieces.find((p) => p.player === opponent && isAdjacent(p, oppMoveAfter));
          if (!oppPieceAfter) continue;
          const oppNextAfter = applyMove(testState, oppPieceAfter.id, oppMoveAfter);
          if (oppNextAfter.winner === opponent) {
            stillLoses = true;
            break;
          }
        }
        if (!stillLoses) {
          blockingMoves.push({ piece, to });
        }
      }
      if (blockingMoves.length > 0) {
        const depth = getDepth(difficulty);
        let bestMove: { pieceId: string; to: Point } | null = null;
        let bestScore = -Infinity;
        for (const { piece, to } of blockingMoves) {
          const nextState = applyMove(state, piece.id, to);
          const score = minimax(nextState, depth - 1, -Infinity, Infinity);
          if (score > bestScore) {
            bestScore = score;
            bestMove = { pieceId: piece.id, to };
          }
        }
        return bestMove ?? { pieceId: blockingMoves[0].piece.id, to: blockingMoves[0].to };
      }
    }
  }

  const scored: { piece: Piece; to: Point; tier: number; threat: number; block: number; score: number; centerDist: number }[] = [];
  
  for (const { piece, to } of validMoves) {
    const threat = getMoveThreatLevel(state, piece.id, to);
    const block = getBlockLevel(state, piece.id, to);
    
    let tier = 6;
    if (threat >= 4) tier = 2;
    else if (block === 0 && threat >= 3) tier = 4;
    else if (block === 0 && threat >= 2) tier = 5;
    else if (block > 0) tier = 3;

    const nextState = applyMove(state, piece.id, to);
    const evalScore = minimax(nextState, getDepth(difficulty) - 1, -Infinity, Infinity);
    const centerDist = Math.abs(to.x - 2) + Math.abs(to.y - 2);

    scored.push({ piece, to, tier, threat, block, score: evalScore, centerDist });
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (b.threat !== a.threat) return b.threat - a.threat;
    if (b.score !== a.score) return b.score - a.score;
    return a.centerDist - b.centerDist;
  });

  const best = scored[0];
  if (!best) return null;
  return { pieceId: best.piece.id, to: best.to };
}

export function getAIDelay(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy": return 400;
    case "medium": return 700;
    case "hard": return 1000;
  }
}
