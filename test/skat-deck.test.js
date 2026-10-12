import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { SUITS, RANKS, SUIT_SYMBOLS, createDeck, cardName } from "../src/core/cards.js";
import { cid, renderCard, renderCardBack } from "../src/core/card-view.js";
import { CARD_POINTS, beats } from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import * as game from "../src/games/offiziersskat/index.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const c = (s) => ({ suit: s.split(":")[0], rank: s.split(":")[1] });
const filesIn = (dir) => readdirSync(new URL(`../${dir}/`, import.meta.url), { recursive: true })
  .map((f) => `${dir}/${f}`).filter((f) => f.endsWith(".js"));

test("AC-1: the deck has the Skat suits and ranks, German names, and no old ids", () => {
  assert.deepEqual(SUITS, ["kreuz", "pik", "herz", "karo"]);
  assert.deepEqual(RANKS, ["7", "8", "9", "10", "B", "D", "K", "A"]);
  const deck = createDeck();
  assert.equal(deck.length, 32);
  assert.equal(new Set(deck.map((card) => `${card.suit}:${card.rank}`)).size, 32);
  assert.equal(cardName({ suit: "kreuz", rank: "B" }), "Kreuz Bube");
  assert.equal(cardName({ suit: "karo", rank: "D" }), "Karo Dame");
  assert.equal(new Set(deck.map(cardName)).size, 32);
  // Build the old ids from parts, so that this file does not contain them.
  const oldSuits = new RegExp(["eich" + "el", "gru" + "en", "schel" + "len"].join("|"), "i");
  const oldRanks = /[":](?:U|O)"/;
  for (const file of [...filesIn("src"), ...filesIn("test"), "styles.css", "index.html"]) {
    const text = read(file);
    assert.doesNotMatch(text, oldSuits, file);
    assert.doesNotMatch(text, oldRanks, file);
  }
});

test("AC-2: trump order with Pik as trump, Grand trumps, and card points", () => {
  const order = ["kreuz:B", "pik:B", "herz:B", "karo:B", "pik:A", "pik:10", "pik:K", "pik:D", "pik:9", "pik:8", "pik:7"].map(c);
  for (let i = 0; i < order.length; i++) {
    for (let j = 0; j < order.length; j++) assert.equal(beats(order[i], order[j], "pik"), i < j, `${i} vs ${j}`);
  }
  const deck = createDeck();
  const grandTrumps = deck.filter((card) => rules.isTrump(card, "grand"));
  assert.deepEqual(grandTrumps.map(cardName), ["Kreuz Bube", "Pik Bube", "Herz Bube", "Karo Bube"]);
  assert.equal(CARD_POINTS.B, 2);
  assert.equal(CARD_POINTS.D, 3);
  assert.equal(deck.reduce((sum, card) => sum + CARD_POINTS[card.rank], 0), 120);
});

test("AC-3: cid gives 32 different CardMeister ids", () => {
  assert.equal(new Set(createDeck().map(cid)).size, 32);
  assert.equal(cid({ suit: "kreuz", rank: "B" }), "Jc");
  assert.equal(cid({ suit: "herz", rank: "10" }), "Th");
  assert.equal(cid({ suit: "pik", rank: "D" }), "Qs");
  assert.equal(cid({ suit: "karo", rank: "A" }), "Ad");
});

test("AC-4: with the playing-card element defined, cards use CardMeister", (t) => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, "customElements");
  globalThis.customElements = { get: (name) => (name === "playing-card" ? class {} : undefined) };
  t.after(() => (saved ? Object.defineProperty(globalThis, "customElements", saved) : delete globalThis.customElements));
  for (const card of createDeck()) {
    const html = renderCard(card);
    assert.match(html, new RegExp(`^<div [^>]*role="img" aria-label="${cardName(card)}">` +
      `<playing-card cid="${cid(card)}" letters="ABDK" aria-hidden="true">`));
  }
  // S15: the back stays the CSS back, also with CardMeister.
  assert.equal(renderCardBack(), `<div class="card-back" role="img" aria-label="Verdeckte Karte"></div>`);
});

test("AC-5: without customElements, cards fall back to symbols and the CSS back", () => {
  assert.equal(globalThis.customElements, undefined);
  assert.deepEqual(SUITS.map((s) => SUIT_SYMBOLS[s]), ["♣", "♠", "♥", "♦"]);
  for (const card of createDeck()) {
    const html = renderCard(card);
    assert.ok(!html.includes("<playing-card"));
    assert.ok(html.includes(SUIT_SYMBOLS[card.suit]));
    assert.ok(html.includes(`>${card.rank}<`));
    assert.ok(html.includes(`class="card card--${card.suit}"`));
    assert.ok(html.includes(`aria-label="${cardName(card)}"`));
  }
  assert.equal(renderCardBack(), `<div class="card-back" role="img" aria-label="Verdeckte Karte"></div>`);
  const css = read("styles.css");
  assert.match(css, /\.card--herz,\n\.card--karo \{ color: var\(--red\); \}/);
});

test("AC-6: announce buttons, trump badge, and the AI skips the Buben", () => {
  const html = game.render(game.newGame(2, "computer"));
  const buttons = [...html.matchAll(/<button[^>]*data-announce="([^"]+)"[^>]*>(.*?)<\/button>/g)].map((m) => m[2]);
  assert.deepEqual(buttons, [
    '<span aria-hidden="true">♣</span> Kreuz', '<span aria-hidden="true">♠</span> Pik',
    '<span aria-hidden="true">♥</span> Herz', '<span aria-hidden="true">♦</span> Karo', "Grand",
  ]);
  const herz = game.render(game.applyMove(game.newGame(2, "computer"), { type: "announce", game: "herz" }));
  assert.match(herz, /Trumpf: Herz</);
  const state = rules.newGame(1, "human");
  const ups = ["kreuz:B", "kreuz:7", "karo:7", "karo:8"];
  const stacks = ups.map((up) => ({ down: c("herz:7"), up: c(up) }));
  const withBuben = { ...state, players: { ...state.players, computer: { stacks } } };
  assert.deepEqual(aiMove(withBuben), { type: "announce", game: "karo" });
});

test("AC-7: the vendored CardMeister file, license, README credits, and script order", () => {
  const path = new URL("../vendor/cardmeister/elements.cardmeister.full.js", import.meta.url);
  assert.equal(statSync(path).size, 148770);
  const js = readFileSync(path, "utf8");
  for (const call of ["fetch(", "XMLHttpRequest", "import("]) assert.ok(!js.includes(call), call);
  const license = read("vendor/cardmeister/LICENSE");
  assert.ok(license.includes("Unlicense"));
  assert.ok(license.includes("https://github.com/cardmeister/cardmeister.github.io"));
  const readme = read("README.md");
  for (const text of ["CardMeister", "Unlicense", "https://github.com/cardmeister/cardmeister.github.io"]) assert.ok(readme.includes(text), text);
  const index = read("index.html");
  const vendor = index.indexOf('<script src="vendor/cardmeister/elements.cardmeister.full.js"></script>');
  assert.ok(vendor > -1);
  assert.ok(vendor < index.indexOf('src="src/main.js"'));
});
