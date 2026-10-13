// Adds ?v=<version> to relative CSS/JS URLs in a deploy copy of the site.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const RELATIVE = String.raw`(?![a-z][a-z0-9+.-]*:|/)[^"'?#\s]+`;
// from "x", import "x", import("x"), new URL("x", ...): quoted relative .js specifier
const JS_SPECIFIER = /(\bfrom\s*|\bimport\s*\(?\s*|\bnew URL\(\s*)(["'])(\.{1,2}\/[^"'?]*\.js)\2/g;
const HTML_TAG = /<(link|script)\b[^>]*>/g;
const HTML_ATTR = new RegExp(String.raw`(\b(?:href|src)\s*=\s*)(["'])(${RELATIVE})\2`, "g");

export function rewrite(text, kind, version) {
  const tag = `?v=${version}`;
  if (kind === "js") return text.replace(JS_SPECIFIER, (_, pre, q, url) => `${pre}${q}${url}${tag}${q}`);
  return text.replace(HTML_TAG, (el, name) => {
    // shortcut: manifest and icons are not versioned, add them when icons change often
    if (name === "link" && !/\brel\s*=\s*["']?stylesheet/.test(el)) return el;
    return el.replace(HTML_ATTR, (_, pre, q, url) => `${pre}${q}${url}${tag}${q}`);
  });
}

// Lists relative .js/.css URLs without a query. Broader than rewrite, so it catches unhandled forms.
export function check(text, kind) {
  const re = kind === "js"
    ? /["'](\.{1,2}\/[^"'?]*\.js)["']/g
    : new RegExp(String.raw`\b(?:href|src)\s*=\s*["'](${RELATIVE}\.(?:js|css))["']`, "g");
  return [...text.matchAll(re)].map((m) => m[1]);
}

function jsFiles(dir) {
  return readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => join(dir, f));
}

// The app shell for sw.js: the exact URLs that the busted site requests. PeerJS is left out, online play needs the network.
export function precacheList(siteDir, version) {
  const files = (dir) => readdirSync(join(siteDir, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile()).map((e) => relative(siteDir, join(e.parentPath, e.name)).split(sep).join("/")).sort();
  const tag = `?v=${version}`;
  return [
    "./", "index.html", `styles.css${tag}`,
    ...files("src").filter((f) => f.endsWith(".js")).map((f) => f + tag),
    `vendor/cardmeister/elements.cardmeister.full.js${tag}`,
    "manifest.webmanifest", ...files("assets/icons"), ...files("assets/sounds"),
  ];
}

function writeWorker(siteDir, version) {
  const file = join(siteDir, "sw.js");
  let text = readFileSync(file, "utf8");
  for (const [line, value] of [[`const VERSION = "dev";`, version], ["const PRECACHE = [];", precacheList(siteDir, version)]]) {
    if (!text.includes(line)) throw new Error(`${file}: placeholder line not found: ${line}`);
    text = text.replace(line, () => `${line.split(" = ")[0]} = ${JSON.stringify(value)};`);
  }
  writeFileSync(file, text);
}

export function run(siteDir, version) {
  writeWorker(siteDir, version);
  const files = [[join(siteDir, "index.html"), "html"], ...jsFiles(join(siteDir, "src")).map((f) => [f, "js"])];
  const bad = [];
  for (const [file, kind] of files) {
    const out = rewrite(readFileSync(file, "utf8"), kind, version);
    writeFileSync(file, out);
    for (const url of check(out, kind)) bad.push(`${file}: ${url}`);
  }
  return bad;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [siteDir, version] = process.argv.slice(2);
  if (!siteDir || !version) {
    console.error("usage: node scripts/cache-bust.js <siteDir> <version>");
    process.exit(1);
  }
  let bad;
  try {
    bad = run(siteDir, version);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
  if (bad.length) {
    console.error(`Unversioned URLs:\n${bad.join("\n")}`);
    process.exit(1);
  }
}
