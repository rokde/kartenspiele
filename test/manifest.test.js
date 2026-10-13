import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const manifest = JSON.parse(read("manifest.webmanifest"));
const html = read("index.html");
const css = read("styles.css");
const relative = (url) => !url.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(url);

// Width and height from the IHDR chunk, after the 8-byte signature and the chunk length and type.
function pngSize(path) {
  const b = readFileSync(join(root, path));
  assert.deepEqual([...b.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], path);
  assert.equal(b.toString("ascii", 12, 16), "IHDR", path);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

const tag = (name, attr, value) => {
  const el = html.match(new RegExp(`<${name}\\b[^>]*\\b${attr}="${value}"[^>]*>`));
  assert.ok(el, `${name} ${attr}=${value}`);
  return el[0];
};
const attr = (el, name) => el.match(new RegExp(`\\b${name}="([^"]*)"`))[1];

test("AC-1: the manifest has the required fields with relative start_url and scope", () => {
  assert.equal(manifest.name, "Kartenspiele");
  assert.equal(manifest.short_name, "Karten");
  assert.equal(manifest.lang, "de");
  assert.equal(manifest.display, "standalone");
  // Coordinator override: no orientation lock, so desktop and tablet landscape stay possible.
  assert.ok(manifest.orientation === undefined || manifest.orientation === "any");
  assert.equal(manifest.background_color, "#fdf3e1");
  assert.equal(manifest.theme_color, "#fdf3e1");
  for (const key of ["start_url", "scope", "id"]) assert.ok(relative(manifest[key]), key);
});

test("AC-2: the manifest icons exist as PNG files with the declared size", () => {
  const want = ["192x192 any", "512x512 any", "512x512 maskable"];
  assert.deepEqual(manifest.icons.map((i) => `${i.sizes} ${i.purpose}`).sort(), want.sort());
  for (const icon of manifest.icons) {
    assert.equal(icon.type, "image/png");
    assert.ok(relative(icon.src), icon.src);
    assert.equal(pngSize(icon.src), icon.sizes);
  }
});

test("AC-3: the apple-touch-icon is 180x180 and the SVG sources exist", () => {
  assert.equal(pngSize("assets/icons/apple-touch-icon.png"), "180x180");
  assert.ok(existsSync(join(root, "assets/icons/icon.svg")));
  assert.ok(existsSync(join(root, "assets/icons/icon-maskable.svg")));
});

test("AC-4: index.html links the manifest and the icon, and has the app meta tags", () => {
  const files = [attr(tag("link", "rel", "manifest"), "href"), attr(tag("link", "rel", "apple-touch-icon"), "href")];
  assert.deepEqual(files, ["manifest.webmanifest", "assets/icons/apple-touch-icon.png"]);
  for (const f of files) assert.ok(existsSync(join(root, f)), f);
  assert.equal(attr(tag("meta", "name", "theme-color"), "content"), "#fdf3e1");
  assert.equal(attr(tag("meta", "name", "apple-mobile-web-app-capable"), "content"), "yes");
  assert.equal(attr(tag("meta", "name", "apple-mobile-web-app-title"), "content"), "Karten");
  tag("meta", "name", "apple-mobile-web-app-status-bar-style");
  assert.match(attr(tag("meta", "name", "viewport"), "content"), /viewport-fit=cover/);
});

test("AC-5: main and the mute button keep clear of the safe-area insets", () => {
  const rule = (src, sel) => src.match(new RegExp(`(?:^|\\n)\\s*${sel} \\{([^}]*)\\}`))[1];
  const phoneStart = css.indexOf("@media (width < 48rem) {");
  const phone = css.slice(phoneStart, css.indexOf("\n}\n", phoneStart));
  assert.match(rule(css, "\\.mute-button"), /bottom: calc\(0\.75rem \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(rule(css, "\\.mute-button"), /right: calc\(0\.75rem \+ env\(safe-area-inset-right, 0px\)\);/);
  for (const main of [rule(css, "main"), rule(phone, "main")]) {
    for (const side of ["bottom", "left", "right"]) assert.match(main, new RegExp(`env\\(safe-area-inset-${side}, 0px\\)`));
  }
});

test("AC-6: the workflow copies the manifest, and cache-bust passes and keeps its links unversioned", () => {
  assert.match(read(".github/workflows/pages.yml"), /cp -r [^\n]*\bmanifest\.webmanifest\b[^\n]*_site\//);
  const site = mkdtempSync(join(tmpdir(), "site-"));
  for (const p of ["index.html", "manifest.webmanifest", "assets/icons", "src"]) cpSync(join(root, p), join(site, p), { recursive: true });
  const r = spawnSync("node", [join(root, "scripts/cache-bust.js"), site, "abc123"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const out = readFileSync(join(site, "index.html"), "utf8");
  assert.match(out, /styles\.css\?v=abc123/);
  assert.match(out, /href="manifest\.webmanifest"/);
  assert.match(out, /href="assets\/icons\/apple-touch-icon\.png"/);
});
