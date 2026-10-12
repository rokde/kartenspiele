import { listGames, getGame } from "./core/registry.js";
import { renderMenu, renderGameScreen, renderCredits, renderRules, renderRoomChoice, renderRoom, renderJoinForm } from "./core/menu-view.js";
import { makeRoomCode, normalizeRoomCode } from "./core/room-code.js";
import { save, load, isSaveOf } from "./core/storage.js";
import { createSound, timeSounds } from "./core/sound.js";
import { createMotion, domView } from "./core/motion.js";

export const APP_TITLE = "Karten";

// Reading localStorage throws when the browser blocks it. Then the game runs without a save.
const browserStorage = () => { try { return localStorage; } catch { return null; } };

// The app controller. Tests give fakes for the browser globals.
export function startApp({
  document = globalThis.document,
  storage: store = browserStorage(),
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
  addEventListener = globalThis.addEventListener,
  reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches,
  seed = () => crypto.getRandomValues(new Uint32Array(1))[0],
  // Loads link.js (and so PeerJS) only when a player opens or joins a room.
  connect = (role, code, signal) => import("./core/link.js").then((link) => link[role](code, signal)),
  clipboard = globalThis.navigator?.clipboard,
} = {}) {
  const app = document.getElementById("app");
  const show = (html) => {
    app.innerHTML = html;
    // The clicked button is gone, so move the keyboard focus to the new screen.
    app.querySelector("button")?.focus();
  };
  const menuHtml = (note = "") => `<h1>${APP_TITLE}</h1>${note}${renderMenu(listGames())}`;

  let game;
  let state;
  let timer;
  // A trick that the motion swept away stays hidden. A counter drops the end of an old run.
  let cleared = false;
  let runs = 0;
  // True while the rules page shows on top of the running game.
  let rulesFromGame = false;
  const motion = createMotion({ reduced: reducedMotion, setTimeout, clearTimeout });
  const saved = (g) => g.restore(load(store, g.id));
  const sound = createSound(store, { setTimeout, clearTimeout });
  sound.preload();
  for (const type of ["pointerdown", "keydown", "click"]) document.addEventListener(type, sound.unlock, { capture: true });
  const mute = document.getElementById("mute");
  const showMute = () => {
    mute.setAttribute("aria-pressed", String(sound.isMuted()));
    mute.querySelector(".mute-button__label").textContent = sound.isMuted() ? "Ton aus" : "Ton an";
    mute.querySelector(".mute-button__icon").textContent = sound.isMuted() ? "🔇" : "🔊";
  };
  mute.addEventListener("click", () => {
    sound.setMuted(!sound.isMuted());
    showMute();
  });
  showMute();
  const paint = () => {
    save(store, game.id, state);
    show(renderGameScreen(game, state, { trickCleared: cleared }));
    (app.querySelector("[data-announce], [data-stack], [data-action=next]") ?? app.querySelector(".status"))?.focus();
  };
  // A short pause, so that the human can see each computer card.
  const computerTurn = () => {
    if (state.trump !== null && state.turn === "computer" && !game.isOver(state)) {
      timer = setTimeout(() => {
        go(game.applyMove(state, game.aiMove(state)));
      }, 800);
    }
  };
  const showGame = () => {
    paint();
    computerTurn();
  };
  const view = domView(app, paint, () => { cleared = true; });
  // The resume on page load does not come here, so it plays no sound and no motion.
  // A click during a run starts a new run. The new run finishes the open animations first.
  const go = async (next, prev = state) => {
    clearTimeout(timer);
    const run = ++runs;
    sound.stop();
    state = next;
    cleared = false;
    const motions = [];
    const done = motion.run(game.motionEvents(prev, next), view, ({ type }, delay, duration) => motions.push({ type, delay, duration }));
    for (const [event, timing] of timeSounds(game.soundEvents(prev, next), motions)) sound.play(event, timing);
    await done;
    // The computer waits until the animation is done.
    if (run === runs) computerTurn();
  };

  // The open room: its code, an abort for the wait, and the link when it is open.
  let room = null;
  const leaveRoom = () => {
    room?.abort.abort();
    room?.link?.close();
    room = null;
  };
  const openRoom = async (role, code) => {
    const current = room = { code, abort: new AbortController() };
    const host = role === "host";
    show(renderRoom(code, host ? "Warte auf Mitspieler …" : "Verbinde …", { copy: host }));
    try {
      const link = await connect(role, code, current.abort.signal);
      if (room !== current) return link.close();
      current.link = link;
      show(renderRoom(code, "Verbunden", { copy: host }));
    } catch {
      // shortcut: one message for all errors, S19 adds a message for each error.
      if (room === current) show(renderRoom(code, "Keine Verbindung. Bitte versuche es noch einmal.", { copy: host }));
    }
  };

  // The player leaves the game screen. No old timer or run may change the game later.
  const leave = () => {
    clearTimeout(timer);
    motion.cancel();
    sound.stop();
    runs++;
  };

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "back" && rulesFromGame) {
      rulesFromGame = false;
      showGame();
    } else if (button.dataset.action === "back") {
      leave();
      leaveRoom();
      show(menuHtml());
    } else if (button.dataset.action === "rules") {
      leave();
      rulesFromGame = true;
      show(renderRules(game));
    } else if (button.dataset.rules) {
      show(renderRules(getGame(button.dataset.rules)));
    } else if (button.dataset.online) {
      show(renderRoomChoice());
    } else if (button.dataset.action === "host") {
      openRoom("host", makeRoomCode());
    } else if (button.dataset.action === "join") {
      show(renderJoinForm());
      app.querySelector("#room-code")?.focus();
    } else if (button.dataset.action === "join-code") {
      // The form must not submit and reload the page. Enter in the field also clicks this button.
      event.preventDefault();
      const code = normalizeRoomCode(app.querySelector("#room-code")?.value);
      if (code) openRoom("join", code);
      else {
        show(renderJoinForm("Ungültiger Code, z. B. KREUZ-42"));
        app.querySelector("#room-code")?.focus();
      }
    } else if (button.dataset.action === "copy") {
      clipboard?.writeText(room.code).then(() => { button.textContent = "Kopiert ✓"; }, () => {});
    } else if (button.dataset.action === "credits") {
      show(renderCredits());
    } else if (button.dataset.gameId) {
      game = getGame(button.dataset.gameId);
      state = saved(game);
      cleared = true;
      if (state) showGame();
      else go(game.newGame(seed()), null);
    } else if (button.dataset.action === "new") {
      clearTimeout(timer);
      go(game.restart(state, seed()), null);
    } else if (button.dataset.action === "next") {
      go(game.nextGame(state, seed()));
    } else if (button.dataset.announce) {
      go(game.applyMove(state, { type: "announce", game: button.dataset.announce }));
    } else if (button.dataset.stack) {
      go(game.applyMove(state, { type: "play", stack: Number(button.dataset.stack) }));
    }
  });

  // Another tab changed the save. This tab stops and shows the menu, so it never writes an old state.
  addEventListener("storage", (event) => {
    if (!game || !isSaveOf(event, game.id) || !(rulesFromGame || app.querySelector(".game-screen"))) return;
    leave();
    rulesFromGame = false;
    show(menuHtml(`<p class="status" role="status">Das Spiel wurde in einem anderen Tab weitergespielt.</p>`));
  });

  document.title = APP_TITLE;
  app.innerHTML = menuHtml();
  // Resume the first game with a valid save.
  game = listGames().find((g) => (state = saved(g)));
  cleared = true;
  if (game) showGame();
}

if (typeof document !== "undefined") startApp();
