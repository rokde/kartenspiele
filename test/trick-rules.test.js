import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrump, suitOf, beats, legalStacks, trickWinner, playFromStack } from "../src/games/offiziersskat/rules.js";

// "rot:7" -> { suit: "rot", rank: "7" }
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
const hand = (ups) => ups.map((up) => ({ down: c("schellen:7"), up: up && c(up) }));

test("AC-1: isTrump and suitOf", () => {
  assert.equal(isTrump(c("rot:7"), "rot"), true);
  assert.equal(isTrump(c("eichel:U"), "rot"), true);
  assert.equal(isTrump(c("gruen:A"), "rot"), false);
  assert.equal(suitOf(c("eichel:U"), "rot"), "trump");
  assert.equal(suitOf(c("gruen:A"), "rot"), "gruen");
  const deck = ["eichel", "gruen", "rot", "schellen"].flatMap((s) => ["7", "8", "9", "10", "U", "O", "K", "A"].map((r) => c(`${s}:${r}`)));
  assert.deepEqual(deck.filter((card) => isTrump(card, "grand")).map((card) => card.rank), ["U", "U", "U", "U"]);
  assert.equal(suitOf(c("rot:A"), "grand"), "rot");
});

test("AC-2: beats follows the trump order", () => {
  const order = ["eichel:U", "gruen:U", "rot:U", "schellen:U", "gruen:A", "gruen:10", "gruen:K", "gruen:O", "gruen:9", "gruen:8", "gruen:7"].map(c);
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) assert.equal(beats(order[i], order[j], "gruen"), i < j, `${i} vs ${j}`);
  }
  assert.equal(beats(c("schellen:U"), c("gruen:A"), "gruen"), true);
  const plain = ["schellen:A", "schellen:10", "schellen:K", "schellen:O", "schellen:9", "schellen:8", "schellen:7"].map(c);
  for (let i = 0; i < plain.length - 1; i++) assert.equal(beats(plain[i], plain[i + 1], "gruen"), true);
  assert.equal(beats(c("schellen:K"), c("schellen:10"), "gruen"), false);
});

test("AC-3: legalStacks on lead returns all stacks with a face-up card", () => {
  assert.deepEqual(legalStacks(hand(["rot:A", null, "gruen:7", null, "eichel:U"]), "rot", null), [0, 2, 4]);
  assert.deepEqual(legalStacks(hand([null, null]), "grand", null), []);
});

test("AC-4: legalStacks makes the player follow suit", () => {
  const stacks = hand(["gruen:A", "schellen:9", null, "gruen:7", "rot:K"]);
  assert.deepEqual(legalStacks(stacks, "rot", c("gruen:10")), [0, 3]);
  assert.deepEqual(legalStacks(stacks, "rot", c("eichel:10")), [0, 1, 3, 4]);
});

test("AC-5: trump counts as one suit", () => {
  const stacks = hand(["eichel:U", "rot:7", "gruen:A", "rot:A"]);
  assert.deepEqual(legalStacks(stacks, "rot", c("rot:K")), [0, 1, 3]);
  assert.deepEqual(legalStacks(hand(["eichel:U", "gruen:8"]), "rot", c("eichel:9")), [0, 1]);
  assert.deepEqual(legalStacks(hand(["eichel:U", "eichel:A"]), "rot", c("eichel:9")), [1]);
  assert.deepEqual(legalStacks(hand(["gruen:U", "rot:8", "eichel:A"]), "rot", c("schellen:U")), [0, 1]);
});

test("AC-6: trickWinner", () => {
  assert.equal(trickWinner(c("gruen:10"), c("gruen:A"), "rot"), "second");
  assert.equal(trickWinner(c("gruen:A"), c("rot:7"), "rot"), "second");
  assert.equal(trickWinner(c("gruen:A"), c("schellen:U"), "grand"), "second");
  assert.equal(trickWinner(c("gruen:A"), c("gruen:10"), "rot"), "lead");
  assert.equal(trickWinner(c("eichel:7"), c("gruen:A"), "rot"), "lead");
  assert.equal(trickWinner(c("rot:U"), c("rot:A"), "rot"), "lead");
  assert.equal(trickWinner(c("rot:7"), c("eichel:A"), "grand"), "lead");
});

test("AC-7: playFromStack reveals the card below and keeps the input", () => {
  const X = c("eichel:9");
  const Y = c("rot:A");
  const stacks = [{ down: X, up: Y }, { down: c("gruen:7"), up: c("gruen:8") }];
  const before = JSON.parse(JSON.stringify(stacks));
  const first = playFromStack(stacks, 0);
  assert.deepEqual(first.card, Y);
  assert.deepEqual(first.stacks[0], { down: null, up: X });
  assert.deepEqual(first.stacks[1], stacks[1]);
  const second = playFromStack(first.stacks, 0);
  assert.deepEqual(second.card, X);
  assert.deepEqual(second.stacks[0], { down: null, up: null });
  assert.deepEqual(stacks, before);
  assert.deepEqual(first.stacks[0], { down: null, up: X });
  assert.notEqual(first.stacks, stacks);
  assert.throws(() => playFromStack(second.stacks, 0));
});

test("AC-8: functions are pure and return JSON-safe values", () => {
  const stacks = hand(["eichel:U", "gruen:8", null]);
  const before = JSON.parse(JSON.stringify(stacks));
  const results = () => [
    isTrump(c("rot:7"), "rot"),
    suitOf(c("eichel:U"), "rot"),
    beats(c("rot:A"), c("rot:10"), "grand"),
    legalStacks(stacks, "rot", c("eichel:9")),
    trickWinner(c("eichel:7"), c("gruen:A"), "rot"),
    playFromStack(stacks, 1),
  ];
  const a = results();
  assert.deepEqual(a, results());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(stacks, before);
});
