import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SOUNDS, createSound } from "../src/core/sound.js";
import * as rules from "../src/games/offiziersskat/rules.js";
import { aiMove } from "../src/games/offiziersskat/ai.js";
import * as game from "../src/games/offiziersskat/index.js";
import { renderMenu, renderCredits } from "../src/core/menu-view.js";
import { listGames } from "../src/core/registry.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const memory = () => {
  const items = {};
  return { getItem: (k) => items[k] ?? null, setItem: (k, v) => { items[k] = String(v); } };
};
const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); } };
// A fake Audio: it records each created file and each play() call.
const fakeAudio = (result = Promise.resolve()) => {
  const log = [];
  const create = (src) => ({ play: () => (log.push(src), result), pause() {} });
  return { log, create };
};

test("AC-1: sound.js maps the 4 events to the 4 files, and the files exist", () => {
  assert.deepEqual(SOUNDS, {
    play: "assets/sounds/card-play.mp3",
    deal: "assets/sounds/shuffle.mp3",
    win: "assets/sounds/win.mp3",
    lose: "assets/sounds/lose.mp3",
  });
  for (const file of Object.values(SOUNDS)) assert.ok(existsSync(new URL(file, root)), file);
  const audio = fakeAudio();
  const sound = createSound(memory(), { createAudio: audio.create });
  sound.unlock();
  for (const event of ["unknown", "toString", "__proto__", undefined]) assert.doesNotThrow(() => sound.play(event));
  assert.deepEqual(audio.log, []);
});

test("AC-2: the mute setting defaults to off, persists, and survives a broken storage", () => {
  const store = memory();
  assert.equal(createSound(store).isMuted(), false);
  createSound(store).setMuted(true);
  assert.equal(createSound(store).isMuted(), true);
  createSound(store).setMuted(false);
  assert.equal(createSound(store).isMuted(), false);
  assert.equal(createSound(throwing).isMuted(), false);
  assert.doesNotThrow(() => createSound(throwing).setMuted(true));
  assert.equal(createSound(null).isMuted(), false);
});

test("AC-3: play creates audio only after unlock and when not muted", () => {
  const audio = fakeAudio();
  const sound = createSound(memory(), { createAudio: audio.create });
  sound.play("play");
  assert.deepEqual(audio.log, []);
  sound.unlock();
  sound.setMuted(true);
  sound.play("win");
  assert.deepEqual(audio.log, []);
  sound.setMuted(false);
  for (const event of ["play", "deal", "win", "lose"]) sound.play(event);
  assert.deepEqual(audio.log, Object.values(SOUNDS));
});

test("AC-3: a rejected play() gives no unhandled rejection and no console output", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const logged = [];
  const original = { error: console.error, warn: console.warn, log: console.log };
  for (const name of Object.keys(original)) console[name] = (...args) => logged.push(args);
  try {
    const audio = fakeAudio(Promise.reject(new DOMException("blocked", "NotAllowedError")));
    const sound = createSound(memory(), { createAudio: audio.create });
    sound.unlock();
    sound.play("play");
    sound.play("deal");
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    Object.assign(console, original);
    process.off("unhandledRejection", onUnhandled);
  }
  assert.deepEqual(unhandled, []);
  assert.deepEqual(logged, []);
});

// Plays full games with the computer move for both sides, until one game ends with each result.
function endings() {
  const found = {};
  for (let seed = 1; !(found.human && found.computer); seed++) {
    let state = rules.newGame(seed);
    while (!rules.isOver(state)) {
      const next = rules.applyMove(state, aiMove(state, () => 0.5));
      if (rules.isOver(next)) found[rules.winner(next)] ??= [state, next];
      state = next;
    }
  }
  return found;
}

test("AC-4: soundEvents gives deal, play, win, lose, and nothing for an announcement", () => {
  const dealt = rules.newGame(3, "computer");
  assert.equal(dealt.vorhand, "human");
  assert.deepEqual(game.soundEvents(null, dealt), ["deal"]);
  assert.deepEqual(game.soundEvents(null, game.newGame(4, "human")), ["deal"]);
  const announced = rules.applyMove(dealt, { type: "announce", game: "herz" });
  assert.deepEqual(game.soundEvents(dealt, announced), []);
  const humanCard = rules.applyMove(announced, aiMove(announced));
  assert.equal(announced.turn, "human");
  assert.deepEqual(game.soundEvents(announced, humanCard), ["play"]);
  const computerCard = rules.applyMove(humanCard, aiMove(humanCard));
  assert.equal(humanCard.turn, "computer");
  assert.deepEqual(game.soundEvents(humanCard, computerCard), ["play"]);
  const { human, computer } = endings();
  assert.deepEqual(game.soundEvents(...human), ["play", "win"]);
  assert.deepEqual(game.soundEvents(...computer), ["play", "lose"]);
  const done = computer[1];
  assert.deepEqual(game.soundEvents(done, game.nextGame(done, 9)), ["deal"]);
  assert.deepEqual(game.soundEvents(null, game.restart(humanCard, 9)), ["deal"]);
});

test("AC-5: index.html has a mute button with aria-pressed and a German label outside main", () => {
  const html = read("index.html");
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  const outside = body.replace(/<main id="app">[\s\S]*<\/main>/, "");
  assert.match(outside, /<button type="button"[^>]*id="mute"[^>]*aria-pressed="false"[^>]*>[\s\S]*Ton an[\s\S]*<\/button>/);
});

const SOUND_LINKS = [
  ["https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468", "freesound_community"],
  ["https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468", "Pixabay"],
  ["https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662", "freesound_community"],
  ["https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662", "Pixabay"],
  ["https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297", "freesound_community"],
  ["https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297", "Pixabay"],
  ["https://pixabay.com/de/users/ribhavagrawal-39286533/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571", "Ribhav Agrawal"],
  ["https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571", "Pixabay"],
];

test("AC-6: the menu has a Credits button, and the credits list CardMeister and the 4 sounds", () => {
  assert.match(renderMenu(listGames()), /<button type="button"[^>]*data-action="credits"[^>]*>Credits<\/button>/);
  const html = renderCredits();
  assert.match(html, /<button type="button"[^>]*data-action="back"[^>]*>Zurück<\/button>/);
  const anchors = [...html.matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)];
  for (const [, attrs] of anchors) {
    assert.match(attrs, /target="_blank"/);
    assert.match(attrs, /rel="noopener noreferrer"/);
  }
  const links = anchors.map(([, attrs, text]) => [attrs.match(/href="([^"]*)"/)[1], text]);
  assert.deepEqual(links, [["https://cardmeister.github.io/", "CardMeister"], ...SOUND_LINKS]);
  assert.match(html, /Unlicense/);
});

test("AC-6: the README lists the same 4 sound credits", () => {
  const readme = read("README.md");
  for (const [href, text] of SOUND_LINKS) assert.ok(readme.includes(`[${text}](${href})`), href);
});
