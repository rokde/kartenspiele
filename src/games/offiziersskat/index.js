import { renderCard, renderCardBack } from "../../core/card-view.js";
import { SUIT_NAMES, SUIT_SYMBOLS } from "../../core/cards.js";
import * as rules from "./rules.js";
import { aiMove } from "./ai.js";

export { applyMove } from "./rules.js";
export { aiMove };

export const id = "offiziersskat";
export const name = "Offiziersskat";

const GAME_NAMES = { ...SUIT_NAMES, grand: "Grand" };
const symbol = (game) => (SUIT_SYMBOLS[game] ? `<span aria-hidden="true">${SUIT_SYMBOLS[game]}</span> ` : "");

export function newGame(seed, vorhand) {
  const state = rules.newGame(seed, vorhand);
  return state.vorhand === "computer" ? rules.applyMove(state, aiMove(state)) : state;
}

function renderRow(label, player) {
  const stacks = player.stacks
    .map((stack) => `<li class="stack">${renderCard(stack.up)}${renderCardBack()}</li>`)
    .join("");
  return `<h3 class="row__label">${label}</h3><ul class="row">${stacks}</ul>`;
}

function renderAnnouncement(state) {
  const vorhand = `<p class="announce__vorhand">Vorhand: ${state.vorhand === "human" ? "Du" : "Computer"}</p>`;
  if (state.trump) {
    return vorhand + `<p class="trump-badge trump-badge--${state.trump}">${symbol(state.trump)}Trumpf: ${GAME_NAMES[state.trump]}</p>`;
  }
  if (state.vorhand !== "human") return vorhand;
  const buttons = rules.GAMES.map((game) =>
    `<button type="button" class="announce-button announce-button--${game}" data-announce="${game}">` +
    `${symbol(game)}${GAME_NAMES[game]}</button>`).join("");
  return vorhand + `<div class="announce__buttons" role="group" aria-label="Spiel ansagen">${buttons}</div>`;
}

export function render(state) {
  return `<h2>${name}</h2><div class="table">` +
    `<div class="announce">${renderAnnouncement(state)}</div>` +
    renderRow("Computer", state.players.computer) +
    renderRow("Du", state.players.human) +
    `</div>`;
}
