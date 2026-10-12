import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { makeRoomCode, normalizeRoomCode, peerId, ROOM_WORDS } from "../src/core/room-code.js";
import { createLinks } from "../src/core/link.js";
import { renderMenu, renderCredits } from "../src/core/menu-view.js";
import { listGames } from "../src/core/registry.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const FORMAT = /^(KREUZ|PIK|HERZ|KARO|BUBE|DAME|KOENIG|ASS)-\d{2}$/;
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("AC-1: makeRoomCode gives WORD-NN, each of the 8 words, and the digits 00 and 99", () => {
  for (let i = 0; i < 50; i++) assert.match(makeRoomCode(), FORMAT);
  const words = ROOM_WORDS.map((_, i) => makeRoomCode(() => (i + 0.5) / 8).split("-")[0]);
  assert.deepEqual(words, ["KREUZ", "PIK", "HERZ", "KARO", "BUBE", "DAME", "KOENIG", "ASS"]);
  assert.equal(makeRoomCode(() => 0), "KREUZ-00");
  assert.equal(makeRoomCode(() => 0.999999), "ASS-99");
});

test("AC-2: normalizeRoomCode ignores case, spaces, the dash, and the umlaut in König", () => {
  for (const input of ["kreuz-42", " Kreuz 42 ", "KREUZ42", "k r e u z - 4 2"]) assert.equal(normalizeRoomCode(input), "KREUZ-42", input);
  for (const input of ["König07", "KÖNIG-07", "koenig 07"]) assert.equal(normalizeRoomCode(input), "KOENIG-07", input);
});

test("AC-3: normalizeRoomCode rejects invalid codes, keeps valid codes, and peerId adds the prefix", () => {
  for (const input of ["", "HUND-42", "KREUZ-4", "KREUZ-421", "KREUZ-AB", "42-KREUZ", null, undefined]) assert.equal(normalizeRoomCode(input), null, input);
  for (const word of ROOM_WORDS) for (const n of ["00", "42", "99"]) assert.equal(normalizeRoomCode(`${word}-${n}`), `${word}-${n}`);
  assert.equal(peerId("KREUZ-42"), "karten-KREUZ-42");
});

// A fake PeerJS: an in-memory broker. `openAll()` opens the waiting data channels.
function fakeNet() {
  const peers = new Map();
  const waiting = [];
  const emitter = () => {
    const handlers = {};
    return {
      on: (type, fn) => (handlers[type] ??= []).push(fn),
      emit: (type, ...args) => (handlers[type] ?? []).forEach((fn) => fn(...args)),
    };
  };
  let next = 0;
  class Peer {
    constructor(id = `random-${++next}`) {
      Object.assign(this, emitter(), { id, destroyed: false });
      peers.set(id, this);
      queueMicrotask(() => this.emit("open", id));
    }
    connect(id) {
      const a = { ...emitter(), sent: [] };
      const b = { ...emitter(), sent: [] };
      for (const [me, other] of [[a, b], [b, a]]) {
        me.send = (data) => other.emit("data", data);
        me.close = () => { me.emit("close"); other.emit("close"); };
      }
      this.connectedTo = id;
      queueMicrotask(() => peers.get(id).emit("connection", b));
      waiting.push(a, b);
      return a;
    }
    destroy() { this.destroyed = true; }
  }
  const openAll = () => waiting.splice(0).forEach((conn) => conn.emit("open"));
  return { Peer, peers, openAll };
}

