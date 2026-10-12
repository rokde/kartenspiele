import { createDeck } from "./core/cards.js";
import { renderDeck } from "./core/card-view.js";

export const APP_TITLE = "Karten";

if (typeof document !== "undefined") {
  const app = document.getElementById("app");
  const heading = document.createElement("h1");
  heading.textContent = APP_TITLE;
  app.append(heading);
  app.insertAdjacentHTML("beforeend", renderDeck(createDeck()));
  document.title = APP_TITLE;
}
