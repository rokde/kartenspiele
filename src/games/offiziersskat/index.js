import { renderCard, renderCardBack } from "../../core/card-view.js";
import { SUIT_NAMES, SUIT_SYMBOLS, cardName } from "../../core/cards.js";
import * as rules from "./rules.js";
import { aiMove } from "./ai.js";

export { applyMove, isOver, restore } from "./rules.js";
export { aiMove };

export const id = "offiziersskat";
export const name = "Offiziersskat";

// Keep this text in line with rules.js.
export const rulesHtml = `<h1>Spielregeln Offiziersskat</h1>
<p>Offiziersskat ist ein Kartenspiel für zwei: du gegen den Computer.</p>
<h2>Die Karten</h2>
<p>Gespielt wird mit 32 Karten in vier Farben: Kreuz, Pik, Herz und Karo.
Jede Farbe hat 7, 8, 9, 10, Bube, Dame, König und Ass.</p>
<h2>Der Tisch</h2>
<p>Jeder Spieler hat 8 Stapel vor sich. Auf jedem Stapel liegt unten eine Karte verdeckt und oben eine Karte offen.</p>
<h2>Das Geben</h2>
<p>Der Geber gibt in Schritten zu je 4 Karten. Sein Gegner ist die Vorhand.</p>
<ol>
<li>4 Karten verdeckt an jeden Spieler.</li>
<li>4 Karten offen an die Vorhand.</li>
<li>Die Vorhand sagt das Spiel an.</li>
<li>4 Karten offen an den Geber.</li>
<li>4 Karten verdeckt an jeden Spieler.</li>
<li>4 Karten offen an jeden Spieler.</li>
</ol>
<p>Nach jedem Spiel wechselt der Geber.</p>
<h2>Die Ansage</h2>
<p>Die Vorhand sieht nur ihre 4 offenen Karten. Damit sagt sie eine Farbe an (Farbspiel) oder Grand.</p>
<h2>Trumpf</h2>
<ul>
<li>Die vier Buben sind immer Trumpf: Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube (vom höchsten zum niedrigsten).</li>
<li>Im Farbspiel ist auch die angesagte Farbe Trumpf: unter den Buben folgen Ass, 10, König, Dame, 9, 8, 7.</li>
<li>Im Grand sind nur die Buben Trumpf.</li>
<li>In jeder anderen Farbe gilt: Ass, 10, König, Dame, 9, 8, 7.</li>
</ul>
<h2>Das Spiel</h2>
<ul>
<li>Die Vorhand spielt die erste Karte aus.</li>
<li>Du spielst nur offene Karten. Spielst du eine Karte von einem Stapel, wird die Karte darunter aufgedeckt.</li>
<li>Farbe bekennen: Kannst du die ausgespielte Farbe bedienen, musst du das. Bei Trumpf musst du Trumpf bekennen.</li>
<li>Kannst du nicht bedienen, spielst du eine beliebige offene Karte.</li>
<li>Die höhere Karte der ausgespielten Farbe gewinnt den Stich. Ein Trumpf sticht jede andere Farbe.</li>
<li>Wer den Stich gewinnt, spielt die nächste Karte aus.</li>
</ul>
<h2>Zählen und Gewinnen</h2>
<p>Am Ende zählt jeder die Augen in seinen Stichen:</p>
<ul>
<li>Ass 11, Zehn 10, König 4, Dame 3, Bube 2, 9, 8 und 7 je 0.</li>
<li>Zusammen sind es 120 Augen.</li>
</ul>
<p>Der Ansager gewinnt mit 61 Augen oder mehr. Bei 60:60 gewinnt der Gegner.</p>`;

const GAME_NAMES = { ...SUIT_NAMES, grand: "Grand" };
const symbol = (game) => (SUIT_SYMBOLS[game] ? `<span aria-hidden="true">${SUIT_SYMBOLS[game]}</span> ` : "");

const announceForComputer = (state) => (state.vorhand === "computer" ? rules.applyMove(state, aiMove(state)) : state);

export const newGame = (seed, dealer, scores) => announceForComputer(rules.newGame(seed, dealer, scores));

// "Neues Spiel": stop the current game. The dealer changes and the score list stays, with no entry for the stopped game.
export const restart = (state, seed) => newGame(seed, state.dealer === "human" ? "computer" : "human", state.scores);

export const nextGame = (state, seed) => announceForComputer(rules.nextGame(state, seed));

const playedCount = (state) => state.tricks.length * 2 + state.trick.length;

