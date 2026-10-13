import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../src/games/offiziersskat/rules.js";
import * as game from "../src/games/offiziersskat/index.js";
import { guestView } from "../src/games/offiziersskat/online.js";

// The layout itself is checked in a browser (see build.md). These tests keep the CSS rules that make it.
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("styles.css");
const block = (query) => {
  const start = css.indexOf(`@media ${query} {`);
  assert.notEqual(start, -1, query);
  return css.slice(start, css.indexOf("\n}\n", start));
};
const wide = block("(width >= 48rem)");
const phone = block("(width < 48rem)");
const fitConstant = Number(wide.match(/--fit-w: max\(3\.5rem, \(100vh - ([\d.]+)rem\) \/ 3\.6\);/)[1]);
const fitWidth = (height) => (height - fitConstant * 16) / 3.6;

test("AC-1: one breakpoint at 48rem, the card width comes from dvh with a vh fallback", () => {
  assert.doesNotMatch(css, /max-width: 30rem/);
  assert.match(wide, /@supports \(height: 100dvh\) \{\s*\.table \{\s*--fit-w: max\(3\.5rem, \(100dvh - [\d.]+rem\) \/ 3\.6\);/);
  assert.match(wide, /main \{\s*padding-bottom: 1rem;/);
  assert.match(css, /\.row \{[^}]*grid-template-columns: repeat\(var\(--cols\), minmax\(0, var\(--w\)\)\);/);
});

test("AC-2: wide rows have 8 columns, about 5.5rem to 6.5rem wide at 1280x800", () => {
  assert.match(wide, /\.row,\s*\.row__head,\s*\.row\[data-player="computer"\],\s*\.row__head:has\(\+ \.row\[data-player="computer"\]\) \{\s*--cols: 8;\s*--w: var\(--fit-w\);/);
  assert.ok(fitWidth(800) >= 88 && fitWidth(800) <= 104, String(fitWidth(800)));
  assert.ok(fitWidth(768) >= 80, String(fitWidth(768)));
});

test("AC-3: on a phone, the opponent row is one line of 8, the own row is 2 lines of 4 big cards", () => {
  assert.match(css, /\.row,\s*\.row__head \{\s*--cols: 4;\s*--w: 5rem;/);
  const [, w] = css.match(/\.row\[data-player="computer"\],\s*\.row__head:has\(\+ \.row\[data-player="computer"\]\) \{\s*--cols: 8;\s*--w: ([\d.]+)rem;/);
  assert.ok(Number(w) * 16 >= 38);
  assert.match(css, /\.row\[data-player="computer"\] \{\s*grid-template-columns: repeat\(7, minmax\(0, var\(--w\)\)\) var\(--w\);/);
  assert.match(css, /\.row\[data-player="computer"\] \.stack \{\s*width: var\(--w\);/);
});

test("AC-4: on a phone, main keeps room for the fixed mute button", () => {
  const [, bottom] = phone.match(/main \{\s*padding: 0\.5rem 0\.5rem ([\d.]+)rem;/);
  // The mute button: 0.75rem from the bottom, 2.75rem high.
  assert.ok(Number(bottom) >= 3.5);
});

test("AC-5: the trick reserves only one trick card, its label and the caption", () => {
  assert.match(css, /\.trick \{[^}]*min-height: calc\(var\(--trick-w\) \* 334 \/ 240 \+ 3rem\);/);
  assert.match(css, /\.trick \+ \.row__head \{\s*margin-top: calc\(-1\.6rem \* 334 \/ 240\);/);
  assert.match(css, /\.trick__card \{[^}]*width: var\(--trick-w\);/);
});

test("AC-6: on a phone, the scroll to the own row stops above the mute button", () => {
  assert.match(phone, /\.row \{\s*scroll-margin-bottom: 4rem;/);
});

test("AC-7: legal own stacks are buttons, others fade, focus shows the gold outline, the scroll is nearest", () => {
  const html = game.render(game.applyMove(game.newGame(3, "computer"), { type: "announce", game: "grand" }));
  const legal = rules.legalStacksFor(game.applyMove(game.newGame(3, "computer"), { type: "announce", game: "grand" }));
  assert.equal([...html.matchAll(/<button type="button" class="stack__play" data-stack="(\d)"/g)].length, legal.length);
  assert.match(css, /\.row--playing \.stack:not\(:has\(\.stack__play\)\) \{\s*opacity: 0\.5;/);
  assert.match(css, /\.stack__play:focus-visible \{\s*outline: 3px solid var\(--gold\);/);
  assert.match(read("src/main.js"), /scrollIntoView\(\{ block: "nearest"/);
});

test("AC-8: the online guest view gives the same rows as single player", () => {
  const rows = (html) => [...html.matchAll(/<ul class="(row[^"]*)" data-player="(\w+)">/g)].map((m) => `${m[1]} ${m[2]}`);
  const single = game.applyMove(game.newGame(5, "computer"), { type: "announce", game: "herz" });
  const host = rules.applyMove(rules.newGame(5, "human"), { type: "announce", game: "herz" });
  const expected = ["row computer", "row row--playing human"];
  assert.deepEqual(rows(game.render(single)), expected);
  assert.deepEqual(rows(game.render(guestView(host), { online: "guest" })), expected);
});
