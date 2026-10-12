import { renderCard, renderCardBack } from "../../core/card-view.js";
import { SUIT_NAMES, SUIT_SYMBOLS, cardName } from "../../core/cards.js";
import * as rules from "./rules.js";
import { aiMove } from "./ai.js";

export { applyMove, isOver, restore } from "./rules.js";
export { aiMove };

export const id = "offiziersskat";
export const name = "Offiziersskat";

const GAME_NAMES = { ...SUIT_NAMES, grand: "Grand" };
const symbol = (game) => (SUIT_SYMBOLS[game] ? `<span aria-hidden="true">${SUIT_SYMBOLS[game]}</span> ` : "");

const announceForComputer = (state) => (state.vorhand === "computer" ? rules.applyMove(state, aiMove(state)) : state);

export const newGame = (seed, dealer, scores) => announceForComputer(rules.newGame(seed, dealer, scores));

// "Neues Spiel": stop the current game. The dealer changes and the score list stays, with no entry for the stopped game.
export const restart = (state, seed) => newGame(seed, state.dealer === "human" ? "computer" : "human", state.scores);

export const nextGame = (state, seed) => announceForComputer(rules.nextGame(state, seed));

const PLAYER_NAMES = { human: "Du", computer: "Computer" };

function renderStack(stack, i, legal) {
  const up = !stack.up ? "" : legal.includes(i)
    ? `<button type="button" class="stack__play" data-stack="${i}" aria-label="${cardName(stack.up)} spielen">${renderCard(stack.up)}</button>`
    : renderCard(stack.up);
  return `<li class="stack">${up}${stack.down ? renderCardBack() : ""}</li>`;
}

function renderRow(label, player, legal = []) {
  const stacks = player.stacks.map((stack, i) => renderStack(stack, i, legal)).join("");
  return `<h3 class="row__label">${label}</h3><ul class="row${legal.length ? " row--playing" : ""}">${stacks}</ul>`;
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

const OUTCOMES = { win: "Gewonnen!", loss: "Verloren" };

// The button names the result text, so a screen reader reads it with the focus. Newest game first.
function renderResult(state) {
  const { human, computer } = rules.points(state);
  const outcome = rules.winner(state) === "human" ? "win" : "loss";
  const rows = state.scores.map((s) => `<li>Du ${s.human} : ${s.computer} Computer</li>`).reverse().join("");
  return `<section class="result" aria-label="Ergebnis">` +
    `<p class="result__outcome result__outcome--${outcome}" id="result-outcome">${OUTCOMES[outcome]}</p>` +
    `<p class="result__points" id="result-points">Du ${human} Punkte, Computer ${computer} Punkte</p>` +
    `<p class="result__announcer">Ansager: ${PLAYER_NAMES[state.vorhand]}</p>` +
    `<button type="button" class="game-button" data-action="next" aria-describedby="result-outcome result-points">Nächstes Spiel</button>` +
    `<h3 class="result__title">Spielliste</h3><ol class="result__scores" reversed>${rows}</ol>` +
    `</section>`;
}

export function render(state) {
  const playing = state.trump !== null;
  const legal = playing && state.turn === "human" && !rules.isOver(state) ? rules.legalStacksFor(state) : [];
  return `<h2>${name}</h2><div class="table">` +
    `<div class="announce">${renderAnnouncement(state)}</div>` +
    renderRow("Computer", state.players.computer) +
    (playing ? `<p class="status" role="status" tabindex="-1">${renderStatus(state)}</p>${renderTrick(state)}` : "") +
    renderRow("Du", state.players.human, legal) +
    `</div>` + (rules.isOver(state) ? renderResult(state) : "");
}
