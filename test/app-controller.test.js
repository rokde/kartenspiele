import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMotion, TRICK_PAUSE } from "../src/core/motion.js";
import { save } from "../src/core/storage.js";
import * as game from "../src/games/offiziersskat/index.js";
import * as rules from "../src/games/offiziersskat/rules.js";

const KEY = "karten:offiziersskat";
// startApp preloads the sounds. A test can replace this fake.
globalThis.Audio ??= class { play() {} pause() {} };
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Fake timers with a fake clock: tick(ms) calls each timer that is due, in time order.
function fakeClock() {
  const timers = new Map();
  let now = 0;
  let id = 0;
  return {
    timers,
    setTimeout: (fn, ms) => (timers.set(++id, { fn, ms, at: now + ms }), id),
    clearTimeout: (n) => timers.delete(n),
    pending: (ms) => [...timers.values()].filter((t) => t.ms === ms).length,
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const [next] = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at);
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
        await settle();
      }
      now = end;
    },
  };
}

function memoryStorage() {
  const items = new Map();
  const storage = {
    writes: 0,
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => (storage.writes++, items.set(k, String(v))),
  };
  return storage;
}

const stateIn = (storage) => JSON.parse(storage.getItem(KEY))?.data ?? null;

// A small fake element: it finds a selector only as a class, attribute, or tag text in its innerHTML.
function fakeElement(html = "") {
  const listeners = {};
  const has = (selector) => selector.split(",").some((part) => {
    const last = part.trim().split(" ").at(-1);
    const attr = last.match(/^\[([\w-]+)(?:=(\w+))?\]$/);
    if (attr) return element.innerHTML.includes(attr[2] ? `${attr[1]}="${attr[2]}"` : `${attr[1]}=`);
    if (last.startsWith(".")) return new RegExp(`class="([^"]* )?${last.slice(1)}[ "]`).test(element.innerHTML);
    return element.innerHTML.includes(`<${last}`);
  });
  const element = {
    innerHTML: html,
    textContent: "",
    attributes: {},
    listeners,
    ownerDocument: { body: { append() {} } },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    querySelector: (selector) => (has(selector) ? fakeElement() : null),
    querySelectorAll: () => [],
    focus() {},
    remove() {},
    replaceChildren() {},
  };
  return element;
}

