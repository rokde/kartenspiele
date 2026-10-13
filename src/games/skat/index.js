import { renderCard, renderCardBack } from "../../core/card-view.js";
import { SUITS, SUIT_NAMES, SUIT_SYMBOLS, cardName } from "../../core/cards.js";
import * as rules from "./rules.js";
import { aiMove } from "./ai.js";
import { seatView } from "./online.js";

export { applyMove, isOver, restore } from "./rules.js";
export { hostSession, guestSession } from "./online.js";
export { aiMove };

export const id = "skat";
export const name = "Skat";
export const online = true;
export const onlineLabel = "Online spielen";
export const maxGuests = 2;
export const source = ["https://de.wikipedia.org/wiki/Skat", "Skat bei Wikipedia"];

// Keep this text in line with rules.js.
export const rulesHtml = `<h1>Spielregeln Skat</h1>
<p>Skat ist ein Kartenspiel für drei. Du spielst gegen zwei Computer oder online mit Freunden.
Ein freier Platz bekommt einen Computer.</p>
<h2>Geben</h2>
<p>Jeder bekommt 10 Karten, 2 Karten liegen verdeckt als Skat. Der Geber gibt 3 Karten an jeden, 2 in den Skat,
dann 4 und 3 Karten an jeden. Nach jedem Spiel gibt der nächste Platz. Links vom Geber sitzt die Vorhand,
dann folgen Mittelhand und Hinterhand.</p>
<h2>Reizen</h2>
<p>Die Mittelhand sagt der Vorhand Werte: 18, 20, 22, 23, 24, 27, 30 und so weiter. Die Vorhand antwortet
mit „Ja“ oder „Passe“. Danach reizt die Hinterhand den Gewinner. Wer übrig bleibt, ist der Alleinspieler.
Passen alle drei, ist das Spiel eingepasst: niemand bekommt Punkte, und der nächste Platz gibt neu.</p>
<h2>Skat und Ansage</h2>
<p>Der Alleinspieler nimmt den Skat auf und drückt 2 Karten, oder er spielt Hand. Dann sagt er das Spiel an:
Kreuz, Pik, Herz, Karo, Grand oder Null. Nur im Handspiel darf er Schneider, Schwarz oder Ouvert ansagen.</p>
<h2>Trumpf und Stiche</h2>
<ul>
<li>Im Farbspiel sind die 4 Buben und die angesagte Farbe Trumpf: Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube, Ass, 10, König, Dame, 9, 8, 7.</li>
<li>Im Grand sind nur die 4 Buben Trumpf.</li>
<li>Im Null gibt es keinen Trumpf. Die Reihenfolge ist Ass, König, Dame, Bube, 10, 9, 8, 7.</li>
<li>Die Vorhand spielt zum ersten Stich aus. Du musst Farbe bedienen, wenn du kannst. Trumpf gilt als eine Farbe.</li>
<li>Wer den Stich gewinnt, spielt zum nächsten aus.</li>
</ul>
<h2>Gewinnen</h2>
<p>Ass 11, Zehn 10, König 4, Dame 3, Bube 2 Augen, zusammen 120. Der Alleinspieler gewinnt mit 61 Augen oder mehr.
Die Augen im Skat zählen für ihn. Im Null gewinnt er, wenn er keinen Stich bekommt.</p>
<h2>Spielwert</h2>
<p>Grundwert: Karo 9, Herz 10, Pik 11, Kreuz 12, Grand 24. Der Grundwert mal die Stufen ist der Spielwert.
Stufen: Spitzen (mit oder ohne), Spiel, Hand, Schneider, Schneider angesagt, Schwarz, Schwarz angesagt, Ouvert.
Schneider heißt: eine Partei hat 30 Augen oder weniger. Schwarz heißt: eine Partei hat keinen Stich.</p>
<p>Null 23, Null Hand 35, Null Ouvert 46, Null Ouvert Hand 59.</p>
<p>Ein verlorenes Spiel zählt doppelt minus. Ist der Spielwert kleiner als das Gereizte (überreizt),
ist das Spiel verloren. Es zählt dann das kleinste Vielfache des Grundwerts, das das Gereizte erreicht.</p>`;

