import { listGames, getGame } from "./core/registry.js";
import { renderMenu, renderGameScreen } from "./core/menu-view.js";

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
  const showGame = () => {
    show(renderGameScreen(game, state));
    (app.querySelector("[data-announce], [data-stack]") ?? app.querySelector(".status"))?.focus();
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
      state = game.newGame(crypto.getRandomValues(new Uint32Array(1))[0]);
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
}
