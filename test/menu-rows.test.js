import { test } from "node:test";
import assert from "node:assert/strict";
import { listGames } from "../src/core/registry.js";
import { renderMenu } from "../src/core/menu-view.js";

const rowsOf = (html) => [...html.matchAll(/<div class="menu__row" role="group" aria-label="([^"]*)">(.*?)<\/div>/g)];
const buttonsOf = (row) => [...row.matchAll(/<button[^>]*?(data-(?:game-id|online|rules)="([^"]*)")[^>]*>([^<]*)<\/button>/g)]
  .map((m) => [m[1].split("=")[0], m[2], m[3]]);

test("AC-1: one row per game in registry order, each a labelled group", () => {
  const rows = rowsOf(renderMenu(listGames()));
  assert.deepEqual(rows.map((r) => r[1]), listGames().map((g) => g.name));
  assert.deepEqual(rows.map((r) => r[1]).slice(0, 2), ["Offiziersskat", "Skat"]);
});

test("AC-2: buttons in a row are game, online, rules", () => {
  const [a, b] = rowsOf(renderMenu(listGames()));
  assert.deepEqual(buttonsOf(a[2]), [["data-game-id", "offiziersskat", "Offiziersskat"],
    ["data-online", "offiziersskat", "Zu zweit spielen"], ["data-rules", "offiziersskat", "Regeln"]]);
  assert.deepEqual(buttonsOf(b[2]), [["data-game-id", "skat", "Skat"],
    ["data-online", "skat", "Online spielen"], ["data-rules", "skat", "Regeln"]]);
});

test("AC-3: a row holds only buttons of its own game", () => {
  const games = listGames();
  rowsOf(renderMenu(games)).forEach((r, i) => {
    for (const [, id] of buttonsOf(r[2])) assert.equal(id, games[i].id);
  });
});

test("AC-4: rules button text is Regeln, label and title carry the game name", () => {
  for (const [, name, inner] of rowsOf(renderMenu(listGames()))) {
    assert.match(inner, new RegExp(`data-rules="[^"]*" aria-label="Regeln ${name}" title="Regeln ${name}">Regeln</button>`));
  }
});

test("AC-5: one Credits button after the last row, no rules button in menu-extra", () => {
  const html = renderMenu(listGames());
  assert.equal(html.match(/data-action="credits"/g).length, 1);
  assert.ok(html.indexOf("data-action=\"credits\"") > html.lastIndexOf("menu__row"));
  assert.doesNotMatch(html.slice(html.indexOf("menu-extra")), /data-rules/);
});

test("AC-6: extra games get a row with only the buttons they support", () => {
  const html = renderMenu([...listGames(),
    { id: "x", name: "Xeno" }, { id: "y", name: "Yarn", rulesHtml: "<p>r</p>" }]);
  const rows = rowsOf(html);
  assert.equal(rows.length, 4);
  assert.deepEqual(buttonsOf(rows[2][2]), [["data-game-id", "x", "Xeno"]]);
  assert.deepEqual(buttonsOf(rows[3][2]), [["data-game-id", "y", "Yarn"], ["data-rules", "y", "Regeln"]]);
});