export const newGame = (seed, dealer = 0, scores = []) => rules.newGame(seed, dealer, scores);

// "Neues Spiel": stop the current game and start an empty score list. The dealer changes.
export const restart = (state, seed) => newGame(seed, (state.dealer + 1) % 3, []);

export const nextGame = (state, seed) => rules.nextGame(state, seed);

// The host is seat 0. One guest leaves seat 2 to the computer.
export const newOnlineGame = (seed, guests) => rules.newGame(seed, 0, [], guests === 1 ? [2] : []);

// True when a computer seat must move. The guest view never runs the computer.
export const computerTurn = (state) => !rules.isOver(state) && state.computers.includes(state.turn);

const playedCount = (state) => state.tricks.length * 3 + state.trick.length;
const fresh = (prev, next) => (!prev || rules.isOver(prev)) && next.phase === "bid" && playedCount(next) === 0;

// Win or lose from the view of the own seat. A null prev means a new game.
export function soundEvents(prev, next) {
  if (!prev || rules.isOver(prev)) return fresh(prev, next) ? ["deal"] : [];
  const events = Array(Math.max(0, playedCount(next) - playedCount(prev))).fill("play");
  if (next.phase === "over") events.push(rules.result(next).won === (next.declarer === (next.me ?? 0)) ? "win" : "lose");
  return events;
}

// Deal steps in the 3-Skat-4-3 order, played cards, and finished tricks.
export function motionEvents(prev, next) {
  if (!prev || rules.isOver(prev)) {
    if (!fresh(prev, next)) return [];
    const me = next.me ?? 0;
    return rules.dealSteps(next.dealer).map(({ seat, first, count }) => ({
      type: "deal", player: seat, side: seat === me ? "up" : "down", stacks: Array.from({ length: count }, (_, i) => first + i),
    }));
  }
  const played = [...next.tricks.flatMap((t) => t.cards), ...next.trick];
  const start = playedCount(prev);
  return played.slice(start).flatMap(({ seat, card }, i) => {
    const k = start + i;
    const play = { type: "play", player: seat, card };
    return k % 3 === 2 ? [play, { type: "trick", winner: next.tricks[(k - 2) / 3].winner }] : [play];
  });
}

const GAME_NAMES = { ...SUIT_NAMES, grand: "Grand", null: "Null" };
const symbol = (type) => (SUIT_SYMBOLS[type] ? `<span aria-hidden="true">${SUIT_SYMBOLS[type]}</span> ` : "");
const ROLES = ["Hinterhand", "Vorhand", "Mittelhand"];

export function gameName(game) {
  const parts = [GAME_NAMES[game.type]];
  if (game.type === "null") parts.push(game.ouvert ? "Ouvert" : "", game.hand ? "Hand" : "");
  else parts.push(game.hand ? "Hand" : "", game.ouvert ? "Ouvert" : game.schwarz ? "Schwarz angesagt" : game.schneider ? "Schneider angesagt" : "");
  return parts.filter(Boolean).join(" ");
}

// Buben first (not in Null), then trump, then the other suits. High cards first.
function sortHand(cards, type) {
  const group = (c) => (rules.isTrump(c, type) ? -1 : SUITS.indexOf(c.suit));
  return [...cards].sort((a, b) => group(a) - group(b) || rules.rankOf(b, type) - rules.rankOf(a, type));
}

const moveAttr = (move) => `data-move="${JSON.stringify(move).replaceAll('"', "&quot;")}"`;

function cardButton(card, move, verb) {
  return `<button type="button" class="stack__play" ${moveAttr(move)} aria-label="${cardName(card)} ${verb}">${renderCard(card)}</button>`;
}

function seatNames(view, isOnline) {
  return [0, 1, 2].map((s) => (s === view.me ? "Du"
    : view.computers.includes(s) ? (isOnline ? "Computer" : `Computer ${s}`)
      : s === 0 ? "Gastgeber" : `Gast ${s}`));
}

