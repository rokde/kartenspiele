import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeck, shuffle } from "../src/core/cards.js";
import {
  newGame, nextGame, applyMove, legalCards, beats, result, totals, isOver, dealSteps,
} from "../src/games/skat/rules.js";
import { aiMove } from "../src/games/skat/ai.js";

const card = (text) => {
  const [suit, rank] = text.split(" ");
  return { suit, rank };
};
const cards = (text) => text.split(", ").map(card);
const key = (c) => `${c.suit} ${c.rank}`;
const play = (state, moves) => moves.reduce((s, m) => applyMove(s, m), state);

// Throws and leaves the state as it was.
function assertRejected(state, move, seat) {
  const before = structuredClone(state);
  assert.throws(() => applyMove(state, move, seat));
  assert.deepEqual(state, before);
}

// Dealer 0: Vorhand 1, Mittelhand 2, Hinterhand 0. Vorhand becomes the declarer at 18.
const toSkat = (seed) => play(newGame(seed, 0), [{ type: "bid", value: 18 }, { type: "yes" }, { type: "pass" }, { type: "pass" }]);

test("AC-1: the deal goes 3-Skat-4-3 from Vorhand, with 32 different cards", () => {
  for (const [seed, dealer] of [[1, 0], [42, 1], [7, 2]]) {
    const state = newGame(seed, dealer);
    const deck = shuffle(createDeck(), seed);
    const v = (dealer + 1) % 3;
    const m = (dealer + 2) % 3;
    const h = dealer;
    const slice = (a, b) => deck.slice(a, b).map(key);
    assert.deepEqual(state.hands[v].map(key), [...slice(0, 3), ...slice(11, 15), ...slice(23, 26)]);
    assert.deepEqual(state.hands[m].map(key), [...slice(3, 6), ...slice(15, 19), ...slice(26, 29)]);
    assert.deepEqual(state.hands[h].map(key), [...slice(6, 9), ...slice(19, 23), ...slice(29, 32)]);
    assert.deepEqual(state.skat.map(key), slice(9, 11));
    assert.equal(new Set([...state.hands.flat(), ...state.skat].map(key)).size, 32);
    assert.deepEqual(dealSteps(dealer).map((s) => s.seat), [v, m, h, "skat", v, m, h, v, m, h]);
  }
});

test("AC-1: the dealer moves to the next seat in nextGame", () => {
  let state = newGame(3, 0);
  for (const dealer of [1, 2, 0]) {
    while (!isOver(state)) state = applyMove(state, aiMove(state));
    state = nextGame(state, 9);
    assert.equal(state.dealer, dealer);
  }
});

test("AC-1: bids go Mittelhand to Vorhand, then Hinterhand to the winner", () => {
  let state = newGame(5, 0);
  assert.equal(state.turn, 2);
  state = applyMove(state, { type: "bid", value: 18 });
  assert.equal(state.turn, 1);
  state = applyMove(state, { type: "yes" });
  assert.equal(state.turn, 2);
  state = applyMove(state, { type: "bid", value: 20 });
  state = applyMove(state, { type: "pass" });
  assert.equal(state.turn, 0);
  assert.deepEqual([state.bid.sayer, state.bid.hearer, state.bid.value], [0, 2, 20]);
  state = applyMove(state, { type: "bid", value: 22 });
  assert.equal(state.turn, 2);
  state = applyMove(state, { type: "pass" });
  assert.equal(state.phase, "skat");
  assert.equal(state.declarer, 0);
  assert.equal(state.bid.value, 22);
});

test("AC-1: an illegal bid or a move out of turn throws and changes nothing", () => {
  const state = newGame(5, 0);
  assertRejected(state, { type: "bid", value: 19 });
  assertRejected(state, { type: "yes" });
  assertRejected(state, { type: "pass" }, 1);
  assertRejected(state, { type: "bid", value: 18 }, 0);
  assertRejected(state, { type: "play", card: state.hands[2][0] });
  assertRejected(state, { type: "bid", value: "18" });
  const bid = play(state, [{ type: "bid", value: 20 }, { type: "yes" }]);
  assertRejected(bid, { type: "bid", value: 18 });
  assertRejected(bid, { type: "bid", value: 20 });
  assertRejected(bid, { type: "yes" });
});

test("AC-1: when all 3 seats pass, no score row and the next seat deals", () => {
  const state = play(newGame(5, 1, [{ declarer: 0, game: { type: "karo", hand: false, schneider: false, schwarz: false, ouvert: false }, value: 18 }]),
    [{ type: "pass" }, { type: "pass" }, { type: "pass" }]);
  assert.equal(state.phase, "passed");
  assert.equal(state.scores.length, 1);
  assert.equal(nextGame(state, 6).dealer, 2);
  assert.equal(nextGame(state, 6).scores.length, 1);
});

