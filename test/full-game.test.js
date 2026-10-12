import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeck, cardName } from "../src/core/cards.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import { render } from "../src/games/offiziersskat/index.js";

const key = (card) => `${card.suit}-${card.rank}`;
const count = (html, text) => html.split(text).length - 1;
const stackButtons = (html) => [...html.matchAll(/<button[^>]*data-stack="(\d+)"/g)].map((m) => Number(m[1]));
const announced = (seed, vorhand = "human", game = "rot") =>
  rules.applyMove(rules.newGame(seed, vorhand === "human" ? "computer" : "human"), { type: "announce", game });
const legal = (state) => rules.legalStacks(state.players[state.turn].stacks, state.trump, state.trick[0]?.card);
const step = (state) => rules.applyMove(state, aiMove(state));
// "rot:7" -> { suit: "rot", rank: "7" }
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
const withStacks = (state, player, ups) => ({
  ...state,
  players: { ...state.players, [player]: { stacks: ups.map((up) => ({ down: c("schellen:7"), up: c(up) })) } },
});

test("AC-1: newGame sets turn, trick, and tricks, and the state is plain JSON", () => {
  for (const [dealer, vorhand] of [["computer", "human"], ["human", "computer"]]) {
    const state = rules.newGame(11, dealer);
    assert.equal(state.turn, vorhand);
    assert.deepEqual(state.trick, []);
    assert.deepEqual(state.tricks, []);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  }
});

test("AC-2: a play move takes the card, reveals the card below, and gives the turn away", () => {
  const state = announced(3, "human");
  const before = structuredClone(state);
  const { down, up } = state.players.human.stacks[2];
  const next = rules.applyMove(state, { type: "play", stack: 2 });
  assert.deepEqual(next.trick, [{ player: "human", card: up }]);
  assert.deepEqual(next.players.human.stacks[2], { down: null, up: down });
  assert.deepEqual(next.players.computer, state.players.computer);
  assert.equal(next.turn, "computer");
  assert.deepEqual(state, before);
});

test("AC-3: applyMove throws before the announcement, for an illegal stack, and after the game", () => {
  assert.throws(() => rules.applyMove(rules.newGame(3, "computer"), { type: "play", stack: 0 }));
  // The human leads Rot; the computer has one Rot card in stack 1, so it must follow suit.
  let state = withStacks(announced(3, "human", "grand"), "human", ["rot:A", "rot:7", "rot:8", "rot:9", "rot:K", "rot:O", "rot:10", "gruen:7"]);
  state = withStacks(state, "computer", ["gruen:A", "rot:8", "eichel:K", "schellen:9", "gruen:10", "gruen:O", "gruen:9", "gruen:8"]);
  state = rules.applyMove(state, { type: "play", stack: 0 });
  assert.throws(() => rules.applyMove(state, { type: "play", stack: 0 }));
  assert.throws(() => rules.applyMove(state, { type: "play", stack: 8 }));
  assert.equal(rules.applyMove(state, { type: "play", stack: 1 }).tricks.length, 1);
  // An empty stack is not legal.
  const empty = { ...announced(3, "human") };
  empty.players = { ...empty.players, human: { stacks: empty.players.human.stacks.map((s, i) => (i === 4 ? { down: null, up: null } : s)) } };
  assert.throws(() => rules.applyMove(empty, { type: "play", stack: 4 }));
  let over = announced(5, "computer");
  while (!rules.isOver(over)) over = step(over);
  assert.throws(() => rules.applyMove(over, { type: "play", stack: 0 }));
});

test("AC-4: the second card resolves the trick for the trickWinner", () => {
  for (let seed = 0; seed < 20; seed++) {
    const first = step(announced(seed, seed % 2 ? "human" : "computer", "gruen"));
    const [lead, player] = [first.trick[0], first.turn];
    const move = aiMove(first);
    const card = first.players[player].stacks[move.stack].up;
    const second = rules.applyMove(first, move);
    const expected = rules.trickWinner(lead.card, card, "gruen") === "lead" ? lead.player : player;
    assert.deepEqual(second.tricks, [{ winner: expected, cards: [lead, { player, card }] }]);
    assert.deepEqual(second.trick, []);
    assert.equal(second.turn, expected);
  }
});