// One back for each won trick. The slot has a fixed size, so the pile does not move the layout.
function renderPile(view, seat, names) {
  const won = view.tricks.filter((t) => t.winner === seat).length;
  const backs = Array.from({ length: won }, (_, i) => `<span class="card-back" style="--i: ${i}"></span>`).join("");
  return `<div class="pile" data-player="${seat}" role="img" aria-label="${names[seat]}: ${won} ${won === 1 ? "Stich" : "Stiche"}">` +
    `<span class="pile__slot">${backs}</span><span class="pile__count">${won}</span>${rules.isOver(view) ? `<span class="pile__label">Stiche</span>` : ""}</div>`;
}

function renderHead(view, seat, names) {
  const role = ROLES[(seat - view.dealer + 3) % 3];
  const declarer = view.declarer === seat && view.game ? " · Alleinspieler" : "";
  const said = view.phase === "bid" && view.said[seat] ? `<span class="seat__said">${view.said[seat]}</span>` : "";
  return `<div class="seat__head"><h3 class="row__label">${names[seat]}</h3>` +
    `<span class="seat__role">${role}${declarer}</span>${said}${renderPile(view, seat, names)}</div>`;
}

function renderOther(view, seat, names) {
  const hand = view.hands[seat];
  const cards = (hand[0] ? sortHand(hand, view.game?.type ?? "grand") : hand)
    .map((card) => (card ? `<li class="stack">${renderCard(card)}</li>` : `<li class="stack stack--hidden">${renderCardBack()}</li>`)).join("");
  return `<section class="seat seat--other" aria-label="${names[seat]}">${renderHead(view, seat, names)}` +
    `<ul class="row skat-hand skat-hand--other" data-player="${seat}" aria-label="${hand.length} Karten">${cards}</ul></section>`;
}

function renderOwn(view, names, active) {
  const { me, phase, game } = view;
  const hand = sortHand(view.hands[me], game?.type ?? "grand");
  const discarding = active && phase === "discard" && view.skat.length < 2;
  const legal = active && phase === "play" ? rules.legalCards(view.hands[me], game.type, view.trick[0]?.card) : [];
  const cards = hand.map((card) => {
    const html = discarding ? cardButton(card, { type: "discard", card }, "drücken")
      : legal.some((c) => rules.sameCard(c, card)) ? cardButton(card, { type: "play", card }, "spielen") : renderCard(card);
    return `<li class="stack">${html}</li>`;
  }).join("");
  const playing = discarding || legal.length ? " row--playing" : "";
  return `<section class="seat seat--own" aria-label="Deine Karten">${renderHead(view, me, names)}` +
    `<ul class="row skat-hand skat-hand--own${playing}" data-player="${me}" style="--n: ${hand.length}">${cards}</ul></section>`;
}

// An empty open trick shows the last trick until it is cleared. The deal stack sits in the middle.
function renderTrick(view, trickCleared, names) {
  const last = !trickCleared && view.trick.length === 0 && view.tricks.at(-1);
  const cards = (last ? last.cards : view.trick).map(({ seat, card }) =>
    `<li class="trick__card"><span class="trick__player">${names[seat]}</span>${renderCard(card)}</li>`).join("");
  const caption = last ? `<p class="trick__winner">Stich für ${last.winner === view.me ? "dich" : names[last.winner]}</p>` : "";
  return `<div class="trick"><div class="deal-stack" aria-hidden="true"></div>` +
    `<ul class="trick__cards" aria-label="Stich">${cards}</ul>${caption}</div>`;
}

function renderSkat(view, active) {
  const takeback = active && view.phase === "discard";
  const cards = view.skat.map((card) => `<li class="stack">${!card ? renderCardBack()
    : takeback ? cardButton(card, { type: "takeback", card }, "zurücknehmen") : renderCard(card)}</li>`).join("");
  const label = rules.isOver(view) ? `<span class="skat-skat__label">Skat</span>` : "";
  return `<div class="skat-skat">${label}` +
    `<ul class="row skat-skat__cards" data-player="skat" aria-label="Skat: ${view.skat.length} Karten">${cards}</ul></div>`;
}

