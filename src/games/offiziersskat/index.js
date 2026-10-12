import { createDeck } from "../../core/cards.js";
import { renderDeck } from "../../core/card-view.js";

export const id = "offiziersskat";
export const name = "Offiziersskat";

// shortcut: stub screen shows the deck only, S4 replaces it with the table.
export function render() {
  return `<h2>${name}</h2><p class="note">Kommt bald</p>${renderDeck(createDeck())}`;
}