// The sound events for one state change. A null prev means a new game.
export function soundEvents(prev, next) {
  const fresh = !prev || rules.isOver(prev);
  if (fresh) return playedCount(next) === 0 ? ["deal"] : [];
  const events = Array(Math.max(0, playedCount(next) - playedCount(prev))).fill("play");
  if (rules.isOver(next)) events.push(rules.winner(next) === "human" ? "win" : "lose");
  return events;
}

// The motion events for one state change: deal steps in the S12 order, played cards, and finished tricks.
export function motionEvents(prev, next) {
  const deal = (steps) => steps.map(([role, first, side]) =>
    ({ type: "deal", player: next[role], side, stacks: [first, first + 1, first + 2, first + 3] }));
  if (!prev || rules.isOver(prev)) {
    if (playedCount(next) > 0) return [];
    return deal(next.trump === null ? rules.FIRST_DEAL : [...rules.FIRST_DEAL, ...rules.REST_DEAL]);
  }
  if (prev.trump === null) return next.trump === null ? [] : deal(rules.REST_DEAL);
  const played = [...next.tricks.flatMap((t) => t.cards), ...next.trick];
  const start = playedCount(prev);
  return played.slice(start).flatMap(({ player, card }, i) => {
    const k = start + i;
    const play = { type: "play", player, card };
    return k % 2 ? [play, { type: "trick", winner: next.tricks[(k - 1) / 2].winner }] : [play];
  });
}

const PLAYER_NAMES = { human: "Du", computer: "Computer" };

function renderStack(stack, i, legal) {
  const up = !stack.up ? "" : legal.includes(i)
    ? `<button type="button" class="stack__play" data-stack="${i}" aria-label="${cardName(stack.up)} spielen">${renderCard(stack.up)}</button>`
    : renderCard(stack.up);
  return `<li class="stack">${up}${stack.down ? renderCardBack() : ""}</li>`;
}

// One back for each won trick. The slot has a fixed size, so the pile does not move the layout.
function renderPile(state, player) {
  const won = state.tricks.filter((t) => t.winner === player).length;
  const backs = Array.from({ length: won }, (_, i) => `<span class="card-back" style="--i: ${i}"></span>`).join("");
  return `<div class="pile" data-player="${player}" role="img" aria-label="${PLAYER_NAMES[player]}: ${won} ${won === 1 ? "Stich" : "Stiche"}">` +
    `<span class="pile__slot">${backs}</span><span class="pile__count">${won}</span></div>`;
}

function renderRow(state, player, legal = []) {
  const stacks = state.players[player].stacks.map((stack, i) => renderStack(stack, i, legal)).join("");
  return `<div class="row__head"><h3 class="row__label">${PLAYER_NAMES[player]}</h3>${renderPile(state, player)}</div>` +
    `<ul class="row${legal.length ? " row--playing" : ""}" data-player="${player}">${stacks}</ul>`;
}

function renderStatus(state) {
  if (rules.isOver(state)) return "Spiel vorbei";
  return state.turn === "human" ? "Du bist dran" : "Computer ist dran";
}

// An empty open trick shows the last trick until it is cleared. The deal stack sits in the middle.
function renderTrick(state, trickCleared) {
  const last = !trickCleared && state.trick.length === 0 && state.tricks.at(-1);
  const cards = (last ? last.cards : state.trick).map(({ player, card }) =>
    `<li class="trick__card"><span class="trick__player">${PLAYER_NAMES[player]}</span>${renderCard(card)}</li>`).join("");
  const caption = last ? `<p class="trick__winner">Stich für ${last.winner === "human" ? "dich" : "Computer"}</p>` : "";
  const deck = `<div class="deal-stack" aria-hidden="true">${state.stock.length ? '<span class="card-back"></span>'.repeat(3) : ""}</div>`;
  return `<div class="trick">${deck}<ul class="trick__cards" aria-label="Stich">${cards}</ul>${caption}</div>`;
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

export function render(state, { trickCleared = false } = {}) {
  const playing = state.trump !== null;
  const legal = playing && state.turn === "human" && !rules.isOver(state) ? rules.legalStacksFor(state) : [];
  return `<h2>${name}</h2><div class="table">` +
    `<div class="announce">${renderAnnouncement(state)}</div>` +
    renderRow(state, "computer") +
    (playing ? `<p class="status" role="status" tabindex="-1">${renderStatus(state)}</p>` : "") +
    renderTrick(state, trickCleared) +
    renderRow(state, "human", legal) +
    `</div>` + (rules.isOver(state) ? renderResult(state) : "");
}
