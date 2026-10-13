import { test } from "node:test";
import assert from "node:assert/strict";
import * as rules from "../src/games/skat/rules.js";
import { aiMove } from "../src/games/skat/ai.js";
import { seatView, hostSession, guestSession, checkView } from "../src/games/skat/online.js";
import { createLinks } from "../src/core/link.js";
import { linkPair } from "./link-pair.js";

// Host seat 0 and 1 or 2 guests. With 1 guest, seat 2 is a computer.
function setup(seed, guests) {
  const pairs = Array.from({ length: guests }, () => linkPair());
  const sent = [];
  for (const [hostLink] of pairs) {
    const send = hostLink.send;
    hostLink.send = (data) => (sent.push(JSON.stringify(data)), send(data));
  }
  const views = pairs.map(() => []);
  const guestSessions = pairs.map(([, guestLink], i) => guestSession(guestLink, (view) => views[i].push(view)));
  const initial = rules.newGame(seed, 0, [], guests === 1 ? [2] : []);
  const changes = [];
  const host = hostSession(pairs.map(([hostLink]) => hostLink), initial, (s) => changes.push(s));
  return { pairs, host, guestSessions, views, changes, sent, state: () => changes.at(-1) ?? initial };
}

// Each guest sees only its own hand, the declarer hand in Ouvert, and the Skat after its own pickup or after the end.
function assertAllowed(ctx) {
  const state = ctx.state();
  ctx.views.forEach((list, i) => {
    const seat = i + 1;
    const view = list.at(-1);
    assert.deepEqual(view, seatView(state, seat));
    assert.ok(!("seed" in view) && !("log" in view));
    view.hands.forEach((hand, s) => {
      const open = s === seat || (state.game?.ouvert && s === state.declarer);
      assert.ok(hand.every((c) => (open ? c !== null : c === null)), `seat ${seat} sees hand ${s}`);
    });
    const skatOpen = rules.isOver(state) || (seat === state.declarer && state.pickedUp);
    assert.ok(view.skat.every((c) => (skatOpen ? c !== null : c === null)));
  });
  assert.ok(ctx.sent.every((json) => !json.includes('"seed"') && !json.includes('"log"')));
}

// One move of the seat in turn. A guest moves only from its own view.
function step(ctx) {
  const state = ctx.state();
  if (state.computers.includes(state.turn)) return assert.equal(ctx.host.ai(), true);
  if (state.turn === 0) return ctx.host.move(aiMove(state));
  const i = state.turn - 1;
  ctx.guestSessions[i].move(aiMove(ctx.views[i].at(-1)));
}

function playGame(ctx) {
  while (!rules.isOver(ctx.state())) {
    const before = ctx.changes.length;
    step(ctx);
    assert.equal(ctx.changes.length, before + 1);
    assertAllowed(ctx);
  }
}

for (const guests of [2, 1]) {
  test(`AC-5: a full seeded game with host + ${guests} guest(s) keeps each guest view to its allowed cards`, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const ctx = setup(seed, guests);
      assertAllowed(ctx);
      playGame(ctx);
      ctx.host.next(seed + 100);
      assert.equal(ctx.state().dealer, 1);
      assertAllowed(ctx);
      playGame(ctx);
      assert.ok(ctx.state().scores.length <= 2);
    }
  });
}

test("AC-5: a move out of turn, an illegal move or a malformed message changes nothing", () => {
  const ctx = setup(7, 2);
  // Seat 2 (Mittelhand) bids first. Guest 1 has seat 1.
  const [[, link1], [, link2]] = ctx.pairs;
  const bad = [
    [link1, { type: "move", move: { type: "bid", value: 18 } }],
    [link2, { type: "move", move: { type: "bid", value: 19 } }],
    [link2, { type: "move", move: { type: "yes" } }],
    [link2, { type: "move", move: { type: "play", card: ctx.state().hands[2][0] } }],
    [link2, { type: "move", move: { type: "bid", value: { valueOf: 18 } } }],
    [link2, { type: "move" }],
    [link2, { type: "next" }],
    [link2, null],
    [link2, "move"],
    [link2, { type: "state", view: seatView(ctx.state(), 0) }],
  ];
  const before = structuredClone(ctx.state());
  for (const [link, message] of bad) link.send(message);
  assert.equal(ctx.changes.length, 0);
  assert.deepEqual(ctx.state(), before);
  assert.equal(ctx.host.move({ type: "pass" }), false);
  link2.send({ type: "move", move: { type: "bid", value: 18 } });
  assert.equal(ctx.changes.length, 1);
});