test("AC-4: host and join connect over the fake PeerJS, send data, and close both sides", async () => {
  const net = fakeNet();
  const { host, join } = createLinks(async () => net.Peer);
  let hostLink;
  let guestLink;
  host("KREUZ-42").then((l) => (hostLink = l));
  join("KREUZ-42").then((l) => (guestLink = l));
  await settle();
  assert.ok(net.peers.has("karten-KREUZ-42"));
  const guestPeer = [...net.peers.values()].find((p) => p.id !== "karten-KREUZ-42");
  assert.equal(hostLink, undefined);
  net.openAll();
  await settle();
  assert.ok(hostLink && guestLink);
  const atHost = [];
  const atGuest = [];
  hostLink.onMessage((data) => atHost.push(data));
  guestLink.onMessage((data) => atGuest.push(data));
  guestLink.send({ type: "hello" });
  hostLink.send({ type: "welcome" });
  assert.deepEqual(atHost, [{ type: "hello" }]);
  assert.deepEqual(atGuest, [{ type: "welcome" }]);
  let closed = 0;
  hostLink.onClose(() => closed++);
  guestLink.close();
  assert.equal(closed, 1);
  assert.equal(guestPeer.destroyed, true);
});

test("AC-4: join connects to the peer id karten-<code>, and an abort destroys the waiting peer", async () => {
  const net = fakeNet();
  const { host, join } = createLinks(async () => net.Peer);
  const abort = new AbortController();
  const waiting = host("PIK-07", abort.signal);
  const guest = join("PIK-07");
  await settle();
  const guestPeer = [...net.peers.values()].find((p) => p.id !== "karten-PIK-07");
  assert.equal(guestPeer.connectedTo, "karten-PIK-07");
  abort.abort();
  await assert.rejects(waiting);
  assert.equal(net.peers.get("karten-PIK-07").destroyed, true);
  net.openAll();
  assert.ok(await guest);
});

test("AC-5: PeerJS loads only on the first host or join call, and only once", async () => {
  let loads = 0;
  const net = fakeNet();
  const { host, join } = createLinks(async () => (loads++, net.Peer));
  assert.equal(loads, 0);
  host("ASS-01");
  join("ASS-01");
  await settle();
  assert.equal(loads, 1);
});

test("AC-5: index.html and the start imports of main.js have no reference to vendor/peerjs, and the vendor files exist", () => {
  assert.ok(!read("index.html").includes("vendor/peerjs"));
  const seen = new Set();
  const visit = (url) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const js = readFileSync(url, "utf8");
    assert.ok(!js.includes("vendor/peerjs"), url.pathname);
    for (const [, path] of js.matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) visit(new URL(path, url));
  };
  visit(new URL("../src/main.js", import.meta.url));
  assert.ok(seen.size > 5);
  assert.ok(![...seen].some((href) => href.endsWith("/link.js")));
  assert.ok(existsSync(new URL("../vendor/peerjs/peerjs.min.js", import.meta.url)));
  assert.ok(read("vendor/peerjs/LICENSE").includes("MIT"));
});

// A small fake DOM for startApp: the app element keeps only its innerHTML.
globalThis.Audio ??= class { play() {} pause() {} };
const { startApp } = await import("../src/main.js");

function setup() {
  const fake = (html = "") => ({
    innerHTML: html,
    textContent: "",
    listeners: {},
    setAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
    querySelector: () => fake(),
    focus() {},
  });
  const app = fake();
  const mute = fake();
  // Each new screen makes new elements. The status and the hint get their text from the HTML.
  const parts = {};
  let html = "";
  Object.defineProperty(app, "innerHTML", {
    get: () => html,
    set(value) {
      html = value;
      parts["#room-code"] = { value: "", focus() {} };
      parts[".room [role=status]"] = { textContent: value.match(/role="status">([^<]*)</)?.[1] };
      parts[".room__hint"] = { textContent: value.match(/class="room__hint"[^>]*>([^<]*)</)?.[1] };
    },
  });
  app.querySelector = (selector) => parts[selector] ?? null;
  const document = { title: "", getElementById: (id) => ({ app, mute })[id], addEventListener() {} };
  const calls = [];
  const connect = (role, code, signal) => new Promise((resolve) => {
    const link = { closed: 0, close() { this.closed++; }, send() {}, onMessage() {}, onClose() {} };
    calls.push({ role, code, signal, open: () => resolve(link), link });
  });
  startApp({
    document,
    storage: null,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    reducedMotion: true,
    seed: () => 7,
    connect,
  });
  const click = async (attr) => {
    const tag = app.innerHTML.match(new RegExp(`<button[^>]*${attr}[^>]*>`))?.[0];
    assert.ok(tag, `no button with ${attr}`);
    const dataset = Object.fromEntries([...tag.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([, n, v]) => [n, v]));
    for (const fn of app.listeners.click) fn({ target: { closest: () => ({ dataset }) }, preventDefault() {} });
    await settle();
  };
  return { app, parts, calls, click, status: () => parts[".room [role=status]"].textContent };
}

