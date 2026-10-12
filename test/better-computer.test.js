import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";

// "herz:7" -> { suit: "herz", rank: "7" }
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
// A stack with a face-down card, unless the string ends with "!".
const stack = (s) => (s.endsWith("!") ? { down: null, up: c(s.slice(0, -1)) } : { down: c("karo:9"), up: c(s) });
// The computer is in turn. `lead` is the card the human led, if any.
function position(trump, computer, human, lead) {
  const state = rules.newGame(1, "computer");
  return {
    ...state, trump, stock: [], turn: "computer",
    trick: lead ? [{ player: "human", card: c(lead) }] : [],
    players: { computer: { stacks: computer.map(stack) }, human: { stacks: human.map(stack) } },
  };
}
const announceWith = (ups) => position(null, ups, ["herz:7"]);

test("AC-1: the computer announces grand with 2 or more Buben, else the suit rule", () => {
  assert.deepEqual(aiMove(announceWith(["kreuz:B", "herz:7", "pik:B", "herz:A"])), { type: "announce", game: "grand" });
  assert.deepEqual(aiMove(announceWith(["karo:B", "herz:B", "kreuz:B", "pik:B"])), { type: "announce", game: "grand" });
  assert.deepEqual(aiMove(announceWith(["herz:A", "herz:7", "pik:K", "kreuz:B"])), { type: "announce", game: "herz" });
  assert.deepEqual(aiMove(announceWith(["pik:7", "karo:A", "pik:8", "karo:10"])), { type: "announce", game: "karo" });
});

test("AC-2: the computer leads the safe card with the most points, else the lowest card", () => {
  const safe = position("herz", ["pik:10", "pik:A", "kreuz:7", "herz:9"], ["kreuz:A", "kreuz:10", "karo:K", "karo:7"]);
  assert.deepEqual(aiMove(safe), { type: "play", stack: 1 });
  const none = position("herz", ["kreuz:8", "pik:A", "karo:D", "pik:7", "herz:K"], ["kreuz:B", "karo:A", "herz:A"]);
  assert.deepEqual(aiMove(none), { type: "play", stack: 3 });
});

test("AC-3: the computer takes a trick with points with the cheapest winner", () => {
  assert.deepEqual(aiMove(position("karo", ["kreuz:B", "karo:7", "herz:A", "herz:7"], ["pik:7"], "herz:10")), { type: "play", stack: 2 });
  assert.deepEqual(aiMove(position("karo", ["kreuz:B", "pik:8", "karo:7"], ["pik:7"], "herz:10")), { type: "play", stack: 2 });
});

test("AC-4: the computer gives the card with the fewest points, a non-trump before a trump", () => {
  assert.deepEqual(aiMove(position("karo", ["pik:10", "kreuz:K", "pik:8", "kreuz:D"], ["pik:7"], "herz:A")), { type: "play", stack: 2 });
  // karo:7 could win, but the lead herz:7 has no points.
  assert.deepEqual(aiMove(position("karo", ["karo:A", "karo:7", "pik:9", "kreuz:K"], ["pik:7"], "herz:7")), { type: "play", stack: 2 });
});

test("AC-5: on a tie the computer plays from a stack with a face-down card", () => {
  assert.deepEqual(aiMove(position("karo", ["kreuz:7!", "pik:7", "kreuz:A"], ["pik:A"], "herz:8")), { type: "play", stack: 1 });
  assert.deepEqual(aiMove(position("karo", ["kreuz:7", "pik:7", "kreuz:A"], ["pik:A"], "herz:8")), { type: "play", stack: 0 });
  assert.deepEqual(aiMove(position("karo", ["kreuz:7!", "pik:7!", "kreuz:A"], ["pik:A"], "herz:8")), { type: "play", stack: 0 });
});

const step = (state) => rules.applyMove(state, aiMove(state));

// Announce, lead, and second-card positions of the computer from seeded games.
function computerPositions(seed) {
  const found = [rules.newGame(seed, "human")];
  let state = step(rules.newGame(seed, seed % 2 ? "human" : "computer"));
  while (!rules.isOver(state)) {
    if (state.turn === "computer") found.push(state);
    state = step(state);
  }
  return found;
}

test("AC-6: the move does not depend on the face-down cards or the stock", () => {
  const hide = (stacks, card) => ({ stacks: stacks.map((s) => ({ ...s, down: s.down && c(card) })) });
  for (let seed = 0; seed < 50; seed++) {
    const all = computerPositions(seed);
    assert.ok(all.some((s) => s.trump === null) && all.some((s) => s.trick.length === 0) && all.some((s) => s.trick.length === 1));
    for (const state of all) {
      const expected = aiMove(state);
      const changed = {
        ...state,
        stock: state.stock.length ? [...state.stock].reverse() : [c("kreuz:A")],
        players: { human: hide(state.players.human.stacks, "pik:A"), computer: hide(state.players.computer.stacks, "kreuz:B") },
      };
      assert.deepEqual(aiMove(changed), expected);
      assert.deepEqual(aiMove({ ...state, stock: state.stock.map(() => c("herz:7")) }), expected);
    }
  }
});

test("AC-7: in 200 seeded games every move is legal and deterministic, and each game has 16 tricks", () => {
  for (let seed = 0; seed < 200; seed++) {
    let state = rules.newGame(seed, seed % 2 ? "human" : "computer");
    state = rules.applyMove(state, { type: "announce", game: rules.GAMES[seed % 5] });
    while (!rules.isOver(state)) {
      const before = structuredClone(state);
      const move = aiMove(state);
      assert.deepEqual(aiMove(state), move);
      assert.deepEqual(state, before);
      assert.equal(move.type, "play");
      assert.ok(rules.legalStacksFor(state).includes(move.stack));
      state = rules.applyMove(state, move);
    }
    assert.equal(state.tricks.length, 16);
  }
});
