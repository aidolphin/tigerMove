import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});

test("enforces the shared TigerMove rules", async () => {
  const { applyMove, findWinningLine, hasWinningLine, initialGameState } = await vite.ssrLoadModule(
    "/game/tigermove.ts",
  );
  const initial = initialGameState();

  assert.equal(initial.pieces.filter((piece) => piece.player === "wood").length, 5);
  assert.equal(initial.pieces.filter((piece) => piece.player === "stone").length, 5);
  assert.deepEqual(initial.winnerCounts, { wood: 0, stone: 0 });
  assert.equal(initial.winningLine, null);
  const openingPositions = initial.pieces
    .map((piece) => `${String.fromCharCode(65 + piece.x)}${5 - piece.y}:${piece.player}`);
  assert.deepEqual(openingPositions, [
    "A1:wood", "B1:stone", "C1:wood", "D1:stone", "E1:wood",
    "E2:stone", "E3:wood", "E4:stone", "E5:wood", "D5:stone",
  ]);
  assert.equal(initial.pieces.some((piece) => piece.x === 0 && piece.y === 0), false);

  const next = applyMove(initial, "w4", { x: 3, y: 2 });
  assert.equal(next.turn, "stone");
  assert.deepEqual(
    next.pieces.find((piece) => piece.id === "w4"),
    { id: "w4", player: "wood", x: 3, y: 2 },
  );
  assert.throws(() => applyMove(next, "w2", { x: 3, y: 0 }), /not this player's turn/);

  const line = [0, 1, 2, 3, 4].map((x, index) => ({
    id: `w${index + 1}`,
    player: "wood",
    x,
    y: 3,
  }));
  assert.equal(hasWinningLine(line, "wood"), true);
  assert.equal(findWinningLine(line, "wood").length, 5);
  assert.equal(hasWinningLine(line, "stone"), false);
  assert.equal(
    hasWinningLine(line.map((piece) => ({ ...piece, x: 2, y: piece.x })), "wood"),
    true,
  );
  assert.equal(
    hasWinningLine(line.map((piece) => ({ ...piece, x: piece.x, y: piece.x })), "wood"),
    true,
  );

  const winningState = {
    pieces: [
      { id: "w1", player: "wood", x: 0, y: 0 },
      { id: "w2", player: "wood", x: 1, y: 0 },
      { id: "w3", player: "wood", x: 2, y: 0 },
      { id: "w4", player: "wood", x: 3, y: 1 },
      { id: "w5", player: "wood", x: 3, y: 0 },
    ],
    turn: "wood",
    winner: null,
    winnerCounts: { wood: 0, stone: 0 },
    winningLine: null,
  };
  const winningMove = applyMove(winningState, "w4", { x: 4, y: 0 });
  assert.equal(winningMove.winner, "wood");
  assert.deepEqual(winningMove.winnerCounts, { wood: 1, stone: 0 });
  assert.equal(winningMove.winningLine.length, 5);
});
