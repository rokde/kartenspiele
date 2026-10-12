import { test } from "node:test";
import assert from "node:assert/strict";
import { createSound, timeSounds, SOUNDS } from "../src/core/sound.js";
import { createMotion, DURATIONS, DEAL_STEP, DEAL_STAGGER } from "../src/core/motion.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";

// Fake timers with a clock: tick(ms) calls each due timer in time order.
function fakeClock() {
  const timers = new Map();
  let now = 0;
  let id = 0;
  return {
    timers,
    now: () => now,
    setTimeout: (fn, ms) => (timers.set(++id, { fn, at: now + ms }), id),
    clearTimeout: (n) => timers.delete(n),
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const [next] = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at);
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
  };
}

const NAMES = Object.fromEntries(Object.entries(SOUNDS).map(([event, src]) => [src, event]));

// The same wiring as `go` in main.js, with fake animate, timers, and audio.
function setup({ reduced = false, unlocked = true, muted = false } = {}) {
  const clock = fakeClock();
  const log = [];
  const created = [];
  const createAudio = (src) => {
    created.push(src);
    return { play: () => log.push(["play", NAMES[src], clock.now()]), pause: () => log.push(["pause", NAMES[src], clock.now()]) };
  };
  const sound = createSound({ getItem: () => (muted ? JSON.stringify({ version: 1, data: true }) : null), setItem() {} },
    { createAudio, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  if (unlocked) sound.unlock();
  const flies = [];
  // Only the deal and play flies have a delay. The sweep has none.
  const animate = (element, frames, options) => {
    if ("delay" in options) flies.push(options);
    return { finished: new Promise(() => {}), finish() {} };
  };
  const motion = createMotion({ reduced, animate, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout });
  const view = {
    render() {},
    rect: () => ({ left: 0, top: 0, width: 40, height: 56 }),
    card: (card) => `card:${card.suit}:${card.rank}`,
    deck: () => "deck",
    pile: (player) => `pile:${player}`,
    dealt: ({ stacks }) => stacks.map((i) => `stack:${i}`),
    lift: () => ["ghost1", "ghost2"],
    drop() {},
  };
  const run = (prev, next) => {
    sound.stop();
    const motions = [];
    motion.run(game.motionEvents(prev, next), view, ({ type }, delay, duration) => motions.push({ type, delay, duration }));
    for (const [event, timing] of timeSounds(game.soundEvents(prev, next), motions)) sound.play(event, timing);
  };
  return { clock, log, created, flies, sound, motion, run };
}

const step = (state) => rules.applyMove(state, aiMove(state, () => 0.5));
const lastDealEnd = (steps) => (steps - 1) * DEAL_STEP + 3 * DEAL_STAGGER + DURATIONS.deal;

test("AC-2: each played card gives a card sound that starts and stops with its fly", () => {
  // The computer card, then the human card: one state change with two cards and a trick.
  let state = game.applyMove(game.newGame(5, "computer"), { type: "announce", game: "pik" });
  const t = setup();
  while (state.turn !== "computer") state = step(state);
  const first = step(state);
  const both = step(first);
  t.run(state, both);
  assert.equal(t.flies.length, 2);
  t.clock.tick(5000);
  const plays = t.log.filter(([kind, name]) => kind === "play" && name === "play").map(([, , at]) => at);
  const stops = t.log.filter(([kind, name]) => kind === "pause" && name === "play").map(([, , at]) => at);
  assert.deepEqual(plays, t.flies.map((f) => f.delay));
  assert.deepEqual(plays, [0, DURATIONS.fly]);
  assert.deepEqual(stops, t.flies.map((f) => f.delay + DURATIONS.fly));
});

test("AC-2: after a waiting trick, the card sound starts after the sweep delay", () => {
  let state = game.applyMove(game.newGame(5, "computer"), { type: "announce", game: "pik" });
  while (state.trick.length !== 1) state = step(state);
  const t = setup();
  const done = step(state);
  t.run(state, done);
  t.clock.tick(1000);
  const next = step(done);
  t.log.length = 0;
  t.flies.length = 0;
  t.run(done, next);
  t.clock.tick(5000);
  assert.deepEqual(t.flies.map((f) => f.delay), [DURATIONS.sweep]);
  assert.deepEqual(t.log, [["play", "play", 1000 + DURATIONS.sweep], ["pause", "play", 1000 + DURATIONS.sweep + DURATIONS.fly]]);
});

test("AC-3: one deal sound starts with the first deal fly and stops when the last one lands", () => {
  const cases = [
    [null, rules.newGame(3, "computer"), rules.FIRST_DEAL.length, 920],
    [rules.newGame(3, "computer"), game.applyMove(rules.newGame(3, "computer"), { type: "announce", game: "herz" }), rules.REST_DEAL.length, 1420],
    [null, game.newGame(3, "human"), rules.FIRST_DEAL.length + rules.REST_DEAL.length, 2170],
  ];
  for (const [prev, next, steps, expected] of cases) {
    const t = setup();
    t.run(prev, next);
    t.clock.tick(5000);
    assert.equal(lastDealEnd(steps), expected);
    assert.equal(Math.max(...t.flies.map((f) => f.delay + f.duration)), expected);
    assert.deepEqual(t.log, [["play", "deal", 0], ["pause", "deal", expected]]);
  }
});

// The last state change of a full game, for each winner.
function endings() {
  const found = {};
  for (let seed = 1; !(found.human && found.computer); seed++) {
    let state = rules.newGame(seed);
    while (!rules.isOver(state)) {
      const next = step(state);
      if (rules.isOver(next)) found[rules.winner(next)] ??= [state, next];
      state = next;
    }
  }
  return found;
}

test("AC-4: win or lose starts when the last fly ends and does not stop early", () => {
  const { human, computer } = endings();
  for (const [[prev, next], end] of [[human, "win"], [computer, "lose"]]) {
    const t = setup();
    t.run(prev, next);
    t.clock.tick(10000);
    const last = Math.max(...t.flies.map((f) => f.delay + f.duration));
    const ends = t.log.filter(([, name]) => name === end);
    assert.deepEqual(ends, [["play", end, last]]);
    assert.ok(last > 0);
  }
});

test("AC-5: with reduced motion, all sounds start at the state change, and the deal sound stops after DURATIONS.deal", () => {
  const t = setup({ reduced: true });
  t.run(null, game.newGame(3, "human"));
  t.clock.tick(5000);
  assert.deepEqual(t.flies, []);
  assert.deepEqual(t.log, [["play", "deal", 0], ["pause", "deal", DURATIONS.deal]]);
  const { human } = endings();
  const r = setup({ reduced: true });
  r.run(...human);
  r.clock.tick(5000);
  assert.deepEqual(r.log, [["play", "play", 0], ["play", "win", 0]]);
  assert.deepEqual(timeSounds(["play", "play", "lose"], []), [["play", {}], ["play", {}], ["lose", { delay: 0 }]]);
});

test("AC-6: muted or before unlock, no audio is created and no timer stays open", () => {
  const { human } = endings();
  for (const options of [{ muted: true }, { unlocked: false }]) {
    const t = setup(options);
    t.run(null, game.newGame(3, "human"));
    t.run(...human);
    assert.deepEqual(t.created, []);
    // Only the trick pause of motion waits.
    assert.equal(t.clock.timers.size, 1);
  }
});

test("AC-6: a new run, stop(), and mute pause the playing sounds and cancel the waiting sounds", () => {
  const t = setup();
  const dealt = game.newGame(3, "human");
  t.run(null, dealt);
  t.clock.tick(100);
  const state = game.applyMove(game.newGame(5, "computer"), { type: "announce", game: "pik" });
  t.run(state, step(state));
  assert.deepEqual(t.log, [["play", "deal", 0], ["pause", "deal", 100], ["play", "play", 100]]);
  t.sound.stop();
  assert.deepEqual(t.log.at(-1), ["pause", "play", 100]);
  t.log.length = 0;
  t.run(null, dealt);
  t.sound.play("win", { delay: 500 });
  t.sound.setMuted(true);
  t.clock.tick(5000);
  assert.deepEqual(t.log, [["play", "deal", 100], ["pause", "deal", 100]]);
  assert.equal(t.clock.timers.size, 0);
});

test("preload loads each file before unlock and plays nothing", () => {
  const t = setup({ unlocked: false });
  t.sound.preload();
  assert.deepEqual(t.created, Object.values(SOUNDS));
  assert.deepEqual(t.log, []);
});
