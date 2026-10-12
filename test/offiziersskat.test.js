import { test } from "node:test";
import assert from "node:assert/strict";
import { createDeck, cardName } from "../src/core/cards.js";
import { newGame } from "../src/games/offiziersskat/rules.js";
import { render } from "../src/games/offiziersskat/index.js";
import { getGame } from "../src/core/registry.js";
import { renderGameScreen } from "../src/core/menu-view.js";

const allStacks = (state) => [...state.players.human.stacks, ...state.players.computer.stacks];
const key = (card) => `${card.suit}-${card.rank}`;
const count = (html, text) => html.split(text).length - 1;

test("AC-1: newGame deals 8 stacks to each player with all 32 cards once", () => {
  const state = newGame(42);
  assert.equal(state.players.human.stacks.length, 8);
  assert.equal(state.players.computer.stacks.length, 8);
  for (const stack of allStacks(state)) {
    assert.ok(stack.down && stack.up);
  }
  const dealt = allStacks(state).flatMap((s) => [s.down, s.up]).map(key).sort();
  assert.deepEqual(dealt, createDeck().map(key).sort());
});

test("AC-2: the same seed gives the same deal, other seeds give other deals", () => {
  assert.deepEqual(newGame(7), newGame(7));
  assert.notDeepEqual(newGame(1).players, newGame(2).players);
});

test("AC-3: the state is plain JSON", () => {
  const state = newGame(123);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
});

test("AC-4: render shows both rows and all 16 open cards", () => {
  const state = newGame(5);
  const html = render(state);
  assert.ok(html.includes("Computer"));
  assert.ok(html.includes(">Du<"));
  for (const stack of allStacks(state)) {
    assert.ok(html.includes(`aria-label="${cardName(stack.up)}"`), cardName(stack.up));
  }
});

test("AC-5: render shows 16 card backs and hides the down cards", () => {
  const state = newGame(5);
  const html = render(state);
  assert.equal(count(html, 'aria-label="Verdeckte Karte"'), 16);
  for (const stack of allStacks(state)) {
    assert.ok(!html.includes(cardName(stack.down)), cardName(stack.down));
  }
});

test("AC-6: the game screen shows Zurück and 16 open cards, no stub", () => {
  const html = renderGameScreen(getGame("offiziersskat"));
  assert.match(html, /<button[^>]*data-action="back"[^>]*>Zurück<\/button>/);
  assert.equal(count(html, 'class="card card--'), 16);
  assert.ok(!html.includes("Kommt bald"));
});
