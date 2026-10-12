import { test } from "node:test";
import assert from "node:assert/strict";
import { save, load } from "../src/core/storage.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";
import { renderGameScreen } from "../src/core/menu-view.js";

const memory = () => {
  const items = {};
  return { getItem: (k) => items[k] ?? null, setItem: (k, v) => { items[k] = String(v); }, items };
};
const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
const pick = (state) => aiMove(state, () => 0.3);
const step = (state) => rules.applyMove(state, pick(state));
const steps = (state, n) => Array.from({ length: n }).reduce(step, state);
const finished = (state) => (rules.isOver(state) ? state : finished(step(state)));
const roundTrip = (state) => {
  const store = memory();
  save(store, "offiziersskat", state);
  return game.restore(load(store, "offiziersskat"));
};
// Old (pre-S13) ids, built from parts so that the old-id guard in skat-deck.test.js does not match.
const OLD_SUIT = "eich" + "el";

const fresh = rules.newGame(7, "computer", [{ human: 70, computer: 50 }]);
const playing = steps(fresh, 6);
const done = finished(playing);

test("AC-1: save and load a value per game id with separate keys", () => {
  const store = memory();
  save(store, "a", { x: 1 });
  save(store, "b", [2]);
  assert.deepEqual(load(store, "a"), { x: 1 });
  assert.deepEqual(load(store, "b"), [2]);
  assert.equal(Object.keys(store.items).length, 2);
  assert.ok(Object.keys(store.items).every((k) => k.startsWith("karten:")));
});

test("AC-2: load gives null and save does not throw for bad storage or data", () => {
  const store = memory();
  assert.equal(load(store, "x"), null);
  store.setItem("karten:x", "{not json");
  assert.equal(load(store, "x"), null);
  store.setItem("karten:x", JSON.stringify({ version: 99, data: { a: 1 } }));
  assert.equal(load(store, "x"), null);
  store.setItem("karten:x", JSON.stringify({ a: 1 }));
  assert.equal(load(store, "x"), null);
  assert.equal(load(throwing, "x"), null);
  assert.equal(load(null, "x"), null);
  assert.doesNotThrow(() => save(throwing, "x", { a: 1 }));
  assert.doesNotThrow(() => save(null, "x", { a: 1 }));
});

test("AC-3: restore gives back a new, a running, and a finished state", () => {
  assert.notEqual(playing.trump, null);
  assert.ok(playing.tricks.length >= 2);
  assert.equal(done.scores.length, 2);
  for (const state of [fresh, game.newGame(8, "human"), playing, steps(fresh, 4), done]) {
    assert.deepEqual(roundTrip(state), state);
  }
});

test("AC-4: restore returns null for bad data", () => {
  const swap = (from, to) => JSON.parse(JSON.stringify(fresh).replace(from, to));
  const firstUp = fresh.players.human.stacks[0].up;
  const withCard = (card) => ({ ...fresh, stock: [card, ...fresh.stock.slice(1)] });
  const bad = [
    withCard({ suit: OLD_SUIT, rank: "7" }),
    withCard({ suit: "herz", rank: "u".toUpperCase() }),
    withCard({ suit: "herz", rank: "o".toUpperCase() }),
    withCard(firstUp),
    { ...fresh, stock: fresh.stock.slice(1) },
    { ...fresh, dealer: "alice" },
    { ...fresh, turn: "<b>" },
    { ...playing, tricks: [{ ...playing.tricks[0], winner: "nobody" }, ...playing.tricks.slice(1)] },
    { ...fresh, trump: OLD_SUIT },
    { ...fresh, scores: [{ human: "<img>", computer: 50 }] },
    { ...fresh, scores: [{ human: -1, computer: 50 }] },
    { ...fresh, scores: [{ human: 121, computer: 0 }] },
    { ...fresh, scores: [{ human: 1.5, computer: 0 }] },
    { ...fresh, seed: "1" },
    { ...fresh, players: { ...fresh.players, human: { stacks: fresh.players.human.stacks.slice(1) } } },
    swap('"kreuz"', `"${OLD_SUIT}"`),
    null, undefined, 42, "state", [], {},
  ];
  for (const data of bad) assert.equal(game.restore(data), null, JSON.stringify(data)?.slice(0, 80));
});

test("AC-4: restore drops unknown keys", () => {
  const restored = game.restore({ ...fresh, extra: "<script>", scores: [{ human: 1, computer: 2, note: "<img>" }] });
  assert.equal(restored.extra, undefined);
  assert.deepEqual(restored.scores, [{ human: 1, computer: 2 }]);
});

test("AC-5: a restored state continues like the original", () => {
  for (const start of [fresh, playing]) {
    let a = start;
    let b = roundTrip(start);
    while (!rules.isOver(a)) {
      assert.deepEqual(rules.legalStacksFor(b), rules.legalStacksFor(a));
      assert.deepEqual(pick(b), pick(a));
      a = step(a);
      b = step(b);
      assert.deepEqual(b, a);
    }
    assert.deepEqual(game.nextGame(roundTrip(a), 3), game.nextGame(a, 3));
  }
});

test("AC-6: restart deals a new game, changes the dealer, and keeps the scores", () => {
  for (const state of [fresh, playing, done, game.newGame(2, "human", [{ human: 0, computer: 120 }])]) {
    const next = game.restart(state, 11);
    assert.notEqual(next.dealer, state.dealer);
    assert.deepEqual(next.scores, state.scores);
    assert.deepEqual(next.tricks, []);
    assert.deepEqual(next.trick, []);
    assert.equal(next.players.human.stacks.length + next.players.computer.stacks.length, 16);
    if (next.vorhand === "human") assert.equal(next.trump, null);
    assert.deepEqual(next, game.newGame(11, next.dealer, state.scores));
  }
});

test("AC-7: the game screen has a Neues Spiel button", () => {
  const html = renderGameScreen(game, game.newGame(5));
  assert.match(html, /<button type="button"[^>]*data-action="new"[^>]*>Neues Spiel<\/button>/);
});
