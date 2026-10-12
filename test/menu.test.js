import { test } from "node:test";
import assert from "node:assert/strict";
import { listGames, getGame } from "../src/core/registry.js";
import { renderMenu, renderGameScreen } from "../src/core/menu-view.js";

test("listGames has Offiziersskat and getGame finds it by id", () => {
  const game = listGames().find((g) => g.id === "offiziersskat");
  assert.equal(game.name, "Offiziersskat");
  assert.equal(getGame("offiziersskat"), game);
  assert.equal(getGame("unknown"), undefined);
});

test("renderMenu shows one button for each game", () => {
  const games = listGames();
  const html = renderMenu(games);
  const buttons = [...html.matchAll(/<button[^>]*data-game-id="([^"]+)"[^>]*>([^<]*)<\/button>/g)];
  assert.deepEqual(buttons.map((m) => [m[1], m[2]]), games.map((g) => [g.id, g.name]));
});

test("renderGameScreen shows the game and a Zurück button", () => {
  const html = renderGameScreen(getGame("offiziersskat"));
  assert.ok(html.includes("Offiziersskat"));
  assert.match(html, /<button[^>]*data-action="back"[^>]*>Zurück<\/button>/);
});
