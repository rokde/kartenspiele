import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUITS, RANKS, SUIT_SYMBOLS, createDeck, shuffle, cardName } from "../src/core/cards.js";
import { renderCard, renderDeck } from "../src/core/card-view.js";

const key = (c) => `${c.suit}:${c.rank}`;

test("AC-1: createDeck returns 32 unique suit/rank cards as plain JSON", () => {
  const deck = createDeck();
  assert.equal(deck.length, 32);
  const keys = new Set(deck.map(key));
  for (const suit of SUITS) for (const rank of RANKS) assert.ok(keys.has(`${suit}:${rank}`));
  assert.equal(keys.size, 32);
  assert.deepEqual(JSON.parse(JSON.stringify(deck)), deck);
});

test("AC-2: shuffle with the same seed is stable, keeps the cards, and does not change the input", () => {
  const deck = createDeck();
  const copy = structuredClone(deck);
  const a = shuffle(deck, 42);
  assert.deepEqual(shuffle(deck, 42), a);
  assert.deepEqual(a.map(key).sort(), deck.map(key).sort());
  assert.deepEqual(deck, copy);
});

test("AC-3: different seeds give different orders, not the deck order", () => {
  const deck = createDeck();
  const one = shuffle(deck, 1).map(key);
  const two = shuffle(deck, 2).map(key);
  assert.notDeepEqual(one, two);
  assert.notDeepEqual(one, deck.map(key));
  assert.notDeepEqual(two, deck.map(key));
});

test("AC-4: cardName gives German names, 32 different", () => {
  assert.equal(cardName({ suit: "kreuz", rank: "A" }), "Kreuz Ass");
  assert.equal(cardName({ suit: "pik", rank: "10" }), "Pik Zehn");
  assert.equal(new Set(createDeck().map(cardName)).size, 32);
});

test("AC-5: SUIT_SYMBOLS and renderCard", () => {
  const symbols = SUITS.map((s) => SUIT_SYMBOLS[s]);
  assert.ok(symbols.every((s) => typeof s === "string" && s.length > 0));
  assert.equal(new Set(symbols).size, 4);
  for (const card of createDeck()) {
    const html = renderCard(card);
    assert.ok(html.includes(SUIT_SYMBOLS[card.suit]));
    assert.ok(html.includes(`>${card.rank}<`));
    assert.ok(html.includes(`card--${card.suit}`));
    assert.ok(html.includes(`aria-label="${cardName(card)}"`));
  }
});

test("AC-6: renderDeck renders 32 card elements", () => {
  const html = renderDeck(createDeck());
  assert.equal(html.match(/class="card card--/g).length, 32);
});

test("AC-7: index.html links styles.css", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<link rel="stylesheet" href="(\.?\/)?styles\.css">/);
});

test("AC-8: src/main.js imports in Node without a DOM", async () => {
  const main = await import("../src/main.js");
  assert.equal(main.APP_TITLE, "Karten");
});
