import { test } from "node:test";
import assert from "node:assert/strict";
import { listGames, getGame } from "../src/core/registry.js";
import { renderMenu, renderGameScreen } from "../src/core/menu-view.js";
import { save, load } from "../src/core/storage.js";
import * as skat from "../src/games/skat/index.js";

const memory = () => {
  const items = {};
  return { getItem: (k) => items[k] ?? null, setItem: (k, v) => { items[k] = String(v); }, items };
};
const step = (state) => skat.applyMove(state, skat.aiMove(state));
const until = (state, done) => (done(state) ? state : until(step(state), done));
const all = (state) => ({ ...state, computers: [0, 1, 2] });

test("AC-6: the menu lists Offiziersskat and Skat", () => {
  assert.deepEqual(listGames().map((g) => g.id), ["offiziersskat", "skat"]);
  assert.equal(getGame("skat"), skat);
  const html = renderMenu(listGames());
  assert.match(html, /data-game-id="skat"[^>]*>Skat</);
  assert.match(html, /data-game-id="offiziersskat"[^>]*>Offiziersskat</);
});

test("AC-6: a Skat game in play restores from karten:skat", () => {
  const playing = until(all(skat.newGame(11)), (s) => s.phase === "play" && s.tricks.length === 2);
  const store = memory();
  save(store, "skat", playing);
  assert.deepEqual(Object.keys(store.items), ["karten:skat"]);
  const restored = skat.restore(load(store, "skat"));
  assert.deepEqual(restored.hands, playing.hands);
  assert.deepEqual(restored.tricks, playing.tricks);
  assert.equal(restored.turn, playing.turn);
  assert.ok(renderGameScreen(skat, restored).includes("Skat"));
});

test("AC-6: a finished Skat game restores with its score row once", () => {
  const over = until(all(skat.newGame(3, 0, [{ declarer: 1, game: { type: "grand", hand: false, schneider: false, schwarz: false, ouvert: false }, value: 48 }])), skat.isOver);
  assert.equal(over.phase, "over");
  const store = memory();
  save(store, "skat", over);
  const restored = skat.restore(load(store, "skat"));
  assert.deepEqual(restored.scores, over.scores);
  assert.equal(skat.restore({ ...over, scores: over.scores.slice(0, 1) }), null);
});

test("AC-6: soundEvents give deal, play per card, and win or lose for seat 0", () => {
  const start = all(skat.newGame(3));
  assert.deepEqual(skat.soundEvents(null, start), ["deal"]);
  const playing = until(start, (s) => s.phase === "play");
  const played = step(playing);
  assert.deepEqual(skat.soundEvents(playing, played), ["play"]);
  const before = until(playing, (s) => s.tricks.length === 9 && s.trick.length === 2);
  const over = step(before);
  const won = skat.isOver(over) && (over.scores.at(-1).value > 0) === (over.declarer === 0);
  assert.deepEqual(skat.soundEvents(before, over), ["play", won ? "win" : "lose"]);
});

test("AC-6: motionEvents give the deal steps, then play and trick events", () => {
  const start = all(skat.newGame(5));
  const deal = skat.motionEvents(null, start);
  assert.ok(deal.every((e) => e.type === "deal"));
  assert.equal(deal.length, 10);
  assert.equal(deal.reduce((n, e) => n + e.stacks.length, 0), 32);
  assert.deepEqual(deal.filter((e) => e.player === "skat").map((e) => e.stacks.length), [2]);
  assert.ok(deal.filter((e) => e.player === 0).every((e) => e.side === "up"));
  const playing = until(start, (s) => s.phase === "play" && s.trick.length === 2);
  const events = skat.motionEvents(playing, step(playing));
  assert.deepEqual(events.map((e) => e.type), ["play", "trick"]);
});

test("UX: the Skat phase labels the one-tap game buttons as a Hand game", () => {
  // Dealer 2: seats 1 and 2 pass, then Vorhand 0 plays for 18.
  const skatPhase = [{ type: "pass" }, { type: "pass" }, { type: "bid", value: 18 }]
    .reduce((s, m) => skat.applyMove(s, m), skat.newGame(4, 2));
  assert.equal(skatPhase.phase, "skat");
  assert.equal(skatPhase.declarer, 0);
  assert.match(skat.render(skatPhase), /<legend>Handspiel ansagen \(ohne Skat\)<\/legend><div class="announce__buttons">.*data-level/);
});

test("UX: the result shows the parts of the game value, the Skat label and the Stiche label", () => {
  const over = until(all(skat.newGame(3)), skat.isOver);
  const html = skat.render(over);
  if (over.phase === "over" && over.game.type !== "null") assert.match(html, /class="result__value">(mit|ohne) \d+, Spiel \d+.*: \d+ × \d+ = \d+/);
  assert.match(html, /<span class="skat-skat__label">Skat<\/span>/);
  assert.match(html, /<span class="pile__label">Stiche<\/span>/);
});
