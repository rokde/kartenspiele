import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { registerServiceWorker } from "../src/main.js";

const ORIGIN = "https://x.test";
const BASE = `${ORIGIN}/app/sw.js`;
const source = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

// Runs sw.js in a fresh context with fake worker globals. Cache keys are absolute URLs.
function worker(version, precache = []) {
  const code = source
    .replace(`const VERSION = "dev";`, `const VERSION = ${JSON.stringify(version)};`)
    .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(precache)};`);
  const calls = { skipWaiting: 0, claim: 0, fetch: [], opened: [], added: [], deleted: [] };
  const store = new Map([["karten-old", new Map()], ["other", new Map()]]);
  const url = (r) => new URL(typeof r === "string" ? r : r.url, BASE).href;
  const listeners = {};
  let network = async (req) => `net:${url(req)}`;
  const caches = {
    async open(name) {
      calls.opened.push(name);
      if (!store.has(name)) store.set(name, new Map());
      const c = store.get(name);
      return {
        async addAll(reqs) {
          for (const r of reqs) { calls.added.push(r); c.set(url(r), `cache:${url(r)}`); }
        },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(name) { calls.deleted.push(name); return store.delete(name); },
    async match(r) {
      for (const c of store.values()) if (c.has(url(r))) return c.get(url(r));
      return undefined;
    },
  };
  class Request {
    constructor(u, init) { this.url = url(u); Object.assign(this, init); }
  }
  const self = {
    location: new URL(BASE),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => { calls.skipWaiting++; },
    clients: { claim: async () => { calls.claim++; } },
  };
  const fetch = (req) => { calls.fetch.push(url(req)); return network(req); };
  vm.runInNewContext(code, { self, caches, fetch, Request, URL, Promise });
  const lifecycle = async (type) => {
    let wait;
    listeners[type]({ waitUntil: (p) => { wait = p; } });
    await wait;
  };
  const request = (path, { method = "GET", mode = "cors" } = {}) => {
    let response;
    const event = { request: { url: new URL(path, BASE).href, method, mode }, respondWith: (p) => { response = p; } };
    listeners.fetch(event);
    return response;
  };
  return { calls, store, lifecycle, request, setNetwork: (fn) => { network = fn; } };
}

test("S29 AC-4: a versioned worker precaches, cleans up and serves offline", async () => {
  const w = worker("abc123", ["./", "index.html", "src/main.js?v=abc123"]);
  await w.lifecycle("install");
  assert.deepEqual(w.calls.opened, ["karten-abc123"]);
  assert.deepEqual(w.calls.added.map((r) => r.url), [`${ORIGIN}/app/`, `${ORIGIN}/app/index.html`, `${ORIGIN}/app/src/main.js?v=abc123`]);
  assert.ok(w.calls.added.every((r) => r.cache === "reload"));
  assert.equal(w.calls.skipWaiting, 1);

  await w.lifecycle("activate");
  assert.deepEqual(w.calls.deleted.sort(), ["karten-old", "other"]);
  assert.deepEqual([...w.store.keys()], ["karten-abc123"]);
  assert.equal(w.calls.claim, 1);

  assert.equal(await w.request("src/main.js?v=abc123"), `cache:${ORIGIN}/app/src/main.js?v=abc123`);
  assert.deepEqual(w.calls.fetch, []);
  assert.equal(await w.request("src/new.js?v=abc123"), `net:${ORIGIN}/app/src/new.js?v=abc123`);

  w.calls.fetch.length = 0;
  assert.equal(await w.request("./", { mode: "navigate" }), `net:${ORIGIN}/app/`);
  assert.deepEqual(w.calls.fetch, [`${ORIGIN}/app/`]);
  w.setNetwork(async () => { throw new TypeError("offline"); });
  assert.equal(await w.request("./", { mode: "navigate" }), `cache:${ORIGIN}/app/`);
  assert.equal(await w.request("./?x=1", { mode: "navigate" }), `cache:${ORIGIN}/app/index.html`);

  assert.equal(w.request("https://0.peerjs.com/peerjs/id"), undefined);
  assert.equal(w.request("index.html", { method: "POST" }), undefined);
});

test("S29 AC-5: the dev worker caches nothing and never answers", async () => {
  const w = worker("dev", ["index.html"]);
  await w.lifecycle("install");
  assert.deepEqual(w.calls.opened, []);
  assert.equal(w.calls.skipWaiting, 1);
  assert.equal(w.request("./", { mode: "navigate" }), undefined);
  assert.equal(w.request("src/main.js"), undefined);
  await w.lifecycle("activate");
  assert.deepEqual([...w.store.keys()], []);
});

test("S29 AC-6: registerServiceWorker registers sw.js only in a secure context", async () => {
  const fake = () => {
    const calls = [];
    return { calls, serviceWorker: { register: async (u) => { calls.push(u); } } };
  };
  const ok = fake();
  registerServiceWorker({ navigator: ok, isSecureContext: true });
  assert.deepEqual(ok.calls, ["sw.js"]);
  const insecure = fake();
  registerServiceWorker({ navigator: insecure, isSecureContext: false });
  assert.deepEqual(insecure.calls, []);
  registerServiceWorker({ navigator: {}, isSecureContext: true });
  // A rejected registration is caught.
  registerServiceWorker({ navigator: { serviceWorker: { register: () => Promise.reject(new Error("no")) } }, isSecureContext: true });
  await new Promise((r) => setTimeout(r));
  // node has navigator but no navigator.serviceWorker, so the defaults register nothing.
  assert.equal(globalThis.navigator?.serviceWorker, undefined);
  registerServiceWorker();
  assert.equal(globalThis.document, undefined);
});

test("S29 AC-7: the phone row clears the home bar", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.row \{\s*scroll-margin-bottom: calc\(4rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.doesNotMatch(css, /scroll-margin-bottom: 4rem;/);
});
