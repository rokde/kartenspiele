import { listGames, getGame } from "./core/registry.js";
import { renderMenu, renderGameScreen } from "./core/menu-view.js";
import { save, load } from "./core/storage.js";

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
  const showGame = () => {
    save(store, game.id, state);
    show(renderGameScreen(game, state));
    (app.querySelector("[data-announce], [data-stack], [data-action=next]") ?? app.querySelector(".status"))?.focus();
    // A short pause, so that the human can see each computer card.
    if (state.trump !== null && state.turn === "computer" && !game.isOver(state)) {
      timer = setTimeout(() => {
        state = game.applyMove(state, game.aiMove(state));
        showGame();
      }, 800);
    }
  };

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "back") {
      clearTimeout(timer);
      show(menuHtml());
    } else if (button.dataset.gameId) {
      game = getGame(button.dataset.gameId);
      state = saved(game) ?? game.newGame(seed());
      showGame();
    } else if (button.dataset.action === "new") {
      clearTimeout(timer);
      state = game.restart(state, seed());
      showGame();
    } else if (button.dataset.action === "next") {
      state = game.nextGame(state, seed());
      showGame();
    } else if (button.dataset.announce) {
      state = game.applyMove(state, { type: "announce", game: button.dataset.announce });
      showGame();
    } else if (button.dataset.stack) {
      state = game.applyMove(state, { type: "play", stack: Number(button.dataset.stack) });
      showGame();
    }
  });

  document.title = APP_TITLE;
  app.innerHTML = menuHtml();
  // Resume the first game with a valid save.
  game = listGames().find((g) => (state = saved(g)));
  if (game) showGame();
}
