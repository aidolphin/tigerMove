import { initialGameState, applyMove, findWinningLine, isAdjacent, type GameState, type Piece, type Point } from "./game/tigermove";
import { findBestMove, type Difficulty } from "./game/ai";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error("❌ FAIL:", message);
    process.exit(1);
  }
  console.log("✅ PASS:", message);
}

function setTurn(state: GameState, turn: GameState["turn"]): GameState {
  return { ...state, turn };
}

function makeState(pieces: Piece[], turn: GameState["turn"]): GameState {
  return {
    pieces,
    turn,
    winner: null,
    winnerCounts: { wood: 0, stone: 0 },
    winningLine: null,
  };
}

console.log("=== AI Verification Report ===\n");

// Test 1: Immediate win detection
console.log("--- Test 1: Immediate Win ---");
{
  const pieces: Piece[] = [
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
    { id: "s6", player: "stone", x: 2, y: 0 },
  ];
  const state = makeState(pieces, "stone");
  const move = findBestMove(state, "hard");
  assert(move !== null, "AI returns a move when it can win immediately");
  const next = applyMove(state, move!.pieceId, move!.to);
  assert(next.winner === "stone", `AI move results in Stone win: ${JSON.stringify(move)}`);
}

// Test 2: Block opponent win
console.log("\n--- Test 2: Block Opponent Win ---");
{
  const pieces: Piece[] = [
    { id: "w1", player: "wood", x: 0, y: 4 },
    { id: "s1", player: "stone", x: 0, y: 3 },
    { id: "w2", player: "wood", x: 1, y: 4 },
    { id: "s2", player: "stone", x: 1, y: 3 },
    { id: "w3", player: "wood", x: 2, y: 4 },
    { id: "s3", player: "stone", x: 2, y: 3 },
    { id: "w4", player: "wood", x: 3, y: 4 },
    { id: "s4", player: "stone", x: 3, y: 3 },
    { id: "w5", player: "wood", x: 4, y: 4 },
    { id: "s5", player: "stone", x: 4, y: 3 },
    { id: "s6", player: "stone", x: 4, y: 2 },
  ];
  const state = makeState(pieces, "stone");
  const move = findBestMove(state, "hard");
  assert(move !== null, "AI returns a blocking move");
  const next = applyMove(state, move!.pieceId, move!.to);
  const testState = setTurn(next, "wood");
  const woodMoves = getValidMoves(testState);
  let woodCanWin = false;
  for (const wMove of woodMoves) {
    const wPiece = next.pieces.find((p) => p.player === "wood" && isAdjacent(p, wMove));
    if (!wPiece) continue;
    const wNext = applyMove(testState, wPiece.id, wMove);
    if (wNext.winner === "wood") {
      woodCanWin = true;
      break;
    }
  }
  assert(!woodCanWin, `AI blocks all immediate Wood wins (move: ${JSON.stringify(move)})`);
}

// Test 3: Terminal state returns null
console.log("\n--- Test 3: Terminal State ---");
{
  const pieces: Piece[] = [
    { id: "w1", player: "wood", x: 0, y: 0 },
    { id: "w2", player: "wood", x: 1, y: 0 },
    { id: "w3", player: "wood", x: 2, y: 0 },
    { id: "w4", player: "wood", x: 3, y: 0 },
    { id: "w5", player: "wood", x: 4, y: 0 },
  ];
  const state = makeState(pieces, "stone");
  state.winner = "wood";
  const move = findBestMove(state, "hard");
  assert(move === null, "AI returns null when game is already over");
}

// Test 4: Evaluation consistency
console.log("\n--- Test 4: Evaluation Consistency ---");
{
  const state = initialGameState();
  const move1 = findBestMove(state, "hard");
  const move2 = findBestMove(state, "hard");
  assert(
    move1 !== null && move2 !== null && move1.pieceId === move2.pieceId && move1.to.x === move2.to.x && move1.to.y === move2.to.y,
    "Same position produces same best move (deterministic)"
  );
}

// Test 5: Depth check
console.log("\n--- Test 5: Search Depth ---");
{
  const state = initialGameState();
  const easyMove = findBestMove(state, "easy");
  const mediumMove = findBestMove(state, "medium");
  const hardMove = findBestMove(state, "hard");
  assert(easyMove !== null && mediumMove !== null && hardMove !== null, "All difficulties return a move");
  console.log(`   Easy: ${JSON.stringify(easyMove)}`);
  console.log(`   Medium: ${JSON.stringify(mediumMove)}`);
  console.log(`   Hard: ${JSON.stringify(hardMove)}`);
}

console.log("\n=== All Verification Tests Passed ===");
