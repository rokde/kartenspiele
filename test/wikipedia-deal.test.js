import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createDeck, shuffle, cardName } from "../src/core/cards.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";

const key = (card) => `${card.suit}-${card.rank}`;
const count = (html, text) => html.split(text).length - 1;
const EMPTY = { down: null, up: null };
const DEALERS = [["computer", "human"], ["human", "computer"]];
const step = (state) => rules.applyMove(state, aiMove(state));
const c = (s) => {
  const [suit, rank] = s.split(":");
  return { suit, rank };
};
const trick = (winner, a, b) => ({ winner, cards: [{ player: "human", card: c(a) }, { player: "computer", card: c(b) }] });

test("AC-1: newGame deals the first step only and keeps the rest in the stock", () => {
  for (const seed of [1, 42, 777]) {
    for (const [dealer, vorhand] of DEALERS) {
      const cards = shuffle(createDeck(), seed);
      const state = rules.newGame(seed, dealer);
      const v = state.players[vorhand].stacks;
      const d = state.players[dealer].stacks;
      for (let i = 0; i < 4; i++) {
        assert.deepEqual(v[i], { down: cards[i], up: cards[8 + i] });
        assert.deepEqual(d[i], { down: cards[4 + i], up: null });
      }
      for (let i = 4; i < 8; i++) {
        assert.deepEqual(v[i], EMPTY);
        assert.deepEqual(d[i], EMPTY);
      }
      assert.deepEqual(state.stock, cards.slice(12));
      assert.equal(state.trump, null);
      assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    }
  }
});

test("AC-2: the announcement deals the stock in the Wikipedia order", () => {
  for (const seed of [1, 42, 777]) {
    for (const [dealer, vorhand] of DEALERS) {
      const cards = shuffle(createDeck(), seed);
      const before = rules.newGame(seed, dealer);
      const copy = structuredClone(before);
      const state = rules.applyMove(before, { type: "announce", game: "grand" });
      assert.deepEqual(before, copy);
      const v = state.players[vorhand].stacks;
      const d = state.players[dealer].stacks;
      for (let i = 0; i < 4; i++) {
        assert.deepEqual(v[i], { down: cards[i], up: cards[8 + i] });
        assert.deepEqual(d[i], { down: cards[4 + i], up: cards[12 + i] });
        assert.deepEqual(v[4 + i], { down: cards[16 + i], up: cards[24 + i] });
        assert.deepEqual(d[4 + i], { down: cards[20 + i], up: cards[28 + i] });
      }
      assert.deepEqual(state.stock, []);
      const all = [...v, ...d].flatMap((s) => [s.down, s.up]);
      assert.ok(all.every(Boolean));
      assert.deepEqual(all.map(key).sort(), createDeck().map(key).sort());
    }
  }
});

test("AC-3: the AI announcement depends only on the 4 open cards of the computer", () => {
  for (let seed = 0; seed < 50; seed++) {
    const state = rules.newGame(seed, "human");
    const expected = aiMove(state);
    const reversed = { ...state, stock: [...state.stock].reverse() };
    const other = {
      ...state,
      stock: state.stock.map(() => c("kreuz:7")),
      players: {
        ...state.players,
        human: { stacks: state.players.human.stacks.map((s) => ({ ...s, down: s.down && c("pik:A") })) },
        computer: { stacks: state.players.computer.stacks.map((s) => ({ ...s, down: s.down && c("karo:A") })) },
      },
    };
    assert.deepEqual(aiMove(reversed), expected);
    assert.deepEqual(aiMove(other), expected);
    assert.equal(expected.type, "announce");
  }
});

test("AC-4: the human as Vorhand sees only the 4 open cards and the announce buttons", () => {
  for (const seed of [1, 2, 3, 42]) {
    const state = game.newGame(seed, "computer");
    const html = game.render(state);
    for (const s of state.players.human.stacks.slice(0, 4)) assert.ok(html.includes(cardName(s.up)), cardName(s.up));
    assert.equal(count(html, 'class="card card--'), 4);
    assert.equal(count(html, 'aria-label="Verdeckte Karte"'), 8);
    const hidden = [...state.stock, ...[...state.players.human.stacks, ...state.players.computer.stacks].map((s) => s.down).filter(Boolean)];
    for (const card of hidden) assert.ok(!html.includes(cardName(card)), cardName(card));
    assert.equal(count(html, "data-announce="), rules.GAMES.length);
  }
});

const sixty = [["herz:A", "herz:10"], ["pik:K", "pik:D"], ["kreuz:A", "kreuz:10"], ["karo:A", "herz:9"]];
const sixtyOne = [["herz:A", "herz:10"], ["pik:A", "pik:10"], ["kreuz:A", "kreuz:K"], ["karo:K", "herz:7"]];
// A finished game: the announcer takes `own`, the opponent takes `rest`, and the opponent takes 0-point filler tricks.
function finished(vorhand, own, rest = []) {
  const opponent = vorhand === "human" ? "computer" : "human";
  const tricks = [...own.map(([a, b]) => trick(vorhand, a, b)), ...rest.map(([a, b]) => trick(opponent, a, b))];
  while (tricks.length < 16) tricks.push(trick(opponent, "herz:7", "herz:8"));
  return { ...rules.newGame(1, opponent), trump: "herz", tricks };
}

test("AC-5: the announcer wins with 61, loses with 60:60, from both views", () => {
  for (const vorhand of ["human", "computer"]) {
    const win = finished(vorhand, sixtyOne);
    assert.equal(rules.points(win)[vorhand], 61);
    assert.equal(rules.winner(win), vorhand);
    const tie = finished(vorhand, sixty, sixty);
    assert.deepEqual(rules.points(tie), { human: 60, computer: 60 });
    assert.notEqual(rules.winner(tie), vorhand);
    for (const state of [win, tie]) {
      const html = game.render(state);
      const expected = rules.winner(state) === "human" ? "Gewonnen!" : "Verloren";
      assert.equal(count(html, "Gewonnen!") + count(html, "Verloren"), 1);
      assert.equal(count(html, expected), 1);
    }
  }
});

test("AC-6: the result names the announcer, and no draw is left in the source", () => {
  for (const vorhand of ["human", "computer"]) {
    const html = game.render(finished(vorhand, sixty, sixty));
    assert.ok(html.includes(`Ansager: ${vorhand === "human" ? "Du" : "Computer"}<`));
    assert.ok(!html.includes("Unentschieden"));
    assert.ok(!html.includes("draw"));
  }
  const files = (dir) => readdirSync(new URL(dir, import.meta.url), { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => dir + f);
  for (const file of [...files("../src/"), "../styles.css"]) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.ok(!text.includes("Unentschieden"), file);
    assert.ok(!/\bdraw\b/.test(text), file);
  }
});

test("AC-7: a full game plays to 16 tricks, and nextGame deals stepwise with the other dealer", () => {
  for (let seed = 0; seed < 20; seed++) {
    let state = rules.newGame(seed, seed % 2 ? "human" : "computer");
    state = step(state);
    while (!rules.isOver(state)) state = step(state);
    assert.equal(state.tricks.length, 16);
    const next = rules.nextGame(state, seed + 1);
    assert.notEqual(next.dealer, state.dealer);
    assert.equal(next.stock.length, 20);
    assert.deepEqual(next.players[next.dealer].stacks.map((s) => s.up), [null, null, null, null, null, null, null, null]);
  }
});
