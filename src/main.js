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

  app.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "back") show(menuHtml());
    else if (button.dataset.gameId) show(renderGameScreen(getGame(button.dataset.gameId)));
  });

  document.title = APP_TITLE;
  app.innerHTML = menuHtml();
}