function renderInfo(view, names) {
  if (view.game) {
    return `<p class="trump-badge trump-badge--${view.game.type}" role="status" tabindex="-1">${symbol(view.game.type)}` +
      `${gameName(view.game)} · ${names[view.declarer]} · ${view.bid.value || 18}</p>`;
  }
  return `<p class="skat-info">${view.bid.value ? `Gereizt: ${view.bid.value}` : "Reizen"}</p>`;
}

const button = (label, move, extra = "") => `<button type="button" class="announce-button" ${moveAttr(move)}${extra}>${label}</button>`;

// In a Hand game the declarer can announce more. The choice applies to the suit and Grand buttons.
function gameButtons(hand) {
  const suits = [...SUITS, "grand"].map((type) =>
    `<button type="button" class="announce-button announce-button--${type}" ${moveAttr({ type: "declare", game: type })}${hand ? " data-level" : ""}>` +
    `${symbol(type)}${GAME_NAMES[type]}</button>`).join("");
  const nulls = button("Null", { type: "declare", game: "null" }) + button("Null Ouvert", { type: "declare", game: "null", ouvert: true });
  if (!hand) return `<div class="announce__buttons" role="group" aria-label="Spiel ansagen">${suits}${nulls}</div>`;
  // One tap starts a Hand game, so the visible legend says so.
  return `<fieldset class="skat-levels"><legend>Handspiel ansagen (ohne Skat)</legend>` +
    `<div class="announce__buttons">${suits}${nulls}</div>` +
    [["", "keine"], ["schneider", "Schneider"], ["schwarz", "Schwarz"], ["ouvert", "Ouvert"]].map(([value, label]) =>
      `<label><input type="radio" name="ansage" value="${value}"${value ? "" : " checked"}> ${label}</label>`).join("") + `</fieldset>`;
}

function renderStatus(view, names, active) {
  const { phase, bid, turn } = view;
  const next = rules.BID_VALUES.find((v) => v > bid.value);
  if (phase === "passed") return "Eingepasst";
  if (phase === "over") return "Spiel vorbei";
  const who = names[turn];
  if (phase === "bid") {
    if (!active) return turn === bid.sayer ? `${who} reizt …` : `${who} überlegt …`;
    if (bid.hearer === null) return "Alle anderen haben gepasst. Spielst du?";
    return turn === bid.sayer ? `Du reizt ${names[bid.hearer]}: ${next}?` : `${names[bid.sayer]} reizt ${bid.value}. Hältst du?`;
  }
  if (phase === "skat") return active ? `Du spielst für ${bid.value}. Skat aufnehmen oder Hand?` : `${who} überlegt …`;
  if (phase === "discard") {
    if (!active) return `${who} drückt …`;
    return view.skat.length < 2 ? `Drücke 2 Karten (${view.skat.length} von 2)` : "Sag dein Spiel an";
  }
  return active ? "Du bist dran" : `${who} ist dran`;
}

function renderActions(view, active) {
  if (!active) return "";
  const { phase, bid } = view;
  if (phase === "bid") {
    const next = rules.BID_VALUES.find((v) => v > bid.value);
    const say = view.turn === bid.sayer;
    return `<div class="announce__buttons" role="group" aria-label="Reizen">` +
      (say ? (next ? button(String(next), { type: "bid", value: next }) : "") : button("Ja", { type: "yes" })) +
      button("Passe", { type: "pass" }) + `</div>`;
  }
  if (phase === "skat") {
    return `<div class="announce__buttons">${button("Skat aufnehmen", { type: "pickup" })}</div>${gameButtons(true)}`;
  }
  if (phase === "discard" && view.skat.length === 2) return gameButtons(false);
  return "";
}

const OUTCOMES = { win: "Gewonnen!", loss: "Verloren" };

