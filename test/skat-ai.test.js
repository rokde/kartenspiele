import { test } from "node:test";
import assert from "node:assert/strict";
import { newGame, applyMove, isOver } from "../src/games/skat/rules.js";
import { aiMove, handValue } from "../src/games/skat/ai.js";

const cards = (text) => text.split(", ").map((t) => {
  const [suit, rank] = t.split(" ");
  return { suit, rank };
});

const STRONG = cards("kreuz B, pik B, herz B, karo B, kreuz A, kreuz 10, kreuz K, kreuz D, kreuz 9, herz 7");
const WEAK = cards("kreuz K, kreuz D, kreuz 9, kreuz 8, kreuz 7, pik K, pik D, pik 9, pik 8, pik 7");

test("AC-4: 200 seeded games with 3 computer seats are legal and end", () => {
  let ended = 0;
  for (let seed = 1; seed <= 200; seed++) {
    let state = newGame(seed, seed % 3, [], [0, 1, 2]);
    for (let n = 0; n < 200 && !isOver(state); n++) {
      const move = aiMove(state);
      const max = handValue(state.hands[state.turn]);
      if (move.type === "bid") assert.ok(move.value <= max, `seed ${seed}: bid ${move.value} above ${max}`);
      if (move.type === "yes") assert.ok(state.bid.value <= max, `seed ${seed}: yes at ${state.bid.value} above ${max}`);
      // applyMove throws on an illegal move.
      state = applyMove(state, move);
    }
    assert.ok(isOver(state), `seed ${seed} did not end`);
    if (state.phase === "over") assert.equal(state.scores.length, 1);
    ended++;
  }
  assert.equal(ended, 200);
});

test("AC-4: 4 Buben and 5 cards of one suit bid at least 18 and declare", () => {
  const state = newGame(1, 0);
  const bid = aiMove({ ...state, hands: state.hands.map((h, s) => (s === state.turn ? STRONG : h)) });
  assert.deepEqual(bid, { type: "bid", value: 18 });
  // Vorhand 1 is the declarer at 18.
  let game = ["bid", "yes", "pass", "pass"].reduce((s, type) => applyMove(s, type === "bid" ? { type, value: 18 } : { type }), state);
  game = { ...game, hands: game.hands.map((h, s) => (s === 1 ? STRONG : h)) };
  while (game.phase !== "play") game = applyMove(game, aiMove(game));
  assert.ok(["kreuz", "grand"].includes(game.game.type));
});

test("AC-4: a hand with no Bube, no Ass and no Zehn passes at 18", () => {
  const state = newGame(1, 0);
  const sayer = { ...state, hands: state.hands.map((h, s) => (s === state.turn ? WEAK : h)) };
  assert.deepEqual(aiMove(sayer), { type: "pass" });
  const heard = applyMove(state, { type: "bid", value: 18 });
  assert.deepEqual(aiMove({ ...heard, hands: heard.hands.map((h, s) => (s === heard.turn ? WEAK : h)) }), { type: "pass" });
  assert.equal(handValue(WEAK), 0);
});

test("AC-4: the computer keeps one game type through both discards", () => {
  for (let seed = 1; seed <= 50; seed++) {
    let state = newGame(seed, 0, [], [0, 1, 2]);
    while (!isOver(state) && state.phase !== "discard") state = applyMove(state, aiMove(state));
    if (state.phase !== "discard") continue;
    const twice = applyMove(applyMove(state, aiMove(state)), aiMove(applyMove(state, aiMove(state))));
    const declared = aiMove(twice).game;
    // The type comes from the 12 cards only. Any 2 cards in the Skat give the same type.
    const cards = [...state.hands[state.declarer]];
    const other = { ...twice, hands: twice.hands.map((h, s) => (s === state.declarer ? cards.slice(2) : h)), skat: cards.slice(0, 2) };
    assert.equal(aiMove(other).game, declared, `seed ${seed}`);
  }
});