test("AC-2: after pickup the declarer has 12 cards and must put away exactly 2", () => {
  let state = applyMove(toSkat(11), { type: "pickup" });
  assert.equal(state.hands[1].length, 12);
  assert.equal(state.skat.length, 0);
  assertRejected(state, { type: "declare", game: "grand" });
  const [a, b, c] = state.hands[1];
  state = play(state, [{ type: "discard", card: a }, { type: "discard", card: b }]);
  assertRejected(state, { type: "discard", card: c });
  state = play(state, [{ type: "takeback", card: a }, { type: "discard", card: c }]);
  assert.equal(state.hands[1].length, 10);
  assert.deepEqual(state.skat, [b, c]);
  state = applyMove(state, { type: "declare", game: "kreuz" });
  assert.equal(state.phase, "play");
  assert.equal(state.turn, 1);
});

test("AC-2: Schneider, Schwarz and Ouvert in suit games and Grand need a Hand game", () => {
  const picked = play(toSkat(11), [{ type: "pickup" }]);
  const ready = play(picked, picked.hands[1].slice(0, 2).map((c) => ({ type: "discard", card: c })));
  for (const flag of ["schneider", "schwarz", "ouvert"]) {
    assertRejected(ready, { type: "declare", game: "pik", [flag]: true });
  }
  // Null Ouvert (46) needs no Hand.
  assert.equal(applyMove(ready, { type: "declare", game: "null", ouvert: true }).game.ouvert, true);
  const hand = applyMove(toSkat(11), { type: "declare", game: "pik", ouvert: true });
  assert.deepEqual(hand.game, { type: "pik", hand: true, schneider: true, schwarz: true, ouvert: true });
  assert.equal(applyMove(toSkat(11), { type: "declare", game: "null", ouvert: true }).game.ouvert, true);
});

test("AC-2: legal cards follow suit, Buben are trump in suit games and Grand, Null has no trump", () => {
  const hand = cards("herz A, kreuz B, karo 7, herz 7");
  assert.deepEqual(legalCards(hand, "grand", card("herz B")), cards("kreuz B"));
  assert.deepEqual(legalCards(hand, "grand", card("herz K")), cards("herz A, herz 7"));
  assert.deepEqual(legalCards(hand, "herz", card("pik B")), cards("herz A, kreuz B, herz 7"));
  assert.deepEqual(legalCards(hand, "karo", card("pik 8")), hand);
  assert.deepEqual(legalCards(hand, "null", card("herz B")), cards("herz A, herz 7"));
  assert.deepEqual(legalCards(hand, "null", card("kreuz 7")), cards("kreuz B"));
  assert.ok(beats(card("pik B"), card("herz B"), "grand"));
  assert.ok(beats(card("karo 7"), card("herz A"), "karo"));
  assert.ok(!beats(card("kreuz A"), card("herz 7"), "herz"));
  // Null order: A K D B 10 9 8 7.
  assert.ok(beats(card("herz B"), card("herz 10"), "null"));
  assert.ok(beats(card("herz D"), card("herz B"), "null"));
  assert.ok(!beats(card("herz 7"), card("herz 8"), "null"));
});

test("AC-2: the trick winner leads the next trick", () => {
  let state = applyMove(toSkat(21), { type: "declare", game: "grand" });
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 3; k++) state = applyMove(state, aiMove(state));
    assert.equal(state.turn, state.tricks.at(-1).winner);
  }
});

test("AC-2: a Null game ends at the first trick of the declarer", () => {
  const hands = [
    cards("karo A, karo 10, karo K, karo D, karo B, karo 9, karo 8, karo 7, pik B, pik D"),
    cards("kreuz A, kreuz 10, kreuz K, kreuz D, kreuz B, kreuz 9, kreuz 8, kreuz 7, pik 7, pik 8"),
    cards("herz A, herz 10, herz K, herz D, herz B, herz 9, herz 8, herz 7, pik 9, pik 10"),
  ];
  let state = applyMove({ ...toSkat(1), hands, skat: cards("pik K, pik A") }, { type: "declare", game: "null" });
  state = play(state, [{ type: "play", card: card("kreuz A") }, { type: "play", card: card("herz 7") }, { type: "play", card: card("karo 7") }]);
  assert.equal(state.phase, "over");
  assert.equal(state.tricks.length, 1);
  assert.deepEqual(state.scores, [{ declarer: 1, game: state.game, value: -70 }]);
});

// Declarer seat 0 plays `hand` in order. The opponents play `first`, then the other cards.
// `wins` marks the tricks of the declarer with "1".
function finished(game, hand, skat, wins, first = "", bid = 18) {
  const own = cards(hand);
  const used = new Set([...own, ...cards(skat), ...(first ? cards(first) : [])].map(key));
  const rest = [...(first ? cards(first) : []), ...createDeck().filter((c) => !used.has(key(c)))];
  const tricks = own.map((c, i) => ({
    winner: wins[i] === "1" ? 0 : 1,
    cards: [{ seat: 0, card: c }, { seat: 1, card: rest[2 * i] }, { seat: 2, card: rest[2 * i + 1] }],
  }));
  return {
    game: { hand: false, schneider: false, schwarz: false, ouvert: false, ...game },
    declarer: 0, tricks, skat: cards(skat), bid: { value: bid },
  };
}

