import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";
import { createMotion, TRICK_PAUSE } from "../src/core/motion.js";
import { renderCardBack } from "../src/core/card-view.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const count = (html, text) => html.split(text).length - 1;
const step = (state) => rules.applyMove(state, aiMove(state, () => 0.5));
const deal = (player, side, first) => ({ type: "deal", player, side, stacks: [first, first + 1, first + 2, first + 3] });

// A fake Web Animations API: each animation finishes only on finish().
function fakeAnimate() {
  const calls = [];
  const animate = (element, frames, options) => {
    let done;
    const animation = { element, frames, options, finishes: 0, finished: new Promise((r) => (done = r)) };
    animation.finish = () => (animation.finishes++, done());
    calls.push(animation);
    return animation;
  };
  return { calls, animate };
}

// A fake timer: run() calls the callbacks that wait.
function fakeTimer() {
  const timers = new Map();
  const log = [];
  let id = 0;
  return {
    log,
    timers,
    setTimeout: (fn, ms) => (timers.set(++id, fn), log.push(["set", id, ms]), id),
    clearTimeout: (n) => (timers.delete(n), log.push(["clear", n])),
    run() {
      const fns = [...timers.values()];
      timers.clear();
      fns.forEach((fn) => fn());
    },
  };
}

// A fake view: elements are names, all rects are the same size at different places.
function fakeView() {
  const log = [];
  const rect = (name) => ({ left: name.length * 10, top: 5, width: 40, height: 56 });
  return {
    log,
    render: () => log.push("render"),
    rect,
    card: (card) => `card:${card.suit}:${card.rank}`,
    deck: () => "deck",
    pile: (player) => `pile:${player}`,
    dealt: ({ player, side, stacks }) => stacks.map((i) => `${player}:${side}:${i}`),
    lift: () => (log.push("lift"), ["ghost1", "ghost2"]),
    drop: (ghost) => log.push(`drop:${ghost}`),
  };
}

const setup = (reduced = false) => {
  const anim = fakeAnimate();
  const timer = fakeTimer();
  const motion = createMotion({ reduced, animate: anim.animate, setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  return { anim, timer, motion };
};
const card = { suit: "herz", rank: "A" };
const trickEvents = [{ type: "play", player: "computer", card }, { type: "trick", winner: "human" }];
const playEvent = [{ type: "play", player: "human", card: { suit: "pik", rank: "7" } }];

test("AC-1: motionEvents gives the deal steps in the S12 order", () => {
  const dealt = game.newGame(3, "computer");
  assert.equal(dealt.vorhand, "human");
  assert.deepEqual(game.motionEvents(null, dealt), [deal("human", "down", 0), deal("computer", "down", 0), deal("human", "up", 0)]);
  const announced = game.applyMove(dealt, { type: "announce", game: "herz" });
  assert.deepEqual(game.motionEvents(dealt, announced), [
    deal("computer", "up", 0), deal("human", "down", 4), deal("computer", "down", 4), deal("human", "up", 4), deal("computer", "up", 4),
  ]);
  // The computer as Vorhand announces at once, so the new game gives all 8 steps.
  assert.equal(game.motionEvents(null, game.newGame(3, "human")).length, 8);
  for (const state of [dealt, announced, step(announced)]) assert.deepEqual(game.motionEvents(state, state), []);
});

test("AC-2: motionEvents gives one play event per card and a trick event with the winner", () => {
  let state = game.applyMove(game.newGame(5, "computer"), { type: "announce", game: "pik" });
  while (!rules.isOver(state)) {
    const next = step(state);
    const events = game.motionEvents(state, next);
    const [card] = state.trick.length ? next.tricks.at(-1).cards.slice(1) : next.trick;
    assert.deepEqual(events[0], { type: "play", player: state.turn, card: card.card });
    if (state.trick.length) {
      const lead = state.trick[0].card;
      const expected = rules.trickWinner(lead, card.card, "pik") === "lead" ? state.trick[0].player : state.turn;
      assert.deepEqual(events, [events[0], { type: "trick", winner: expected }]);
    } else {
      assert.equal(events.length, 1);
    }
    state = next;
  }
});

test("AC-3: render shows a won-tricks pile per player with one back per won trick", () => {
  let state = game.applyMove(game.newGame(7, "computer"), { type: "announce", game: "kreuz" });
  const piles = (html) => [...html.matchAll(/<div class="pile" data-player="(\w+)" role="img" aria-label="([^"]+)"><span class="pile__slot">(.*?)<\/span><span class="pile__count">/g)];
  for (;;) {
    const html = game.render(state);
    const found = piles(html);
    assert.deepEqual(found.map((m) => m[1]), ["computer", "human"]);
    for (const [, player, label, slot] of found) {
      const won = state.tricks.filter((t) => t.winner === player).length;
      assert.equal(count(slot, 'class="card-back"'), won);
      assert.equal(label, `${player === "human" ? "Du" : "Computer"}: ${won} ${won === 1 ? "Stich" : "Stiche"}`);
    }
    if (rules.isOver(state)) break;
    state = step(state);
  }
  assert.equal(piles(game.render(game.newGame(7, "computer"))).length, 2);
  const css = read("styles.css");
  assert.match(css, /\.pile__slot \{[^}]*width: calc\(1\.6rem \+ 30px\);[^}]*height: [^;]+;/);
  assert.match(css, /\.pile \.card-back \{[^}]*position: absolute;[^}]*left: calc\(var\(--i\) \* 2px\);/);
});

