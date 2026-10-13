import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { save, load } from "../src/core/storage.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import * as game from "../src/games/offiziersskat/index.js";
import { renderGameScreen } from "../src/core/menu-view.js";

const QUESTION = "Neues Spiel starten? Die Spielliste wird gelöscht.";
const scores = [{ human: 70, computer: 50 }, { human: 30, computer: 90 }];
const finished = (state) => (rules.isOver(state) ? state : finished(game.applyMove(state, game.aiMove(state))));

test("AC-1: restart empties the score list and changes the dealer", () => {
  for (const dealer of ["human", "computer"]) {
    const state = game.newGame(4, dealer, scores);
    const next = game.restart(state, 9);
    assert.deepEqual(next.scores, []);
    assert.notEqual(next.dealer, dealer);
    assert.deepEqual(next, game.newGame(9, next.dealer, []));
  }
});

test("AC-2: nextGame keeps the score list", () => {
  const done = finished(game.newGame(5, "human", scores));
  assert.equal(game.nextGame(done, 6).scores.length, done.scores.length);
  assert.deepEqual(game.nextGame(done, 6).scores, done.scores);
});

test("AC-3: confirmNew renders the question panel, and without it there is none", () => {
  const state = game.newGame(5);
  const html = renderGameScreen(game, state, { confirmNew: true });
  assert.ok(html.includes(QUESTION));
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /<button type="button"[^>]*data-action="new-confirm"/);
  assert.match(html, /<button type="button"[^>]*data-action="new-cancel"/);
  const plain = renderGameScreen(game, state);
  for (const part of [QUESTION, "alertdialog", "new-confirm", "new-cancel"]) assert.ok(!plain.includes(part), part);
});

test("AC-4: online mode has no Neues Spiel button and no panel", () => {
  const html = renderGameScreen(game, game.newGame(5), { online: "host", confirmNew: true });
  for (const part of ['data-action="new"', QUESTION, "alertdialog", "new-confirm", "new-cancel"]) assert.ok(!html.includes(part), part);
});

test("AC-5: a reset state saves and restores with an empty score list", () => {
  const items = {};
  const store = { getItem: (k) => items[k] ?? null, setItem: (k, v) => { items[k] = String(v); } };
  save(store, game.id, game.restart(game.newGame(2, "human", scores), 8));
  assert.deepEqual(game.restore(load(store, game.id)).scores, []);
});

test("AC-6: no source file uses window.confirm or a bare confirm call", () => {
  const files = (dir) => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));
  for (const file of files("src")) assert.doesNotMatch(readFileSync(file, "utf8"), /(^|[^\w.-])confirm\(|window\.confirm/, file);
});