test("AC-6: the menu has Zu zweit spielen, and Raum öffnen shows a code, a copy button, and Verbunden", async () => {
  assert.match(renderMenu(listGames()), /<button type="button"[^>]*data-online="offiziersskat"[^>]*>Zu zweit spielen<\/button>/);
  const t = setup();
  await t.click('data-online="offiziersskat"');
  assert.match(t.app.innerHTML, />Raum öffnen</);
  assert.match(t.app.innerHTML, />Raum beitreten</);
  await t.click('data-action="host"');
  const code = t.app.innerHTML.match(/class="room__code">([^<]*)</)[1];
  assert.match(code, FORMAT);
  assert.match(t.app.innerHTML, /<button type="button"[^>]*data-action="copy"[^>]*>Code kopieren<\/button>/);
  assert.equal(t.status(), "Warte auf Mitspieler …");
  assert.deepEqual([t.calls[0].role, t.calls[0].code], ["host", code]);
  const screen = t.app.innerHTML;
  t.calls[0].open();
  await settle();
  assert.equal(t.status(), "Verbunden");
  assert.equal(t.app.innerHTML, screen, "the screen is not rendered again, so the focus stays");
});

test("AC-7: Raum beitreten normalizes the code, rejects an invalid code, and Zurück closes the link", async () => {
  const t = setup();
  await t.click('data-online="offiziersskat"');
  await t.click('data-action="join"');
  assert.match(t.app.innerHTML, /<input id="room-code"[^>]*autocapitalize="characters"[^>]*autocomplete="off"/);
  const input = t.parts["#room-code"];
  input.value = "hund";
  await t.click('data-action="join-code"');
  assert.equal(t.parts[".room__hint"].textContent, "Ungültiger Code, z. B. KREUZ-42");
  assert.equal(t.parts["#room-code"], input, "the form stays, so the typed text stays");
  assert.equal(input.value, "hund");
  assert.ok(!t.app.innerHTML.includes("hund"));
  assert.equal(t.calls.length, 0);
  input.value = "kreuz 42";
  await t.click('data-action="join-code"');
  assert.deepEqual([t.calls[0].role, t.calls[0].code], ["join", "KREUZ-42"]);
  assert.equal(t.status(), "Verbinde …");
  t.calls[0].open();
  await settle();
  assert.equal(t.status(), "Verbunden");
  await t.click('data-action="back"');
  assert.equal(t.calls[0].link.closed, 1);
  assert.equal(t.calls[0].signal.aborted, true);
  assert.match(t.app.innerHTML, /<h1>Karten<\/h1>/);
});

test("AC-7: Zurück while the host waits aborts the wait, and a late link closes", async () => {
  const t = setup();
  await t.click('data-online="offiziersskat"');
  await t.click('data-action="host"');
  await t.click('data-action="back"');
  assert.equal(t.calls[0].signal.aborted, true);
  t.calls[0].open();
  await settle();
  assert.equal(t.calls[0].link.closed, 1);
  assert.match(t.app.innerHTML, /<h1>Karten<\/h1>/);
});

test("AC-8: the credits and the README name PeerJS, MIT, 0.peerjs.com, and the STUN and TURN servers", () => {
  const html = renderCredits();
  for (const text of ["PeerJS", "MIT", "0.peerjs.com", "stun.l.google.com", "TURN"]) assert.ok(html.includes(text), text);
  const credits = read("README.md").split("## Credits")[1];
  for (const text of ["PeerJS", "0.peerjs.com", "stun.l.google.com", "turn.peerjs.com"]) assert.ok(credits.includes(text), text);
});
