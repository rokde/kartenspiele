import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";

const step = (state) => rules.applyMove(state, aiMove(state));
const count = (html, text) => html.split(text).length - 1;
const OUTCOMES = ["Gewonnen!", "Verloren", "Unentschieden"];
// "rot:A" -> { suit: "rot", rank: "A" }
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
const trick = (winner, a, b) => ({ winner, cards: [{ player: "human", card: c(a) }, { player: "computer", card: c(b) }] });

// The AI plays both sides until the game is over, and returns each state.
function playOut(state) {
  const states = [state];
  while (!rules.isOver(states.at(-1))) states.push(step(states.at(-1)));
  return states;
}

// A finished game with the given tricks, filled up to 16 with tricks of 0 points for the computer.
function finished(tricks, scores = []) {
  const filler = Array.from({ length: 16 - tricks.length }, () => trick("computer", "rot:7", "rot:8"));
  return { ...rules.newGame(1, "computer", scores), trump: "rot", tricks: [...tricks, ...filler] };
}

test("AC-1: points adds the card points of the tricks of each player", () => {
  const state = { ...rules.newGame(1), tricks: [trick("human", "rot:A", "rot:10"), trick("computer", "gruen:K", "eichel:U"), trick("human", "rot:7", "schellen:O")] };
  assert.deepEqual(rules.points(state), { human: 24, computer: 6 });
  assert.deepEqual(rules.points(rules.newGame(1)), { human: 0, computer: 0 });
  for (let seed = 0; seed < 50; seed++) {
    const { human, computer } = rules.points(playOut(rules.newGame(seed, seed % 2 ? "human" : "computer")).at(-1));
    assert.equal(human + computer, 120);
  }
});

test("AC-2: newGame sets dealer, vorhand, and scores, and the state is plain JSON", () => {
  const first = rules.newGame(5);
  assert.equal(first.dealer, "computer");
  assert.equal(first.vorhand, "human");
  assert.deepEqual(first.scores, []);
  assert.equal(rules.newGame(5, "human").vorhand, "computer");
  const scores = [{ human: 70, computer: 50 }];
  const state = rules.newGame(5, "human", scores);
  assert.deepEqual(state.scores, scores);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test("AC-3: scores gets one entry only when the 16th trick closes", () => {
  const scores = [{ human: 60, computer: 60 }];
  const states = playOut(step(rules.newGame(3, "computer", scores)));
  for (const state of states.slice(0, -1)) assert.deepEqual(state.scores, scores);
  const last = states.at(-1);
  assert.equal(last.scores.length, 2);
  assert.deepEqual(last.scores[0], scores[0]);
  assert.deepEqual(last.scores[1], rules.points(last));
});

test("AC-4: nextGame deals again with the other dealer and keeps the scores", () => {
  let state = playOut(step(rules.newGame(4))).at(-1);
  const dealers = [state.dealer];
  for (const seed of [10, 11]) {
    const next = rules.nextGame(state, seed);
    assert.deepEqual(next, rules.newGame(seed, state.dealer === "human" ? "computer" : "human", state.scores));
    assert.notEqual(next.vorhand, state.vorhand);
    assert.equal(next.trump, null);
    assert.deepEqual(next.trick, []);
    assert.deepEqual(next.tricks, []);
    assert.deepEqual(next.scores, state.scores);
    dealers.push(next.dealer);
    state = playOut(step(next)).at(-1);
  }
  assert.deepEqual(dealers, ["computer", "human", "computer"]);
  assert.equal(state.scores.length, 3);
  assert.throws(() => rules.nextGame(rules.newGame(4), 1));
  assert.throws(() => rules.nextGame(step(step(rules.newGame(4))), 1));
});

test("AC-4: nextGame does not change the input state", () => {
  const state = playOut(step(rules.newGame(4))).at(-1);
  const before = structuredClone(state);
  rules.nextGame(state, 9);
  assert.deepEqual(state, before);
});

test("AC-5: render shows the result panel only when the game is over", () => {
  for (const state of playOut(step(rules.newGame(6))).slice(0, -1)) {
    const html = game.render(state);
    assert.ok(!html.includes('data-action="next"'));
    assert.ok(!html.includes('class="result"'));
  }
});

test("AC-5: render shows the points, the matching result, one row per game, and the next button", () => {
  const scores = [{ human: 10, computer: 110 }, { human: 61, computer: 59 }];
  const sixty = [trick("human", "rot:A", "rot:10"), trick("human", "gruen:K", "gruen:O"), trick("human", "eichel:A", "eichel:10"), trick("human", "schellen:A", "rot:9")];
  const cases = [
    [[...sixty, trick("human", "schellen:K", "rot:8")], 64, "Gewonnen!"],
    [[...sixty, ...sixty.map((t) => ({ ...t, winner: "computer" }))], 60, "Unentschieden"],
    [[trick("human", "rot:A", "rot:10"), ...sixty.map((t) => ({ ...t, winner: "computer" }))], 21, "Verloren"],
  ];
  for (const [tricks, human, expected] of cases) {
    const state = finished(tricks, scores);
    assert.equal(rules.points(state).human, human);
    const html = game.render(state);
    assert.ok(html.includes(`Du ${human} Punkte, Computer ${rules.points(state).computer} Punkte`));
    for (const outcome of OUTCOMES) assert.equal(count(html, outcome), outcome === expected ? 1 : 0, outcome);
    const list = html.match(/<ol class="result__scores"[^>]*>(.*?)<\/ol>/)[1];
    assert.equal(count(list, "<li>"), scores.length);
    assert.match(html, /<button type="button"[^>]*data-action="next"[^>]*>Nächstes Spiel<\/button>/);
  }
});

test("AC-6: index.nextGame announces for the computer as the new Vorhand", () => {
  for (const seed of [1, 2, 3, 42]) {
    const humanDealt = playOut(step(rules.newGame(seed, "human"))).at(-1);
    const next = game.nextGame(humanDealt, seed + 100);
    assert.equal(next.vorhand, "human");
    assert.equal(next.trump, null);
    const computerDealt = playOut(step(rules.newGame(seed, "computer"))).at(-1);
    const after = game.nextGame(computerDealt, seed + 100);
    assert.equal(after.vorhand, "computer");
    assert.equal(after.trump, aiMove(rules.nextGame(computerDealt, seed + 100)).game);
  }
});