// The score list: one row per game, newest first, and the total for each seat.
function renderScores(view, names) {
  const cell = (value) => `<td>${value > 0 ? `+${value}` : value}</td>`;
  const rows = view.scores.map((row) =>
    `<tr><th scope="row">${gameName(row.game)}</th>${[0, 1, 2].map((s) => cell(row.declarer === s ? row.value : 0)).join("")}</tr>`).reverse().join("");
  return `<h3 class="result__title">Spielliste</h3><div class="skat-scores"><table>` +
    `<thead><tr><th scope="col">Spiel</th>${names.map((n) => `<th scope="col">${n}</th>`).join("")}</tr></thead>` +
    `<tbody>${rows}</tbody><tfoot><tr><th scope="row">Summe</th>${rules.totals(view.scores).map(cell).join("")}</tr></tfoot></table></div>`;
}

// The parts of the game value, for example "mit 1, Spiel 2: 2 × 12 = 24".
function valueText(view, res) {
  const bid = view.bid.value;
  const parts = view.game.type === "null" ? `${gameName(view.game)}: ${res.base}`
    : [`${res.mit ? "mit" : "ohne"} ${res.spitzen}`, ...["Spiel", ...res.levels].map((label, i) => `${label} ${res.spitzen + 1 + i}`)].join(", ") +
      `: ${res.spitzen + 1 + res.levels.length} × ${res.base} = ${(res.spitzen + 1 + res.levels.length) * res.base}`;
  const over = res.overbid ? `. Gereizt ${bid}: ${res.value / res.base} × ${res.base} = ${res.value}` : "";
  return `${parts}${over}${res.won ? "" : `. Verloren zählt doppelt: -${2 * res.value}`}`;
}

// Only the host starts the next online game.
function renderResult(view, names, isOnline, left) {
  const next = left ? "" : isOnline === "guest"
    ? `<p class="result__wait" role="status">Warte auf den Gastgeber …</p>`
    : `<button type="button" class="game-button" data-action="next" aria-describedby="result-outcome result-points">Nächstes Spiel</button>`;
  let head;
  if (view.phase === "passed") {
    head = `<p class="result__outcome" id="result-outcome">Eingepasst</p>` +
      `<p class="result__points" id="result-points">Alle haben gepasst. Der nächste Platz gibt neu.</p>`;
  } else {
    const res = rules.result(view);
    const outcome = res.won === (view.declarer === view.me) ? "win" : "loss";
    const detail = view.game.type === "null" ? (res.won ? "ohne Stich" : "mit Stich") : `${res.points} Augen`;
    head = `<p class="result__outcome result__outcome--${outcome}" id="result-outcome">${OUTCOMES[outcome]}</p>` +
      `<p class="result__points" id="result-points">${names[view.declarer]}: ${gameName(view.game)}, ${detail}, ` +
      `${res.won ? "gewonnen" : "verloren"}${res.overbid ? " (überreizt)" : ""}: ${res.score > 0 ? "+" : ""}${res.score}</p>` +
      `<p class="result__value">${valueText(view, res)}</p>`;
  }
  return `<section class="result" aria-label="Ergebnis">${head}${next}${renderScores(view, names)}</section>`;
}

// `online` is "host" or "guest". A guest state is already the view of its seat.
// `left` means that another player left: the table stays, but no button or turn text.
export function render(state, { trickCleared = false, online: isOnline = null, left = false } = {}) {
  const view = state.me === undefined ? seatView(state, 0) : state;
  const names = seatNames(view, isOnline);
  const active = !left && view.turn === view.me;
  const over = rules.isOver(view);
  const others = [1, 2].map((i) => renderOther(view, (view.me + i) % 3, names)).join("");
  const status = left ? "" : `<p class="status" role="status" tabindex="-1">${renderStatus(view, names, active)}</p>`;
  return `<h2>${name}</h2><div class="table skat">` +
    `<div class="skat__others">${others}</div>` +
    `<div class="skat__center"><div class="skat__info">${renderInfo(view, names)}</div>` +
    `<div class="skat__middle">${renderTrick(view, trickCleared, names)}${renderSkat(view, active)}</div></div>` +
    (over ? renderResult(view, names, isOnline, left) : `<div class="skat__actions">${status}${renderActions(view, active)}</div>`) +
    renderOwn(view, names, active) + `</div>`;
}
