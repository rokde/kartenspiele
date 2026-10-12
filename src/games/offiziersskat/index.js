import { renderCard, renderCardBack } from "../../core/card-view.js";
import { SUIT_NAMES, SUIT_SYMBOLS } from "../../core/cards.js";
import * as rules from "./rules.js";
import { aiMove } from "./ai.js";

export { applyMove, isOver } from "./rules.js";
export { aiMove };

export const id = "offiziersskat";
export const name = "Offiziersskat";

const GAME_NAMES = { ...SUIT_NAMES, grand: "Grand" };
const symbol = (game) => (SUIT_SYMBOLS[game] ? `<span aria-hidden="true">${SUIT_SYMBOLS[game]}</span> ` : "");

export function newGame(seed, vorhand) {
  const state = rules.newGame(seed, vorhand);
  return state.vorhand === "computer" ? rules.applyMove(state, aiMove(state)) : state;
}

const PLAYER_NAMES = { human: "Du", computer: "Computer" };

function renderStack(stack, i, legal) {
  const up = !stack.up ? "" : legal.includes(i)
    ? `<button type="button" class="stack__play" data-stack="${i}">${renderCard(stack.up)}</button>`
    : renderCard(stack.up);
  return `<li class="stack">${up}${stack.down ? renderCardBack() : ""}</li>`;
}

function renderRow(label, player, legal = []) {
  const stacks = player.stacks.map((stack, i) => renderStack(stack, i, legal)).join("");
  return `<h3 class="row__label">${label}</h3><ul class="row">${stacks}</ul>`;
}

function renderStatus(state) {
  if (rules.isOver(state)) return "Spiel vorbei";
  return state.turn === "human" ? "Du bist dran" : "Computer ist dran";
}

// An empty open trick shows the last trick, so that the human sees both cards until the next card.
function renderTrick(state) {
  const last = state.trick.length === 0 && state.tricks.at(-1);
  const cards = (last ? last.cards : state.trick).map(({ player, card }) =>
    `<li class="trick__card"><span class="trick__player">${PLAYER_NAMES[player]}</span>${renderCard(card)}</li>`).join("");
  const caption = last ? `<p class="trick__winner">Stich für ${last.winner === "human" ? "dich" : "Computer"}</p>` : "";
  return `<div class="trick"><ul class="trick__cards" aria-label="Stich">${cards}</ul>${caption}</div>`;
}

function renderAnnouncement(state) {
  const vorhand = `<p class="announce__vorhand">Vorhand: ${state.vorhand === "human" ? "Du" : "Computer"}</p>`;
  if (state.trump) {
    return vorhand + `<p class="trump-badge trump-badge--${state.trump}" role="status" tabindex="-1">${symbol(state.trump)}Trumpf: ${GAME_NAMES[state.trump]}</p>`;
  }
  if (state.vorhand !== "human") return vorhand;
  const buttons = rules.GAMES.map((game) =>
    `<button type="button" class="announce-button announce-button--${game}" data-announce="${game}">` +
    `${symbol(game)}${GAME_NAMES[game]}</button>`).join("");
  return vorhand + `<div class="announce__buttons" role="group" aria-label="Spiel ansagen">${buttons}</div>`;
}

export function render(state) {
  const playing = state.trump !== null;
  const legal = playing && state.turn === "human" && !rules.isOver(state) ? rules.legalStacksFor(state) : [];
  return `<h2>${name}</h2><div class="table">` +
    `<div class="announce">${renderAnnouncement(state)}</div>` +
    renderRow("Computer", state.players.computer) +
    (playing ? `<p class="status" role="status" tabindex="-1">${renderStatus(state)}</p>${renderTrick(state)}` : "") +
    renderRow("Du", state.players.human, legal) +
    `</div>`;
}
