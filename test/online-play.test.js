import { test } from "node:test";
import assert from "node:assert/strict";
import { TRICK_PAUSE } from "../src/core/motion.js";
import { SOUNDS } from "../src/core/sound.js";
import { cardName } from "../src/core/cards.js";
import { save } from "../src/core/storage.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import * as game from "../src/games/offiziersskat/index.js";
import { linkPair } from "./link-pair.js";

const KEY = "karten:offiziersskat";
const SEED = 7;
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Each fake Audio writes to the sound log of the browser that runs now.
const NAMES = Object.fromEntries(Object.entries(SOUNDS).map(([event, src]) => [src, event]));
let current = [];
globalThis.Audio = class {
  constructor(src) { this.src = src; }
  play() { current.push(NAMES[this.src]); }
  pause() {}
};

function fakeClock() {
  const timers = new Map();
  let now = 0;
  let id = 0;
  return {
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
    writes: [],
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => (storage.writes.push(k), items.set(k, String(v))),
  };
  return storage;
}

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
    listeners,
    ownerDocument: { body: { append() {} } },
    setAttribute() {},
    addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    querySelector: (selector) => (selector === "#room-code" ? { value: "KREUZ-42", focus() {} } : has(selector) ? fakeElement() : null),
    querySelectorAll: () => [],
    focus() {},
    remove() {},
    replaceChildren() {},
  };
  return element;
}

const { startApp } = await import("../src/main.js");

