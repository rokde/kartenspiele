import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { rewrite, check } from "../scripts/cache-bust.js";

const V = "abc123";
const CLI = new URL("../scripts/cache-bust.js", import.meta.url).pathname;

test("AC-1: rewrites static, side-effect, export-from and dynamic imports", () => {
  const src = [
    `import { a } from "./a.js";`,
    `import {\n  b,\n  c,\n} from '../b.js';`,
    `import "./side.js";`,
    `import * as ns from "./ns.js";`,
    `export { x } from "./a.js";`,
    `export * from "./a.js";`,
    `const m = await import("./a.js");`,
    `const n = import('./a.js');`,
    `const keep = 1; // text`,
  ].join("\n");
  const out = rewrite(src, "js", V);
  assert.equal(out, src.replace(/\.js(["'])/g, `.js?v=${V}$1`));
});

test("AC-2: rewrites new URL(..., import.meta.url)", () => {
  assert.equal(
    rewrite(`s.src = new URL("../../vendor/peerjs/peerjs.min.js", import.meta.url).href;`, "js", V),
    `s.src = new URL("../../vendor/peerjs/peerjs.min.js?v=abc123", import.meta.url).href;`,
  );
});

test("AC-3: rewrites index.html link and script, keeps data icon", () => {
  const html = [
    `<link rel="icon" href="data:,">`,
    `<link rel="stylesheet" href="styles.css">`,
    `<script src="vendor/cardmeister/elements.cardmeister.full.js"></script>`,
    `<script type="module" src="src/main.js"></script>`,
  ].join("\n");
  const out = rewrite(html, "html", V);
  assert.equal(out, [
    `<link rel="icon" href="data:,">`,
    `<link rel="stylesheet" href="styles.css?v=abc123">`,
    `<script src="vendor/cardmeister/elements.cardmeister.full.js?v=abc123"></script>`,
    `<script type="module" src="src/main.js?v=abc123"></script>`,
  ].join("\n"));
});

test("AC-4: leaves versioned, absolute and bare URLs alone and is idempotent", () => {
  const js = [
    `import a from "./a.js?v=old";`,
    `import b from "./b.js?x=1";`,
    `import c from "https://x.test/c.js";`,
    `import d from "//x.test/d.js";`,
    `import e from "/e.js";`,
    `import f from "node:fs";`,
    `import g from "bare";`,
  ].join("\n");
  assert.equal(rewrite(js, "js", V), js);
  const html = `<link rel="stylesheet" href="https://x.test/a.css"><script src="/b.js"></script><script src="//x/c.js"></script><script src="d.js?v=1"></script>`;
  assert.equal(rewrite(html, "html", V), html);
  const once = rewrite(`import a from "./a.js";`, "js", V);
  assert.equal(rewrite(once, "js", V), once);
});

function makeSite() {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  mkdirSync(join(dir, "src/core"), { recursive: true });
  mkdirSync(join(dir, "src/games/x"), { recursive: true });
  writeFileSync(join(dir, "index.html"), `<link rel="stylesheet" href="styles.css"><script type="module" src="src/main.js"></script>`);
  writeFileSync(join(dir, "src/main.js"), `import { a } from "./core/a.js";\nimport("./games/x/b.js");\n`);
  writeFileSync(join(dir, "src/core/a.js"), `export { z } from "./z.js";\ns.src = new URL("../../vendor/p.js", import.meta.url).href;\n`);
  writeFileSync(join(dir, "src/games/x/b.js"), `import {\n  q,\n} from "../../core/a.js";\n`);
  return dir;
}

test("AC-5: CLI rewrites a site folder in place", () => {
  const dir = makeSite();
  const r = spawnSync("node", [CLI, dir, V], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, "index.html"), "utf8"), /styles\.css\?v=abc123.*src\/main\.js\?v=abc123/);
  assert.match(readFileSync(join(dir, "src/main.js"), "utf8"), /a\.js\?v=abc123.*b\.js\?v=abc123/s);
  assert.match(readFileSync(join(dir, "src/core/a.js"), "utf8"), /z\.js\?v=abc123[\s\S]*p\.js\?v=abc123/);
  assert.match(readFileSync(join(dir, "src/games/x/b.js"), "utf8"), /a\.js\?v=abc123/);
  assert.deepEqual(check(readFileSync(join(dir, "src/main.js"), "utf8"), "js"), []);
});

test("AC-6: check finds unhandled forms and CLI fails", () => {
  assert.deepEqual(check(`const u = "./x.js";`, "js"), ["./x.js"]);
  assert.deepEqual(check(`<script src="a.js"></script>`, "html"), ["a.js"]);
  const dir = makeSite();
  writeFileSync(join(dir, "src/bad.js"), `const u = "./x.js";\n`);
  const r = spawnSync("node", [CLI, dir, V], { encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /bad\.js/);
  const missing = spawnSync("node", [CLI, dir], { encoding: "utf8" });
  assert.notEqual(missing.status, 0);
});

test("AC-7: workflow runs cache-bust after Collect site files, before upload", () => {
  const y = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const collect = y.indexOf("Collect site files");
  const bust = y.indexOf(`node scripts/cache-bust.js _site "\${{ github.sha }}"`);
  const upload = y.indexOf("upload-pages-artifact");
  assert.ok(collect > -1 && collect < bust && bust < upload);
});

test("AC-8: repo sources have no ?v=", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /\?v=/);
  const r = spawnSync("grep", ["-rl", "?v=", "src"], { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" });
  assert.equal(r.stdout, "");
});
