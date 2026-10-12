import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "../src/games/offiziersskat/rules.js";
import { guestView, hostSession, guestSession, checkView } from "../src/games/offiziersskat/online.js";
import { linkPair } from "./link-pair.js";

const hostTurn = (s) => (s.trump === null ? s.vorhand : s.turn) === "human";

function setup(seed, dealer) {
  const [hostLink, guestLink] = linkPair();
  const sent = [];
  const send = hostLink.send;
  hostLink.send = (data) => (sent.push(data), send(data));
  const views = [];
  const guest = guestSession(guestLink, (view) => views.push(view));
  const initial = rules.newGame(seed, dealer);
  const changes = [];
  const host = hostSession(hostLink, initial, (s) => changes.push(s));
  return { host, guest, guestLink, views, changes, sent, state: () => changes.at(-1) ?? initial };
}

// One move of the side in turn. The guest moves only from its view.
function step(ctx) {
  const s = ctx.state();
  const view = ctx.views.at(-1);
  if (hostTurn(s)) {
    ctx.host.move(s.trump === null ? { type: "announce", game: "herz" } : { type: "play", stack: rules.legalStacksFor(s)[0] });
  } else {
    assert.equal(view.trump === null ? view.vorhand : view.turn, "human");
    ctx.guest.move(view.trump === null ? { type: "announce", game: "grand" } : { type: "play", stack: view.legal.at(-1) });
  }
}

function playUntil(ctx, done) {
  while (!done(ctx.state())) {
    const before = ctx.views.length;
    step(ctx);
    assert.equal(ctx.views.length, before + 1);
    assert.deepEqual(ctx.views.at(-1), guestView(ctx.state()));
  }
}

const countDown = (player) => player.stacks.filter((stack) => stack.down).length;
const GAMES = [[3, "computer"], [3, "human"], [42, "computer"], [42, "human"]];

test("AC-1: guestView swaps the seats and does not change its input", () => {
  let state = rules.applyMove(rules.newGame(7, "computer", [{ human: 70, computer: 50 }]), { type: "announce", game: "herz" });
  while (state.tricks.length < 3 || state.trick.length === 0) state = rules.applyMove(state, { type: "play", stack: rules.legalStacksFor(state)[0] });
  const copy = structuredClone(state);
  const view = guestView(state);
  assert.deepEqual(state, copy);
  assert.deepEqual(view.players.human.stacks.map((s) => s.up), state.players.computer.stacks.map((s) => s.up));
  assert.deepEqual(view.players.computer.stacks.map((s) => s.up), state.players.human.stacks.map((s) => s.up));
  const swap = { human: "computer", computer: "human" };
  for (const key of ["turn", "dealer", "vorhand"]) assert.equal(view[key], swap[state[key]]);
  assert.deepEqual(view.trick.map((c) => c.player), state.trick.map((c) => swap[c.player]));
  assert.deepEqual(view.tricks.map((t) => t.winner), state.tricks.map((t) => swap[t.winner]));
  assert.deepEqual(view.tricks.flatMap((t) => t.cards.map((c) => c.player)), state.tricks.flatMap((t) => t.cards.map((c) => swap[c.player])));
  assert.deepEqual(view.scores, [{ human: 50, computer: 70 }]);
  assert.equal(view.trump, "herz");
});

test("AC-2: no guest view holds a hidden card or the seed", () => {
  for (const [seed, dealer] of GAMES) {
    const ctx = setup(seed, dealer);
    const states = [ctx.state()];
    while (!rules.isOver(ctx.state())) {
      step(ctx);
      states.push(ctx.state());
    }
    assert.equal(ctx.views.length, states.length);
    ctx.views.forEach((view, i) => {
      const state = states[i];
      assert.ok(!("seed" in view));
      for (const [seat, own] of [["human", "computer"], ["computer", "human"]]) {
        for (const stack of view.players[seat].stacks) assert.ok(stack.down === true || stack.down === null);
        assert.equal(countDown(view.players[seat]), countDown(state.players[own]));
      }
      assert.ok(view.stock.every((x) => x === null));
      assert.equal(view.stock.length, state.stock.length);
    });
    assert.ok(ctx.views.some((view) => view.stock.length === 20));
  }
});

test("AC-3 and AC-6: a full seeded game runs over a link pair, one view for each move", () => {
  for (const [seed, dealer] of GAMES) {
    const ctx = setup(seed, dealer);
    assert.equal(ctx.views.length, 1);
    playUntil(ctx, rules.isOver);
    const state = ctx.state();
    const view = ctx.views.at(-1);
    assert.equal(state.tricks.length, 16);
    assert.equal(view.tricks.length, 16);
    const points = rules.points(state);
    assert.deepEqual(rules.points(view), { human: points.computer, computer: points.human });
    assert.deepEqual(view.scores, [{ human: points.computer, computer: points.human }]);
    assert.deepEqual(view.legal, []);
    assert.equal(ctx.sent.length, ctx.changes.length + 1);
  }
});

