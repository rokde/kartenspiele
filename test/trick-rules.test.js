import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrump, suitOf, beats, legalStacks, trickWinner, playFromStack } from "../src/games/offiziersskat/rules.js";

// "herz:7" -> { suit: "herz", rank: "7" }
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
const hand = (ups) => ups.map((up) => ({ down: c("karo:7"), up: up && c(up) }));

test("AC-1: isTrump and suitOf", () => {
  assert.equal(isTrump(c("herz:7"), "herz"), true);
  assert.equal(isTrump(c("kreuz:B"), "herz"), true);
  assert.equal(isTrump(c("pik:A"), "herz"), false);
  assert.equal(suitOf(c("kreuz:B"), "herz"), "trump");
  assert.equal(suitOf(c("pik:A"), "herz"), "pik");
  const deck = ["kreuz", "pik", "herz", "karo"].flatMap((s) => ["7", "8", "9", "10", "B", "D", "K", "A"].map((r) => c(`${s}:${r}`)));
  assert.deepEqual(deck.filter((card) => isTrump(card, "grand")).map((card) => card.rank), ["B", "B", "B", "B"]);
  assert.equal(suitOf(c("herz:A"), "grand"), "herz");
});

test("AC-2: beats follows the trump order", () => {
  const order = ["kreuz:B", "pik:B", "herz:B", "karo:B", "pik:A", "pik:10", "pik:K", "pik:D", "pik:9", "pik:8", "pik:7"].map(c);
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) assert.equal(beats(order[i], order[j], "pik"), i < j, `${i} vs ${j}`);
  }
  assert.equal(beats(c("karo:B"), c("pik:A"), "pik"), true);
  const plain = ["karo:A", "karo:10", "karo:K", "karo:D", "karo:9", "karo:8", "karo:7"].map(c);
  for (let i = 0; i < plain.length - 1; i++) assert.equal(beats(plain[i], plain[i + 1], "pik"), true);
  assert.equal(beats(c("karo:K"), c("karo:10"), "pik"), false);
});

test("AC-3: legalStacks on lead returns all stacks with a face-up card", () => {
  assert.deepEqual(legalStacks(hand(["herz:A", null, "pik:7", null, "kreuz:B"]), "herz", null), [0, 2, 4]);
  assert.deepEqual(legalStacks(hand([null, null]), "grand", null), []);
});

test("AC-4: legalStacks makes the player follow suit", () => {
  const stacks = hand(["pik:A", "karo:9", null, "pik:7", "herz:K"]);
  assert.deepEqual(legalStacks(stacks, "herz", c("pik:10")), [0, 3]);
  assert.deepEqual(legalStacks(stacks, "herz", c("kreuz:10")), [0, 1, 3, 4]);
});

test("AC-5: trump counts as one suit", () => {
  const stacks = hand(["kreuz:B", "herz:7", "pik:A", "herz:A"]);
  assert.deepEqual(legalStacks(stacks, "herz", c("herz:K")), [0, 1, 3]);
  assert.deepEqual(legalStacks(hand(["kreuz:B", "pik:8"]), "herz", c("kreuz:9")), [0, 1]);
  assert.deepEqual(legalStacks(hand(["kreuz:B", "kreuz:A"]), "herz", c("kreuz:9")), [1]);
  assert.deepEqual(legalStacks(hand(["pik:B", "herz:8", "kreuz:A"]), "herz", c("karo:B")), [0, 1]);
});

test("AC-6: trickWinner", () => {
  assert.equal(trickWinner(c("pik:10"), c("pik:A"), "herz"), "second");
  assert.equal(trickWinner(c("pik:A"), c("herz:7"), "herz"), "second");
  assert.equal(trickWinner(c("pik:A"), c("karo:B"), "grand"), "second");
  assert.equal(trickWinner(c("pik:A"), c("pik:10"), "herz"), "lead");
  assert.equal(trickWinner(c("kreuz:7"), c("pik:A"), "herz"), "lead");
  assert.equal(trickWinner(c("herz:B"), c("herz:A"), "herz"), "lead");
  assert.equal(trickWinner(c("herz:7"), c("kreuz:A"), "grand"), "lead");
});

test("AC-7: playFromStack reveals the card below and keeps the input", () => {
  const X = c("kreuz:9");
  const Y = c("herz:A");
  const stacks = [{ down: X, up: Y }, { down: c("pik:7"), up: c("pik:8") }];
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
  const stacks = hand(["kreuz:B", "pik:8", null]);
  const before = JSON.parse(JSON.stringify(stacks));
  const results = () => [
    isTrump(c("herz:7"), "herz"),
    suitOf(c("kreuz:B"), "herz"),
    beats(c("herz:A"), c("herz:10"), "grand"),
    legalStacks(stacks, "herz", c("kreuz:9")),
    trickWinner(c("kreuz:7"), c("pik:A"), "herz"),
    playFromStack(stacks, 1),
  ];
  const a = results();
  assert.deepEqual(a, results());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
  assert.deepEqual(stacks, before);
});