test("AC-5: only the host starts Nächstes Spiel", () => {
  const ctx = setup(3, 1);
  playGame(ctx);
  const [[, link]] = ctx.pairs;
  const count = ctx.changes.length;
  link.send({ type: "next" });
  link.send({ type: "move", move: { type: "pass" } });
  assert.equal(ctx.changes.length, count);
  ctx.host.next(77);
  assert.equal(ctx.changes.length, count + 1);
  assert.equal(ctx.state().phase, "bid");
});

test("AC-5: the declarer hand is open to all only in Ouvert", () => {
  // Dealer 0: Vorhand 1 is the declarer.
  const skat = ["bid", "yes", "pass", "pass"].reduce((s, type) => rules.applyMove(s, type === "bid" ? { type, value: 18 } : { type }), rules.newGame(4, 0));
  const ouvert = rules.applyMove(skat, { type: "declare", game: "grand", ouvert: true });
  assert.ok(seatView(ouvert, 2).hands[1].every(Boolean));
  assert.ok(seatView(ouvert, 2).hands[0].every((c) => c === null));
  assert.ok(seatView(ouvert, 2).skat.every((c) => c === null));
  const hand = rules.applyMove(skat, { type: "declare", game: "grand" });
  assert.ok(seatView(hand, 2).hands[1].every((c) => c === null));
  const picked = rules.applyMove(skat, { type: "pickup" });
  assert.ok(seatView(picked, 1).skat.length === 0 && seatView(picked, 1).hands[1].length === 12);
});

test("AC-5: checkView drops views with bad fields", () => {
  const view = seatView(rules.newGame(4, 0), 1);
  assert.deepEqual(checkView(structuredClone(view)), view);
  for (const change of [
    { phase: "x" }, { me: 3 }, { hands: [[], []] }, { skat: [{ suit: "x", rank: "A" }] }, { said: ["<b>", "", ""] },
    { bid: { ...view.bid, value: 19 } }, { game: { type: "grand" } }, { scores: [{ declarer: 0, value: 1 }] }, { pickedUp: "yes" },
  ]) {
    assert.equal(checkView({ ...view, ...change }), null, JSON.stringify(change));
  }
});

test("AC-5: the host link takes a second guest when it asks for more", async () => {
  const peers = [];
  let host;
  // A small fake PeerJS: the host gets 3 connections, the third without `more` is closed.
  class Peer {
    constructor() {
      this.handlers = {};
      host = this;
      peers.push(this);
    }
    on(type, fn) { this.handlers[type] = fn; }
    destroy() { this.destroyed = true; }
  }
  const conn = () => {
    const handlers = {};
    return { handlers, on: (type, fn) => { handlers[type] = fn; }, send() {}, close() { this.closed = true; } };
  };
  const { host: hostLink } = createLinks(async () => Peer);
  const extra = [];
  const first = hostLink("KREUZ-42", undefined, (link) => extra.push(link));
  await new Promise((resolve) => setImmediate(resolve));
  const conns = [conn(), conn()];
  for (const c of conns) {
    host.handlers.connection(c);
    c.handlers.open();
  }
  const link = await first;
  assert.equal(extra.length, 1);
  extra[0].close();
  assert.ok(conns[1].closed && !host.destroyed);
  link.close();
  assert.ok(conns[0].closed && host.destroyed);
  assert.equal(peers.length, 1);
});