test("AC-5: aiMove plays a random legal stack after the announcement", () => {
  let state = announced(8, "computer");
  state = withStacks(state, "human", ["rot:A", "rot:7", "rot:8", "rot:9", "rot:K", "rot:O", "rot:10", "gruen:7"]);
  state = withStacks(state, "computer", ["gruen:A", "eichel:8", "eichel:K", "gruen:9", "schellen:10", "gruen:O", "eichel:9", "rot:8"]);
  state = { ...state, turn: "human" };
  state = rules.applyMove(state, { type: "play", stack: 7 });
  assert.deepEqual(legal(state), [0, 3, 5]);
  assert.deepEqual(aiMove(state, () => 0), { type: "play", stack: 0 });
  assert.deepEqual(aiMove(state, () => 0.999), { type: "play", stack: 5 });
  for (let i = 0; i < 20; i++) assert.ok(legal(state).includes(aiMove(state).stack));
  assert.equal(aiMove(rules.newGame(8, "human")).type, "announce");
});

test("AC-6: aiMove for both players plays a full game of 16 tricks", () => {
  const deck = createDeck().map(key).sort();
  for (let seed = 0; seed < 50; seed++) {
    let state = rules.newGame(seed);
    state = step(state);
    let moves = 0;
    while (!rules.isOver(state)) {
      state = step(state);
      moves++;
    }
    assert.equal(moves, 32);
    assert.equal(state.tricks.length, 16);
    assert.deepEqual(state.tricks.flatMap((t) => t.cards.map((e) => key(e.card))).sort(), deck);
    for (const player of ["human", "computer"]) {
      assert.ok(state.players[player].stacks.every((s) => s.up === null && s.down === null));
    }
  }
});

test("AC-7: render has stack buttons only for the legal stacks of the human, and a status line", () => {
  const human = announced(4, "human");
  assert.deepEqual(stackButtons(render(human)), legal(human));
  assert.match(render(human), /Du bist dran/);
  const computer = rules.applyMove(human, { type: "play", stack: 0 });
  assert.deepEqual(stackButtons(render(computer)), []);
  assert.match(render(computer), /Computer ist dran/);
  let state = computer;
  while (!rules.isOver(state)) {
    if (state.turn === "human") assert.deepEqual(stackButtons(render(state)), legal(state));
    state = step(state);
  }
  assert.deepEqual(stackButtons(render(state)), []);
  assert.match(render(state), /Spiel vorbei/);
  assert.doesNotMatch(render(state), /ist dran/);
});

test("AC-8: render shows the open trick, else the last trick and its winner, and one back for each down card", () => {
  const backs = (state) => [...state.players.human.stacks, ...state.players.computer.stacks].filter((s) => s.down).length;
  const trickHtml = (html) => html.match(/<div class="trick">.*?<\/ul>(.*?)<\/div>/s);
  let state = announced(6, "human");
  assert.equal(count(trickHtml(render(state))[0], 'class="card '), 0);
  while (!rules.isOver(state)) {
    state = step(state);
    const html = render(state);
    const [area, caption] = trickHtml(html);
    assert.equal(count(html, 'aria-label="Verdeckte Karte"'), backs(state));
    const shown = state.trick.length ? state.trick : state.tricks.at(-1).cards;
    assert.equal(count(area, 'class="card '), shown.length);
    for (const { card } of shown) assert.ok(area.includes(`aria-label="${cardName(card)}"`));
    if (state.trick.length) assert.equal(caption, "");
    else assert.equal(caption, `<p class="trick__winner">Stich für ${state.tricks.at(-1).winner === "human" ? "dich" : "Computer"}</p>`);
  }
  assert.equal(count(render(state), 'aria-label="Verdeckte Karte"'), 0);
});

test("AC-7: each stack button has a name, and only the human row on the human turn is marked as playing", () => {
  const human = announced(4, "human");
  const html = render(human);
  for (const i of legal(human)) {
    assert.ok(html.includes(`data-stack="${i}" aria-label="${cardName(human.players.human.stacks[i].up)} spielen"`));
  }
  assert.equal(count(html, "row--playing"), 1);
  assert.equal(count(render(rules.applyMove(human, { type: "play", stack: 0 })), "row--playing"), 0);
});
