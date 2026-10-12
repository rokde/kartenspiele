import { listGames, getGame } from "./core/registry.js";
import { renderMenu, renderGameScreen, renderCredits } from "./core/menu-view.js";
import { save, load } from "./core/storage.js";
import { createSound } from "./core/sound.js";

export const APP_TITLE = "Karten";

if (typeof document !== "undefined") {
  const app = document.getElementById("app");
  const show = (html) => {
    app.innerHTML = html;
    // The clicked button is gone, so move the keyboard focus to the new screen.
    app.querySelector("button")?.focus();
  };
  const menuHtml = () => `<h1>${APP_TITLE}</h1>${renderMenu(listGames())}`;

  let game;
  let state;
  let timer;
  const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
  // Reading localStorage throws when the browser blocks it. Then the game runs without a save.
  const store = (() => { try { return localStorage; } catch { return null; } })();
  const saved = (g) => g.restore(load(store, g.id));
  const sound = createSound(store);
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
  const showGame = () => {
    save(store, game.id, state);
    show(renderGameScreen(game, state));
    (app.querySelector("[data-announce], [data-stack], [data-action=next]") ?? app.querySelector(".status"))?.focus();
    // A short pause, so that the human can see each computer card.
    if (state.trump !== null && state.turn === "computer" && !game.isOver(state)) {
      timer = setTimeout(() => {
        go(game.applyMove(state, game.aiMove(state)));
      }, 800);
    }
  };
  // The resume on page load does not come here, so it plays no sound.
  const go = (next, prev = state) => {
    for (const event of game.soundEvents(prev, next)) sound.play(event);
    state = next;
    showGame();
  };

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "back") {
      clearTimeout(timer);
      show(menuHtml());
    } else if (button.dataset.action === "credits") {
      show(renderCredits());
    } else if (button.dataset.gameId) {
      game = getGame(button.dataset.gameId);
      state = saved(game);
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

  document.title = APP_TITLE;
  app.innerHTML = menuHtml();
  // Resume the first game with a valid save.
  game = listGames().find((g) => (state = saved(g)));
  if (game) showGame();
}