function assertNoChange(ctx, act) {
  const state = structuredClone(ctx.state());
  const counts = [ctx.changes.length, ctx.sent.length, ctx.views.length];
  act();
  assert.deepEqual(ctx.state(), state);
  assert.deepEqual([ctx.changes.length, ctx.sent.length, ctx.views.length], counts);
}

test("AC-4: a move out of turn changes nothing", () => {
  for (const [seed, dealer] of GAMES) {
    const ctx = setup(seed, dealer);
    // Announcement phase.
    if (hostTurn(ctx.state())) assertNoChange(ctx, () => ctx.guest.move({ type: "announce", game: "herz" }));
    else assertNoChange(ctx, () => assert.equal(ctx.host.move({ type: "announce", game: "herz" }), false));
    playUntil(ctx, (s) => s.trump !== null);
    // Play phase: both seats out of turn, at different points of the game.
    let seen = { host: 0, guest: 0 };
    while (!rules.isOver(ctx.state())) {
      const s = ctx.state();
      const stacks = s.players[s.turn === "human" ? "computer" : "human"].stacks;
      const stack = stacks.findIndex((x) => x.up);
      if (hostTurn(s)) {
        assertNoChange(ctx, () => ctx.guest.move({ type: "play", stack }));
        seen.guest++;
      } else {
        assertNoChange(ctx, () => assert.equal(ctx.host.move({ type: "play", stack }), false));
        seen.host++;
      }
      step(ctx);
    }
    assert.ok(seen.host > 0 && seen.guest > 0);
  }
});

test("AC-5: the host drops illegal and malformed guest messages", () => {
  const ctx = setup(5, "human");
  // The guest is Vorhand. A wrong announcement first.
  for (const msg of [{ type: "move", move: { type: "announce", game: "null" } }, { type: "move", move: { type: "announce" } }]) {
    assertNoChange(ctx, () => ctx.guestLink.send(msg));
  }
  ctx.guest.move({ type: "announce", game: "kreuz" });
  // Find a guest turn with a stack that is not legal.
  let illegal = -1;
  while (illegal < 0) {
    step(ctx);
    const s = ctx.state();
    if (!hostTurn(s)) illegal = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !rules.legalStacksFor(s).includes(i)) ?? -1;
    assert.ok(!rules.isOver(s));
  }
  const legal = rules.legalStacksFor(ctx.state())[0];
  const bad = [
    { type: "move", move: { type: "play", stack: illegal } },
    { type: "move", move: { type: "play", stack: 8 } },
    { type: "move", move: { type: "play", stack: -1 } },
    { type: "move", move: { type: "play", stack: String(legal) } },
    { type: "move", move: { type: "play", stack: legal + 0.5 } },
    { type: "move", move: { type: "pass" } },
    { type: "other", move: { type: "play", stack: legal } },
    { type: "move", move: { type: "announce", game: "grand" } },
    { type: "move", move: null },
    { type: "move" },
    null,
    "move",
    42,
  ];
  for (const msg of bad) assertNoChange(ctx, () => ctx.guestLink.send(msg));
  // The same guest turn still accepts a legal move.
  const changes = ctx.changes.length;
  ctx.guestLink.send({ type: "move", move: { type: "play", stack: legal, extra: "x" } });
  assert.equal(ctx.changes.length, changes + 1);
  assert.deepEqual(ctx.views.at(-1), guestView(ctx.state()));
});

test("AC-7: the guest drops state messages with unknown values", () => {
  let state = rules.applyMove(rules.newGame(9, "computer"), { type: "announce", game: "pik" });
  state = rules.applyMove(state, { type: "play", stack: rules.legalStacksFor(state)[0] });
  const good = guestView(state);
  const cases = [
    (v) => { v.players.human.stacks[0].up.suit = "<img>"; },
    (v) => { v.players.computer.stacks[1].up.rank = "1"; },
    (v) => { v.trick[0].card.rank = "Z"; },
    (v) => { v.turn = "guest"; },
    (v) => { v.trick[0].player = "admin"; },
    (v) => { v.trump = "null"; },
    (v) => { v.legal = [8]; },
    (v) => { v.legal = [-1]; },
    (v) => { v.legal = ["1"]; },
    (v) => { v.players.human.stacks[2].down = { suit: "herz", rank: "A" }; },
    (v) => { v.stock = [{ suit: "herz", rank: "A" }]; },
    (v) => { v.players.human.stacks.pop(); },
  ];
  for (const change of cases) {
    const view = structuredClone(good);
    change(view);
    assert.equal(checkView(view), null);
    const [hostLink, guestLink] = linkPair();
    const views = [];
    guestSession(guestLink, (v) => views.push(v));
    hostLink.send({ type: "state", view });
    assert.equal(views.length, 0);
  }
  const [hostLink, guestLink] = linkPair();
  const views = [];
  guestSession(guestLink, (v) => views.push(v));
  for (const msg of [null, "state", { type: "other", view: good }]) hostLink.send(msg);
  assert.equal(views.length, 0);
  hostLink.send({ type: "state", view: { ...good, extra: "<script>" } });
  assert.deepEqual(views, [good]);
});
