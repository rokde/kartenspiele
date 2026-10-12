import { test } from "node:test";
import assert from "node:assert/strict";
import { listGames, getGame } from "../src/core/registry.js";
import { renderMenu, renderGameScreen, renderRules } from "../src/core/menu-view.js";

const game = getGame("offiziersskat");
const count = (html, re) => [...html.matchAll(re)].length;

test("AC-1: Offiziersskat exports a German rules text with one h1 and h2 sections", () => {
  assert.equal(typeof game.rulesHtml, "string");
  assert.equal(count(game.rulesHtml, /<h1[\s>]/g), 1);
  assert.ok(count(game.rulesHtml, /<h2[\s>]/g) >= 1);
  for (const word of ["32", "Kreuz", "Pik", "Herz", "Karo", "Vorhand", "Grand", "Bube", "61", "60", "120"]) {
    assert.ok(game.rulesHtml.includes(word), word);
  }
});

test("AC-2: renderRules shows the rules, a Zurück button, and the Wikipedia source link", () => {
  const html = renderRules(game);
  assert.ok(html.includes(game.rulesHtml));
  assert.match(html, /<button[^>]*data-action="back"[^>]*>Zurück<\/button>/);
  const a = html.match(/<a [^>]*href="https:\/\/de\.wikipedia\.org\/wiki\/Offiziersskat"[^>]*>/)[0];
  assert.match(a, /target="_blank"/);
  assert.match(a, /rel="[^"]*noopener[^"]*"/);
});

test("AC-3: renderGameScreen has a Regeln button", () => {
  assert.match(renderGameScreen(game, game.newGame(5)), /<button[^>]*data-action="rules"[^>]*>Regeln<\/button>/);
});

test("AC-4: renderMenu has one Regeln button for each game with rules, and no extra game button", () => {
  const html = renderMenu(listGames());
  assert.match(html, /<button[^>]*data-rules="offiziersskat"[^>]*>Regeln<\/button>/);
  assert.equal(count(html, /data-rules=/g), listGames().filter((g) => g.rulesHtml).length);
  assert.equal(count(html, /data-game-id=/g), listGames().length);
});
