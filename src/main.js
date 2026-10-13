import { listGames, getGame } from "./core/registry.js";
import { renderMenu, renderGameScreen, renderCredits, renderRules, renderRoomChoice, renderRoom, renderJoinForm, renderLeft } from "./core/menu-view.js";
import { host as hostLink, join as joinLink, connectionMessage } from "./core/link.js";
import { makeRoomCode, normalizeRoomCode } from "./core/room-code.js";
import { save, load, isSaveOf } from "./core/storage.js";
import { createSound, timeSounds } from "./core/sound.js";
import { createMotion, domView } from "./core/motion.js";

export const APP_TITLE = "Karten";
export const JOIN_TIMEOUT = 15000;

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
  // link.js loads PeerJS only when a player opens or joins a room.
  // The host gives each later guest to `more`.
  connect = (role, code, signal, more) => (role === "host" ? hostLink(code, signal, more) : joinLink(code, signal)),
  clipboard = globalThis.navigator?.clipboard,
} = {}) {
  const app = document.getElementById("app");
  const show = (html, focus) => {
    app.innerHTML = html;
    // The clicked button is gone, so move the keyboard focus to the new screen.
    app.querySelector("button")?.focus(focus);
  };
  const menuHtml = (note = "") => `<h1>${APP_TITLE}</h1>${note}${renderMenu(listGames())}`;

  let game;
  let state;
  let timer;
  // A trick that the motion swept away stays hidden. A counter drops the end of an old run.
  let cleared = false;
  let runs = 0;
  // True while the own row has cards to play. Only the change to true scrolls the row into view.
  let myTurn = false;
  // True while the rules page shows on top of the running game.
  let rulesFromGame = false;
  // True while the game screen asks before "Neues Spiel".
  let confirming = false;
  // The online game: { role: "host" | "guest", session }. The guest state is the view of the host.
  let online = null;
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
    if (!online) save(store, game.id, state);
    const html = renderGameScreen(game, state, { trickCleared: cleared, online: online?.role, left: online?.left, confirmNew: confirming });
    const scroll = !confirming && html.includes("row--playing") && !myTurn;
    myTurn = html.includes("row--playing");
    // The first button is at the top. Its focus must not scroll the page away from the table.
    show(html, { preventScroll: true });
    if (confirming) return app.querySelector("[data-action=new-cancel]")?.focus({ preventScroll: true });
    (app.querySelector("[data-announce], [data-stack], [data-move], [data-action=next]") ?? app.querySelector(".status"))?.focus({ preventScroll: scroll });
    if (scroll) app.querySelector(".row--playing").scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  };
  // A short pause, so that the human can see each computer card.
  // Online, the host runs the computer seats of a game with `computerTurn`.
  const computerTurn = () => {
    const due = game.computerTurn ? online?.role !== "guest" && !online?.left && game.computerTurn(state)
      : !online && state.trump !== null && state.turn === "computer" && !game.isOver(state);
    if (due) {
      timer = setTimeout(() => {
        if (online) online.session.ai();
        else go(game.applyMove(state, game.aiMove(state)));
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

  // The open room: its code, an abort for the wait, and the open links. The first link ends the peer.
  let room = null;
  const closeLinks = (current) => [...(current?.links ?? [])].reverse().forEach((link) => link.close());
  // Clear the room first: our own close event and late link messages must find no room.
  const leaveRoom = () => {
    const current = room;
    room = null;
    online = null;
    current?.abort.abort();
    closeLinks(current);
  };
  // Another player left. The game stops for all, and the screen keeps only the way back to the menu.
  const peerLeft = () => {
    const current = room;
    leave();
    room = null;
    if (online) online.left = true;
    closeLinks(current);
    if (state && online) paint();
    else show(renderLeft());
    app.querySelector(".leave-notice button")?.focus();
  };
  const guestCount = (current) => `${current.links.length} von ${game.maxGuests} Mitspielern im Raum`;
  // A later guest joins the room of a game with more than one guest, until the host starts.
  const addGuest = (current, link) => {
    if (room !== current || online || !current.links.length || current.links.length >= game.maxGuests) return link.close();
    current.links.push(link);
    link.onClose(current.live(peerLeft));
    roomStatus(guestCount(current));
  };
  // The host deals the first game. hostSession does not report this start state, so the host renders it here.
  const startOnline = (role, current) => {
    state = null;
    cleared = true;
    if (role === "guest") {
      online = { role, session: game.guestSession(current.links[0], current.live(go)) };
      return;
    }
    const first = game.newOnlineGame(seed(), current.links.length);
    online = { role, session: game.hostSession(current.links, first, current.live(go)) };
    go(first, null);
  };
  const move = (m) => (online ? online.session.move(m) : go(game.applyMove(state, m)));
  // Only the text changes, so the focus stays and a screen reader reads the live status.
  const roomStatus = (text) => { app.querySelector(".room [role=status]").textContent = text; };
  // The host waits for a person, so only the join has a timeout. The host tries up to 3 new codes.
  const openRoom = async (role, code, retries = 3) => {
    const current = room = { code, abort: new AbortController(), links: [] };
    current.live = (fn) => (...args) => { if (room === current) fn(...args); };
    const host = role === "host";
    const lobby = (game.maxGuests ?? 1) > 1;
    show(renderRoom(code, host ? "Warte auf Mitspieler …" : "Verbinde …", { copy: host }));
    const timeout = host ? null : setTimeout(() => {
      if (room !== current) return;
      const error = Object.assign(new Error("No answer from the room"), { type: "join-timeout" });
      current.abort.abort(error);
      roomStatus(connectionMessage(error));
    }, JOIN_TIMEOUT);
    try {
      const link = await connect(role, code, current.abort.signal, lobby ? (more) => addGuest(current, more) : undefined);
      clearTimeout(timeout);
      if (room !== current || current.abort.signal.aborted) return link.close();
      current.links.unshift(link);
      link.onClose(current.live(peerLeft));
      if (host && lobby) {
        // The host starts when the room has enough players. Free seats get a computer.
        show(renderRoom(code, guestCount(current), { copy: true, start: true }));
        app.querySelector("[data-action=start]").focus();
        return;
      }
      roomStatus(lobby ? "Verbunden. Warte auf den Start …" : "Verbunden");
      startOnline(host ? "host" : "guest", current);
    } catch (error) {
      clearTimeout(timeout);
      if (room !== current) return;
      if (host && error?.type === "unavailable-id" && retries > 0) {
        let next;
        do next = makeRoomCode(); while (next === code);
        return openRoom(role, next, retries - 1);
      }
      roomStatus(connectionMessage(error));
    }
  };

  // The player leaves the game screen. No old timer or run may change the game later.
  const leave = () => {
    myTurn = false;
    confirming = false;
    clearTimeout(timer);
    motion.cancel();
    sound.stop();
    runs++;
  };

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    // The game must not go on behind the question.
    if (confirming && !["new-confirm", "new-cancel", "back", "rules"].includes(button.dataset.action)) return;
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
      game = getGame(button.dataset.online);
      show(renderRoomChoice(game.onlineLabel));
    } else if (button.dataset.action === "host") {
      openRoom("host", makeRoomCode());
    } else if (button.dataset.action === "start") {
      if (room?.links.length && !online) startOnline("host", room);
    } else if (button.dataset.action === "join") {
      show(renderJoinForm());
      app.querySelector("#room-code")?.focus();
    } else if (button.dataset.action === "join-code") {
      // The form must not submit and reload the page. Enter in the field also clicks this button.
      event.preventDefault();
      const input = app.querySelector("#room-code");
      const code = normalizeRoomCode(input.value);
      if (code) openRoom("join", code);
      else {
        // The typed text stays, so the player can correct it.
        app.querySelector(".room__hint").textContent = "Ungültiger Code, z. B. KREUZ-42";
        input.focus();
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
      // The computer must not play behind the question.
      leave();
      confirming = true;
      paint();
    } else if (button.dataset.action === "new-cancel") {
      confirming = false;
      showGame();
      app.querySelector("[data-action=new]")?.focus({ preventScroll: true });
    } else if (button.dataset.action === "new-confirm") {
      confirming = false;
      go(game.restart(state, seed()), null);
    } else if (button.dataset.action === "next") {
      if (online) online.session.next(seed());
      else go(game.nextGame(state, seed()));
    } else if (button.dataset.announce) {
      move({ type: "announce", game: button.dataset.announce });
    } else if (button.dataset.stack) {
      move({ type: "play", stack: Number(button.dataset.stack) });
    } else if (button.dataset.move) {
      // A Hand game takes the announcement that the player chose.
      const level = "level" in button.dataset && app.querySelector("input[name=ansage]:checked")?.value;
      move({ ...JSON.parse(button.dataset.move), ...(level ? { [level]: true } : {}) });
    }
  });

  // Another tab changed the save. This tab stops and shows the menu, so it never writes an old state.
  // An online game writes no save, so it goes on.
  addEventListener("storage", (event) => {
    if (online || !game || !isSaveOf(event, game.id) || !(rulesFromGame || app.querySelector(".game-screen"))) return;
    leave();
    rulesFromGame = false;
    show(menuHtml(`<p class="status" role="status">Das Spiel wurde in einem anderen Tab weitergespielt.</p>`));
  });

  // A closed tab sends no close over WebRTC by itself, so the other player would wait for a long time.
  addEventListener("pagehide", leaveRoom);

  document.title = APP_TITLE;
  app.innerHTML = menuHtml();
  cleared = true;
}

// Only https and localhost allow a service worker. A failed registration leaves the app online-only.
export function registerServiceWorker({ navigator = globalThis.navigator, isSecureContext = globalThis.isSecureContext } = {}) {
  if (!navigator?.serviceWorker || !isSecureContext) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

if (typeof document !== "undefined") {
  startApp();
  registerServiceWorker();
}