function setup({ storage = memoryStorage() } = {}) {
  const clock = fakeClock();
  const app = fakeElement();
  const mute = fakeElement(`<span class="mute-button__icon"></span><span class="mute-button__label"></span>`);
  const document = { title: "", listeners: {}, getElementById: (id) => ({ app, mute })[id] };
  document.addEventListener = (type, fn) => (document.listeners[type] ??= []).push(fn);
  const windowListeners = {};
  // The fake own row logs each scroll.
  const scrolls = [];
  const query = app.querySelector;
  app.querySelector = (selector) => (selector === ".row--playing" ? { scrollIntoView: (options) => scrolls.push(options) } : query(selector));
  startApp({
    document,
    storage,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    addEventListener: (type, fn) => (windowListeners[type] ??= []).push(fn),
    reducedMotion: true,
    seed: () => 7,
  });
  // A click on the first button in the app that has this attribute text, for example `data-action="rules"`.
  const click = async (attr) => {
    const tag = app.innerHTML.match(new RegExp(`<button[^>]*${attr.replace(/[[\]]/g, "\\$&")}[^>]*>`))?.[0];
    assert.ok(tag, `no button with ${attr}`);
    const dataset = Object.fromEntries([...tag.matchAll(/data-([\w-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name.replace(/-(\w)/g, (_, c) => c.toUpperCase()), value]));
    for (const fn of app.listeners.click) fn({ target: { closest: () => ({ dataset }) } });
    await settle();
  };
  return { clock, app, document, storage, click, windowListeners, scrolls };
}

const { startApp, APP_TITLE } = await import("../src/main.js");

// A new game, then the human announces and plays a card. Now the computer waits 800 ms.
async function computerPause(t) {
  await t.click('data-game-id="offiziersskat"');
  await t.click("data-announce=");
  await t.click("data-stack=");
  assert.equal(stateIn(t.storage).turn, "computer");
  assert.equal(t.clock.pending(800), 1);
}

test("AC-1: main.js in Node starts nothing and exports startApp and APP_TITLE", async () => {
  const main = await import("../src/main.js");
  assert.equal(typeof main.startApp, "function");
  assert.equal(main.APP_TITLE, "Karten");
});

test("AC-2: startApp shows the menu, and a game click deals and saves a new game", async () => {
  const t = setup();
  assert.equal(t.document.title, APP_TITLE);
  assert.match(t.app.innerHTML, /<h1>Karten<\/h1>/);
  assert.match(t.app.innerHTML, /data-game-id="offiziersskat"/);
  assert.equal(stateIn(t.storage), null);
  await t.click('data-game-id="offiziersskat"');
  assert.match(t.app.innerHTML, /class="game-screen"/);
  assert.deepEqual(stateIn(t.storage), game.newGame(7));
});

test("AC-3: Regeln during the computer pause stops the computer, and Zurück lets it play after 800 ms", async () => {
  const t = setup();
  await computerPause(t);
  const before = stateIn(t.storage);
  await t.click('data-action="rules"');
  assert.equal(t.clock.pending(800), 0);
  await t.clock.tick(5000);
  assert.deepEqual(stateIn(t.storage), before);
  await t.click('data-action="back"');
  assert.match(t.app.innerHTML, /class="game-screen"/);
  await t.clock.tick(799);
  assert.deepEqual(stateIn(t.storage), before);
  await t.clock.tick(1);
  assert.equal(stateIn(t.storage).tricks.length, 1);
});

test("AC-4: Zurück to the menu during the computer pause applies and saves nothing", async () => {
  const t = setup();
  await computerPause(t);
  const before = stateIn(t.storage);
  await t.click('data-action="back"');
  assert.match(t.app.innerHTML, /<h1>Karten<\/h1>/);
  const writes = t.storage.writes;
  await t.clock.tick(5000);
  assert.equal(t.storage.writes, writes);
  assert.deepEqual(stateIn(t.storage), before);
});

// The computer finishes the first trick. Now the trick waits 2.5 s on the table.
async function finishedTrick(t) {
  await computerPause(t);
  await t.clock.tick(800);
  assert.equal(stateIn(t.storage).tricks.length, 1);
  assert.equal(t.clock.pending(TRICK_PAUSE), 1);
  assert.match(t.app.innerHTML, /class="trick__winner"/);
}

test("AC-5: Regeln during the trick pause keeps the trick on the table", async () => {
  const t = setup();
  await finishedTrick(t);
  await t.click('data-action="rules"');
  assert.equal(t.clock.timers.size, 0);
  await t.clock.tick(TRICK_PAUSE);
  await t.click('data-action="back"');
  assert.match(t.app.innerHTML, /class="trick__winner"/);
  const [trick] = stateIn(t.storage).tricks;
  assert.equal(trick.cards.length, 2);
  for (const { card } of trick.cards) assert.match(t.app.innerHTML, new RegExp(`class="trick__card"><span[^>]*>[^<]*</span><div class="card card--${card.suit}"`));
});

test("AC-5: Zurück to the menu during the trick pause leaves no sweep timer", async () => {
  const t = setup();
  await finishedTrick(t);
  await t.click('data-action="back"');
  assert.equal(t.clock.timers.size, 0);
  const writes = t.storage.writes;
  await t.clock.tick(TRICK_PAUSE);
  assert.equal(t.storage.writes, writes);
});

test("AC-5: a storage event from another tab during the trick pause leaves no timer", async () => {
  const t = setup();
  await finishedTrick(t);
  for (const fn of t.windowListeners.storage) fn({ key: KEY });
  assert.match(t.app.innerHTML, /anderen Tab/);
  assert.equal(t.clock.timers.size, 0);
});

test("AC-6: cancel() clears the sweep timer, and the next play lifts no trick", () => {
  const cleared = [];
  let id = 0;
  const motion = createMotion({ reduced: true, setTimeout: () => ++id, clearTimeout: (n) => cleared.push(n) });
  const log = [];
  const view = { render: () => log.push("render"), card: () => null, lift: () => (log.push("lift"), []), drop() {}, pile: () => null };
  motion.run([{ type: "play", player: "computer", card: { suit: "herz", rank: "A" } }, { type: "trick", winner: "human" }], view);
  motion.cancel();
  assert.ok(cleared.includes(1));
  motion.run([{ type: "play", player: "human", card: { suit: "pik", rank: "7" } }], view);
  assert.deepEqual(log, ["render", "render"]);
});

test("AC-7: renderDeck and the .deck rule are gone", async () => {
  const view = await import("../src/core/card-view.js");
  assert.equal("renderDeck" in view, false);
  assert.doesNotMatch(readFileSync(new URL("../styles.css", import.meta.url), "utf8"), /(^|\s|,)\.deck\b/m);
});

test("the resume and the return to a saved game play no sound and no motion", async (context) => {
  const played = [];
  const savedAudio = globalThis.Audio;
  globalThis.Audio = class { constructor(src) { this.src = src; } play() { played.push(this.src); } };
  context.after(() => (globalThis.Audio = savedAudio));
  // A saved game just after the first trick, with the trick still on the table.
  let state = rules.applyMove(game.newGame(7), { type: "announce", game: "grand" });
  state = rules.applyMove(state, { type: "play", stack: rules.legalStacksFor(state)[0] });
  state = rules.applyMove(state, { type: "play", stack: rules.legalStacksFor(state)[0] });
  const storage = memoryStorage();
  save(storage, "offiziersskat", state);
  const t = setup({ storage });
  assert.match(t.app.innerHTML, /class="game-screen"/);
  assert.equal(t.clock.pending(TRICK_PAUSE), 0);
  for (const fn of t.document.listeners.click) fn();
  await t.click('data-action="back"');
  await t.click('data-game-id="offiziersskat"');
  await t.click('data-action="rules"');
  await t.click('data-action="back"');
  assert.deepEqual(played, []);
  assert.equal(t.clock.pending(TRICK_PAUSE), 0);
  // A control: a played card makes a sound.
  if (stateIn(storage).turn === "computer") await t.clock.tick(800);
  else await t.click("data-stack=");
  assert.ok(played.length > 0);
});

test("S20 AC-6: a new run and leaving the game screen pause the sound and leave no sound timer", async (context) => {
  const log = [];
  const savedAudio = globalThis.Audio;
  globalThis.Audio = class {
    constructor(src) { this.src = src; }
    play() { log.push(["play", this.src]); }
    pause() { log.push(["pause", this.src]); }
  };
  context.after(() => (globalThis.Audio = savedAudio));
  const t = setup();
  for (const fn of t.document.listeners.click) fn();
  const deal = "assets/sounds/shuffle.mp3";
  // With reduced motion, the deal sound stops after DURATIONS.deal.
  await t.click('data-game-id="offiziersskat"');
  assert.deepEqual(log, [["play", deal]]);
  assert.equal(t.clock.pending(300), 1);
  await t.click('data-action="new"');
  assert.deepEqual(log, [["play", deal], ["pause", deal], ["play", deal]]);
  assert.equal(t.clock.pending(300), 1);
  await t.click('data-action="back"');
  assert.deepEqual(log.at(-1), ["pause", deal]);
  assert.equal(t.clock.timers.size, 0);
});

test("S21: the own row scrolls into view only when the turn of the player starts", async () => {
  const t = setup();
  await t.click('data-game-id="offiziersskat"');
  assert.equal(t.scrolls.length, 0);
  await t.click("data-announce=");
  assert.deepEqual(t.scrolls, [{ block: "nearest", behavior: "auto" }]);
  await t.click('data-action="rules"');
  await t.click('data-action="back"');
  assert.equal(t.scrolls.length, 2, "the return from the rules page shows the row again");
  await t.click("data-stack=");
  assert.equal(t.scrolls.length, 2);
  while (stateIn(t.storage).turn === "computer") await t.clock.tick(800);
  assert.equal(t.scrolls.length, 3);
});
