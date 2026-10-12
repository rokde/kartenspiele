import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";

const GAMES = ["eichel", "gruen", "rot", "schellen", "grand"];
const LABELS = ["Eichel", "Grün", "Rot", "Schellen", "Grand"];
const announceButtons = (html) => [...html.matchAll(/<button[^>]*data-announce="([^"]+)"[^>]*>(.*?)<\/button>/g)];
const count = (html, text) => html.split(text).length - 1;

// Fixed computer hand: each string is "suit:rank" of one face-up card.
function stateWith(ups) {
  const state = rules.newGame(1, "human");
  const stacks = ups.map((up) => {
    const [suit, rank] = up.split(":");
    return { down: { suit: "rot", rank: "7" }, up: { suit, rank } };
  });
  return { ...state, players: { ...state.players, computer: { stacks } } };
}

test("AC-1: newGame sets vorhand from the dealer and trump null", () => {
  for (const [dealer, vorhand] of [["computer", "human"], ["human", "computer"]]) {
    const state = rules.newGame(7, dealer);
    assert.equal(state.vorhand, vorhand);
    assert.equal(state.trump, null);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    assert.deepEqual(state.players, rules.newGame(7).players);
  }
});

test("AC-2: announce sets trump and does not change the input state", () => {
  for (const g of GAMES) {
    const state = rules.newGame(3, "computer");
    const before = structuredClone(state);
    const next = rules.applyMove(state, { type: "announce", game: g });
    assert.equal(next.trump, g);
    assert.deepEqual(state, before);
  }
});

test("AC-3: applyMove rejects an unknown game, an unknown type, and a second announcement", () => {
  const state = rules.newGame(3, "computer");
  assert.throws(() => rules.applyMove(state, { type: "announce", game: "null" }));
  assert.throws(() => rules.applyMove(state, { type: "announce" }));
  assert.throws(() => rules.applyMove(state, { type: "play", game: "rot" }));
  const announced = rules.applyMove(state, { type: "announce", game: "rot" });
  assert.throws(() => rules.applyMove(announced, { type: "announce", game: "gruen" }));
});

test("AC-4: aiMove selects the suit with the most cards and ignores the Unter", () => {
  const state = stateWith(["rot:7", "rot:8", "rot:9", "eichel:A", "eichel:10", "gruen:U", "gruen:U", "gruen:U"]);
  assert.deepEqual(aiMove(state), { type: "announce", game: "rot" });
});

test("AC-4: aiMove breaks a count tie with the card points", () => {
  const state = stateWith(["eichel:7", "eichel:8", "schellen:A", "schellen:9", "gruen:K", "rot:O", "rot:U", "eichel:U"]);
  assert.deepEqual(aiMove(state), { type: "announce", game: "schellen" });
});

test("AC-4: aiMove breaks a second tie with the SUITS order and never selects grand", () => {
  const state = stateWith(["rot:A", "rot:7", "gruen:A", "gruen:8", "schellen:U", "eichel:U", "rot:U", "gruen:U"]);
  assert.deepEqual(aiMove(state), { type: "announce", game: "gruen" });
  for (let seed = 0; seed < 200; seed++) {
    assert.notEqual(aiMove(rules.newGame(seed)).game, "grand");
  }
});

test("AC-5: the module newGame announces for the computer, not for the human", () => {
  for (const seed of [1, 2, 3, 42]) {
    assert.equal(game.newGame(seed, "human").trump, aiMove(rules.newGame(seed, "human")).game);
    assert.equal(game.newGame(seed, "computer").trump, null);
  }
});

test("AC-6: render shows the 5 announce buttons only when the human must announce", () => {
  const state = game.newGame(2, "computer");
  const buttons = announceButtons(game.render(state));
  assert.deepEqual(buttons.map((m) => m[1]), GAMES);
  assert.deepEqual(buttons.map((m) => m[2].replace(/<span[^>]*>.*?<\/span>\s*/, "")), LABELS);
  assert.equal(announceButtons(game.render(game.applyMove(state, { type: "announce", game: "rot" }))).length, 0);
  assert.equal(announceButtons(game.render(game.newGame(2, "human"))).length, 0);
  assert.equal(announceButtons(game.render({ ...game.newGame(2, "human"), trump: null })).length, 0);
});

test("AC-7: render shows Vorhand, the trump name, and all cards", () => {
  const human = game.newGame(2, "computer");
  assert.ok(game.render(human).includes("Vorhand: Du"));
  assert.ok(!game.render(human).includes("Trumpf: "));
  for (const [i, g] of GAMES.entries()) {
    const html = game.render(game.applyMove(human, { type: "announce", game: g }));
    assert.match(html, new RegExp(`Trumpf: ${LABELS[i]}<`));
    assert.match(html, /<p class="trump-badge[^"]*" role="status" tabindex="-1">/);
    assert.equal(count(html, 'class="card card--'), 16);
    assert.equal(count(html, 'aria-label="Verdeckte Karte"'), 16);
  }
  const computer = game.render(game.newGame(2, "human"));
  assert.ok(computer.includes("Vorhand: Computer"));
  assert.match(computer, /Trumpf: (Eichel|Grün|Rot|Schellen)</);
});
