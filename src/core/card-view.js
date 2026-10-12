import { SUIT_SYMBOLS, cardName } from "./cards.js";

const CID_RANKS = { 10: "T", B: "J", D: "Q" };
const CID_SUITS = { kreuz: "c", pik: "s", herz: "h", karo: "d" };

// The CardMeister id of a card, for example "Jc" for Kreuz Bube.
export const cid = (card) => (CID_RANKS[card.rank] ?? card.rank) + CID_SUITS[card.suit];

// When the vendored script does not load, the cards fall back to symbols.
const hasImages = () => Boolean(globalThis.customElements?.get("playing-card"));

export function renderCard(card) {
  if (hasImages()) {
    return `<div class="card card--image" role="img" aria-label="${cardName(card)}">` +
      `<playing-card cid="${cid(card)}" letters="ABDK" aria-hidden="true"></playing-card></div>`;
  }
  const symbol = SUIT_SYMBOLS[card.suit];
  return `<div class="card card--${card.suit}" role="img" aria-label="${cardName(card)}">` +
    `<span class="card__rank" aria-hidden="true">${card.rank}</span>` +
    `<span class="card__symbol" aria-hidden="true">${symbol}</span>` +
    `</div>`;
}

export function renderCardBack() {
  if (hasImages()) {
    return `<div class="card-back card-back--image" role="img" aria-label="Verdeckte Karte">` +
      `<playing-card rank="0" aria-hidden="true"></playing-card></div>`;
  }
  return `<div class="card-back" role="img" aria-label="Verdeckte Karte"></div>`;
}

export function renderDeck(cards) {
  return `<div class="deck">${cards.map(renderCard).join("")}</div>`;
}
