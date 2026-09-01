export type Player = import("./engine").Player;
export type Piece = import("./engine").Piece;
export type Point = import("./engine").Point;
export type GameState = import("./engine").GameState;

export { BOARD_SIZE, createInitialState as initialGameState, isAdjacent, findWinningLine, validateMove, applyMove, getValidMoves } from "./engine";