test("AC-4: the trick sweeps after 2500 ms, or at once on the next card", async () => {
  const { anim, timer, motion } = setup();
  const view = fakeView();
  await Promise.all([motion.run(trickEvents, view), ...anim.calls.map((a) => a.finish())]);
  const sets = (log) => log.filter(([type]) => type === "set");
  const [[, id, ms]] = sets(timer.log);
  assert.equal(ms, TRICK_PAUSE);
  assert.equal(ms, 2500);
  timer.run();
  assert.deepEqual(view.log, ["render", "lift"]);
  const sweeps = anim.calls.slice(1);
  assert.deepEqual(sweeps.map((a) => a.element), ["ghost1", "ghost2"]);
  assert.ok(sweeps.every((a) => a.frames.at(-1).transform.startsWith("translate(")));
  assert.ok(id);

  // The next card before 2500 ms: the old timer is cleared, and the sweep runs before the fly.
  const second = setup();
  const view2 = fakeView();
  second.motion.run(trickEvents, view2);
  const [[, first]] = sets(second.timer.log);
  second.timer.log.length = 0;
  second.motion.run(playEvent, view2);
  assert.deepEqual(second.timer.log, [["clear", first]]);
  assert.equal(second.timer.timers.size, 0);
  assert.deepEqual(view2.log, ["render", "lift", "render"]);
  const after = second.anim.calls.slice(1);
  assert.deepEqual(after.map((a) => a.element), ["ghost1", "ghost2", "card:pik:7"]);
  assert.equal(after[2].options.delay, after[0].options.duration);

  let state = game.applyMove(game.newGame(2, "computer"), { type: "announce", game: "herz" });
  state = step(step(state));
  assert.match(game.render(state), /Stich für/);
  const cleared = game.render(state, { trickCleared: true });
  assert.doesNotMatch(cleared, /Stich für/);
  assert.equal(count(cleared.match(/<ul class="trick__cards"[^>]*>(.*?)<\/ul>/s)[1], "<li"), 0);
});

test("AC-5: with reduced motion, no animate call and each run resolves at once", async () => {
  const { anim, timer, motion } = setup(true);
  const view = fakeView();
  const runs = [
    motion.run([deal("human", "down", 0), deal("computer", "down", 0)], view),
    motion.run(trickEvents, view),
    motion.run(playEvent, view),
    motion.run(trickEvents, view),
  ];
  let resolved = 0;
  runs.forEach((p) => p.then(() => resolved++));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, 4);
  timer.run();
  assert.equal(anim.calls.length, 0);
  // The state changes stay: each render runs, and the trick is lifted and its copies dropped.
  assert.deepEqual(view.log, ["render", "render", "lift", "render", "drop:ghost1", "drop:ghost2", "render", "lift", "drop:ghost1", "drop:ghost2"]);
});

test("AC-6: a new run finishes open animations first, each run resolves once, durations stay short", async () => {
  const { anim, motion } = setup();
  const view = fakeView();
  const steps = game.motionEvents(null, game.newGame(1, "human"));
  let first = 0;
  motion.run(steps, view).then(() => first++);
  const open = anim.calls.slice();
  assert.equal(open.length, 32);
  assert.ok(open.every((a) => a.finishes === 0));
  const second = motion.run(trickEvents, view);
  assert.ok(open.every((a) => a.finishes === 1));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(first, 1);
  anim.calls.at(-1).finish();
  let resolved = 0;
  await second.then(() => resolved++);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(first, 1);
  assert.equal(resolved, 1);
  for (const a of anim.calls) assert.ok(a.options.duration <= 1500, String(a.options.duration));
  // A deal step: from the start of its first card to the end of its last card.
  const stepTime = open[3].options.delay + open[3].options.duration - open[0].options.delay;
  assert.ok(stepTime <= 1500, String(stepTime));
});

test("AC-7: the card back is always the CSS back in the theme red or brown", (t) => {
  const css = `<div class="card-back" role="img" aria-label="Verdeckte Karte"></div>`;
  assert.equal(renderCardBack(), css);
  const saved = Object.getOwnPropertyDescriptor(globalThis, "customElements");
  globalThis.customElements = { get: (name) => (name === "playing-card" ? class {} : undefined) };
  t.after(() => (saved ? Object.defineProperty(globalThis, "customElements", saved) : delete globalThis.customElements));
  assert.equal(renderCardBack(), css);
  assert.ok(!renderCardBack().includes("<playing-card"));
  assert.match(read("styles.css"), /\.card-back \{[^}]*background:[^}]*var\(--(red|brown)\);/);
});
