import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { APP_TITLE } from "../src/main.js";

const root = new URL("../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

test("APP_TITLE is Karten", () => {
  assert.equal(APP_TITLE, "Karten");
});

test("index.html loads src/main.js as a module", () => {
  assert.match(html, /<script type="module" src="(\.?\/)?src\/main\.js"><\/script>/);
});

test("index.html body does not contain Karten", () => {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  assert.doesNotMatch(body, /Karten/);
});

test("README.md gives the start and test commands", () => {
  const readme = readFileSync(new URL("README.md", root), "utf8");
  assert.ok(readme.includes("python3 -m http.server 8000"));
  assert.ok(readme.includes("node --test"));
});

test("python3 -m http.server serves the page, styles, and modules", { timeout: 10000 }, async (t) => {
  // Port 0 lets the OS select a free port; the test reads it from the server log.
  const server = spawn("python3", ["-u", "-m", "http.server", "0", "--bind", "127.0.0.1"], {
    cwd: root,
  });
  t.after(() => server.kill());
  let log = "";
  server.stdout.setEncoding("utf8");
  while (!/port (\d+)/.test(log)) {
    const [chunk] = await once(server.stdout, "data");
    log += chunk;
  }
  const port = log.match(/port (\d+)/)[1];
  for (const path of ["/", "/src/main.js", "/styles.css", "/src/core/cards.js", "/src/core/card-view.js"]) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(res.status, 200, path);
  }
});