const KARO = "karo A, karo 10, kreuz B, karo K, karo D, karo 9, karo 8, karo 7, herz 7, herz 8";
const KARO_90 = "karo 10, karo A, kreuz B, karo K, karo D, karo 9, karo 8, karo 7, herz 7, herz 8";

const TABLE = [
  ["Kreuz mit 2 won", finished({ type: "kreuz" }, "kreuz A, kreuz 10, kreuz B, pik B, kreuz K, kreuz D, kreuz 9, kreuz 8, kreuz 7, herz 7",
    "herz 8, herz 9", "1100000000", "herz A, herz 10, karo A, karo 10"), 36, 63],
  ["Grand ohne 1 Hand won", finished({ type: "grand", hand: true }, "kreuz A, kreuz 10, pik A, pik 10, pik B, herz B, karo B, kreuz K, pik K, herz A",
    "herz 7, herz 8", "1110000000", "herz 10, herz K, karo A, karo 10, karo K, karo D"), 72, 74],
  ["Herz mit 1 Schneider won", finished({ type: "herz" }, "herz 7, herz A, herz 10, herz K, herz D, herz 9, herz 8, kreuz B, kreuz A, kreuz 10",
    "pik 7, pik 8", "0111111111", "pik 9, karo 9"), 30, 120],
  ["Null Ouvert Hand won", finished({ type: "null", hand: true, ouvert: true }, "kreuz 7, kreuz 8, kreuz 9, kreuz 10, pik 7, pik 8, pik 9, herz 7, herz 8, herz 9",
    "karo 7, karo 8", "0000000000"), 59, 0],
  ["Pik ohne 3 lost after pickup", finished({ type: "pik" }, "pik A, pik 10, karo B, pik K, pik D, pik 9, pik 8, pik 7, kreuz 7, kreuz 8",
    "herz 7, herz 8", "1100000000", "herz A, herz 10, karo 9, karo 8"), -88, 42],
  ["Grand mit 1 Hand lost", finished({ type: "grand", hand: true }, "kreuz A, kreuz 10, kreuz K, kreuz B, herz B, kreuz D, kreuz 9, kreuz 8, kreuz 7, herz 7",
    "herz 8, herz 9", "1110000000", "pik A, pik 9, pik 8, pik 7, karo 7, karo 8"), -144, 36],
  ["61 points win", finished({ type: "karo" }, KARO, "herz 9, pik 7", "1110000000", "herz A, herz 10, pik A, pik D, kreuz D, kreuz 9"), 18, 61],
  ["60 points lose", finished({ type: "karo" }, KARO, "herz 9, pik 7", "1110000000", "herz A, herz 10, pik A, pik D, herz B, kreuz 9"), -36, 60],
  ["90 points is Schneider", finished({ type: "karo" }, KARO_90, "herz 9, pik 7", "0111111111", "herz 10, pik 10"), 27, 90],
  ["89 points is no Schneider", finished({ type: "karo" }, KARO_90, "herz 9, pik 7", "0111111111", "herz 10, herz A"), 18, 89],
  ["30 points is Schneider for the opponents", finished({ type: "karo" }, KARO, "herz 9, pik 7", "1110000000", "pik K, pik D, kreuz 9, kreuz 8, kreuz 7, pik 9"), -54, 30],
  ["31 points is no Schneider", finished({ type: "karo" }, KARO, "herz 9, pik 7", "1110000000", "pik K, herz B, pik B, kreuz 9, kreuz 8, kreuz 7"), -36, 31],
  ["überreizt: bid 24, Karo mit 1 won", finished({ type: "karo" }, KARO, "herz 9, pik 7", "1110000000", "herz A, herz 10, pik A, pik D, kreuz D, kreuz 9", 24), -54, 61],
];

for (const [name, state, score, points] of TABLE) {
  test(`AC-3: ${name} = ${score}`, () => {
    const res = result(state);
    assert.equal(res.points, points);
    assert.equal(res.score, score);
  });
}

test("AC-3: each finished game adds one score row, with the value for the declarer and 0 for the others", () => {
  let state = newGame(8, 0);
  for (let n = 0; n < 6; n++) {
    const before = state.scores.length;
    while (!isOver(state)) state = applyMove(state, aiMove(state));
    const rows = state.phase === "passed" ? 0 : 1;
    assert.equal(state.scores.length, before + rows);
    if (rows) assert.deepEqual(state.scores.at(-1), { declarer: state.declarer, game: state.game, value: result(state).score });
    state = nextGame(state, 100 + n);
  }
  const sums = totals(state.scores);
  for (const seat of [0, 1, 2]) {
    assert.equal(sums[seat], state.scores.filter((r) => r.declarer === seat).reduce((t, r) => t + r.value, 0));
  }
});