// One browser. `connect` gives the link of its side.
function browser(link, storage) {
  const clock = fakeClock();
  const app = fakeElement();
  const mute = fakeElement(`<span class="mute-button__icon"></span><span class="mute-button__label"></span>`);
  const document = { title: "", listeners: {}, getElementById: (id) => ({ app, mute })[id] };
  document.addEventListener = (type, fn) => (document.listeners[type] ??= []).push(fn);
  const sounds = [];
  startApp({
    document,
    storage,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    addEventListener() {},
    reducedMotion: true,
    seed: () => SEED,
    connect: async () => link,
  });
  // The first user gesture unlocks the sound.
  for (const fn of document.listeners.click) fn();
  const click = async (attr) => {
    const tag = app.innerHTML.match(new RegExp(`<button[^>]*${attr}[^>]*>`))?.[0];
    assert.ok(tag, `no button with ${attr}`);
    const dataset = Object.fromEntries([...tag.matchAll(/data-([\w-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name.replace(/-(\w)/g, (_, c) => c.toUpperCase()), value]));
    current = sounds;
    for (const fn of app.listeners.click) fn({ target: { closest: () => ({ dataset }) }, preventDefault() {} });
    await settle();
  };
  const html = () => app.innerHTML;
  return { clock, app, storage, sounds, click, html, link };
}

// Two connected browsers. The link holds each message until flush(), so each browser runs alone.
async function connectPair({ hostStorage = memoryStorage(), guestStorage = memoryStorage() } = {}) {
  const queue = [];
  const wrap = (link, to) => ({
    ...link,
    closed: 0,
    send: (data) => queue.push({ to, run: () => link.send(data) }),
    close() { this.closed++; link.close(); },
  });
  const [a, b] = linkPair();
  const sides = {};
  const hostLink = wrap(a, "guest");
  const guestLink = wrap(b, "host");
  const g = sides.guest = browser(guestLink, guestStorage);
  const h = sides.host = browser(hostLink, hostStorage);
  const flush = async () => {
    while (queue.length) {
      const { to, run } = queue.shift();
      current = sides[to].sounds;
      run();
      await settle();
    }
  };
  for (const t of [g, h]) if (t.html().includes('class="game-screen"')) await t.click('data-action="back"');
  // The resume of a saved single-player game writes its save again. Only the online writes count.
  for (const t of [g, h]) t.storage.writes.length = 0;
  await g.click('data-online="offiziersskat"');
  await g.click('data-action="join"');
  await g.click('data-action="join-code"');
  await h.click('data-online="offiziersskat"');
  await h.click('data-action="host"');
  await flush();
  return { h, g, flush, queue, hostLink, guestLink, state: rules.newGame(SEED, "human") };
}

const labels = (html) => [...html.matchAll(/class="row__label">([^<]*)</g)].map((m) => m[1]);
const row = (html, player) => html.split(`data-player="${player}">`)[1].split("</ul>")[0];
const has = (html, card) => html.includes(`aria-label="${cardName(card)}"`);
const stacks = (html) => [...html.matchAll(/data-stack="(\d)"/g)].map((m) => Number(m[1]));
const seatOf = (s) => (s.trump === null ? s.vorhand : s.turn);

// The browser in turn plays its first clickable stack. Returns the new host state.
async function playOne(ctx) {
  const t = seatOf(ctx.state) === "human" ? ctx.h : ctx.g;
  const [stack] = stacks(t.html());
  await t.click(`data-stack="${stack}"`);
  await ctx.flush();
  return (ctx.state = rules.applyMove(ctx.state, { type: "play", stack }));
}

async function announce(ctx, trump = "herz") {
  const t = ctx.state.vorhand === "human" ? ctx.h : ctx.g;
  await t.click(`data-announce="${trump}"`);
  await ctx.flush();
  ctx.state = rules.applyMove(ctx.state, { type: "announce", game: trump });
}

async function playGame(ctx) {
  while (!rules.isOver(ctx.state)) await playOne(ctx);
}

test("AC-1: both browsers show the game, with a Du row and a Mitspieler row, and the host deals", async () => {
  const { h, g, state } = await connectPair();
  assert.equal(state.dealer, "human");
  for (const t of [h, g]) {
    assert.match(t.html(), /class="game-screen"/);
    assert.deepEqual(labels(t.html()).sort(), ["Du", "Mitspieler"]);
  }
  const ups = state.players.computer.stacks.map((s) => s.up).filter(Boolean);
  assert.equal(ups.length, 4);
  for (const card of ups) assert.ok(has(row(g.html(), "human"), card), cardName(card));
  for (const card of ups) assert.ok(!has(row(h.html(), "human"), card));
  // The guest never sees a face-down card or a stock card.
  const hidden = [...Object.values(state.players).flatMap((p) => p.stacks.map((s) => s.down)), ...state.stock].filter(Boolean);
  for (const card of hidden) assert.ok(!has(g.html(), card), cardName(card));
});

test("AC-2: only the Vorhand browser announces, and both browsers show the same trump", async () => {
  const ctx = await connectPair();
  const { h, g } = ctx;
  assert.match(g.html(), /data-announce=/);
  assert.match(g.html(), /Vorhand: Du/);
  assert.doesNotMatch(h.html(), /data-announce=/);
  assert.match(h.html(), /Vorhand: Mitspieler/);
  await announce(ctx, "pik");
  for (const t of [h, g]) {
    assert.match(t.html(), /class="trump-badge trump-badge--pik"/);
    assert.doesNotMatch(t.html(), /data-announce=/);
  }
});

test("AC-3: only the browser in turn can click, a click plays in both browsers, and no AI moves", async () => {
  const ctx = await connectPair();
  await announce(ctx);
  for (let i = 0; i < 5; i++) {
    const own = seatOf(ctx.state) === "human" ? ctx.h : ctx.g;
    const other = own === ctx.h ? ctx.g : ctx.h;
    const legal = rules.legalStacksFor(ctx.state);
    assert.deepEqual(stacks(own.html()), legal);
    assert.deepEqual(stacks(other.html()), []);
    assert.match(own.html(), /role="status" tabindex="-1">Du bist dran</);
    assert.match(other.html(), /role="status" tabindex="-1">Mitspieler ist dran</);
    const card = ctx.state.players[seatOf(ctx.state)].stacks[legal[0]].up;
    await playOne(ctx);
    for (const t of [own, other]) assert.ok(has(t.html().split('class="trick"')[1], card), cardName(card));
  }
  const before = [ctx.h.html(), ctx.g.html()];
  await ctx.h.clock.tick(10000);
  await ctx.g.clock.tick(10000);
  await ctx.flush();
  assert.deepEqual([ctx.h.html(), ctx.g.html()], before);
});

test("AC-4: both browsers play deal and play sounds, and each runs the trick motion", async () => {
  const ctx = await connectPair();
  assert.deepEqual(ctx.h.sounds, ["deal"]);
  assert.deepEqual(ctx.g.sounds, ["deal"]);
  await announce(ctx);
  assert.deepEqual(ctx.h.sounds, ["deal", "deal"]);
  assert.deepEqual(ctx.g.sounds, ["deal", "deal"]);
  await playOne(ctx);
  await playOne(ctx);
  for (const t of [ctx.h, ctx.g]) {
    assert.deepEqual(t.sounds, ["deal", "deal", "play", "play"]);
    // The trick event of motionEvents reached motion.run: the trick waits on the table.
    assert.equal(t.clock.pending(TRICK_PAUSE), 1);
  }
});

test("AC-5: after 16 tricks each browser shows its own result and plays its own sound", async () => {
  const ctx = await connectPair();
  await announce(ctx);
  await playGame(ctx);
  const points = rules.points(ctx.state);
  const hostWins = rules.winner(ctx.state) === "human";
  const [win, lose] = hostWins ? [ctx.h, ctx.g] : [ctx.g, ctx.h];
  assert.match(win.html(), />Gewonnen!</);
  assert.match(lose.html(), />Verloren</);
  assert.ok(ctx.h.html().includes(`Du ${points.human} Punkte, Mitspieler ${points.computer} Punkte`));
  assert.ok(ctx.g.html().includes(`Du ${points.computer} Punkte, Mitspieler ${points.human} Punkte`));
  assert.equal(win.sounds.at(-1), "win");
  assert.equal(lose.sounds.at(-1), "lose");
  for (const t of [ctx.h, ctx.g]) assert.equal(t.sounds.filter((s) => s === "play").length, 32);
});

test("AC-6: only the host starts the next game with the other dealer, and both show the score list", async () => {
  const ctx = await connectPair();
  await announce(ctx);
  await playGame(ctx);
  const { human: a, computer: b } = rules.points(ctx.state);
  assert.match(ctx.h.html(), /data-action="next"/);
  assert.doesNotMatch(ctx.g.html(), /data-action="next"/);
  assert.match(ctx.g.html(), /Warte auf den Gastgeber …/);
  assert.deepEqual(ctx.h.html().match(/<ol class="result__scores"[^>]*>(.*?)<\/ol>/)[1], `<li>Du ${a} : ${b} Mitspieler</li>`);
  assert.deepEqual(ctx.g.html().match(/<ol class="result__scores"[^>]*>(.*?)<\/ol>/)[1], `<li>Du ${b} : ${a} Mitspieler</li>`);
  // Guest messages other than a move change nothing.
  const before = ctx.h.html();
  for (const message of [{ type: "next" }, { type: "state", view: {} }, { type: "new" }, null, "next"]) ctx.guestLink.send(message);
  await ctx.flush();
  assert.equal(ctx.h.html(), before);
  assert.equal(ctx.queue.length, 0);
  await ctx.h.click('data-action="next"');
  await ctx.flush();
  for (const t of [ctx.h, ctx.g]) assert.doesNotMatch(t.html(), /class="result"/);
  assert.match(ctx.h.html(), /Vorhand: Du/);
  assert.match(ctx.h.html(), /data-announce=/);
  assert.match(ctx.g.html(), /Vorhand: Mitspieler/);
  assert.doesNotMatch(ctx.g.html(), /data-announce=/);
  // The score list goes on in game 2 and shows again in both browsers at its end.
  ctx.state = rules.nextGame(ctx.state, SEED);
  await announce(ctx);
  await playGame(ctx);
  const second = rules.points(ctx.state);
  assert.ok(ctx.h.html().includes(`<li>Du ${second.human} : ${second.computer} Mitspieler</li><li>Du ${a} : ${b} Mitspieler</li>`));
  assert.ok(ctx.g.html().includes(`<li>Du ${second.computer} : ${second.human} Mitspieler</li><li>Du ${b} : ${a} Mitspieler</li>`));
});

test("AC-7: an online game saves nothing, and the single-player game resumes after Zurück", async () => {
  let single = rules.applyMove(game.newGame(5), { type: "announce", game: "kreuz" });
  if (single.turn === "human") single = rules.applyMove(single, { type: "play", stack: rules.legalStacksFor(single)[0] });
  const hostStorage = memoryStorage();
  const guestStorage = memoryStorage();
  save(hostStorage, "offiziersskat", single);
  save(guestStorage, "offiziersskat", single);
  const saved = hostStorage.getItem(KEY);
  const ctx = await connectPair({ hostStorage, guestStorage });
  await announce(ctx);
  await playGame(ctx);
  for (const storage of [hostStorage, guestStorage]) {
    assert.ok(!storage.writes.includes(KEY));
    assert.equal(storage.getItem(KEY), saved);
  }
  await ctx.h.click('data-action="back"');
  await ctx.h.click('data-game-id="offiziersskat"');
  assert.match(ctx.h.html(), /class="row__label">Computer</);
  assert.match(ctx.h.html(), /data-action="new"/);
  assert.equal(JSON.parse(hostStorage.getItem(KEY)).data.trump, "kreuz");
  assert.deepEqual(JSON.parse(hostStorage.getItem(KEY)).data, single);
});

test("AC-8: the online game screen has only Zurück, and Zurück closes the link and shows the menu", async () => {
  const ctx = await connectPair();
  for (const t of [ctx.h, ctx.g]) {
    assert.match(t.html(), /data-action="back"/);
    assert.doesNotMatch(t.html(), /data-action="new"/);
    assert.doesNotMatch(t.html(), /data-action="rules"/);
  }
  await ctx.g.click('data-action="back"');
  assert.equal(ctx.guestLink.closed, 1);
  assert.match(ctx.g.html(), /<h1>Karten<\/h1>/);
  await ctx.h.click('data-action="back"');
  assert.equal(ctx.hostLink.closed, 1);
  assert.match(ctx.h.html(), /<h1>Karten<\/h1>/);
});
