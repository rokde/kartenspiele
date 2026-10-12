import { SUIT_SYMBOLS, cardName } from "./cards.js";

export function renderCard(card) {
  const symbol = SUIT_SYMBOLS[card.suit];
  return `<div class="card card--${card.suit}" role="img" aria-label="${cardName(card)}">` +
    `<span class="card__rank" aria-hidden="true">${card.rank}</span>` +
    `<span class="card__symbol" aria-hidden="true">${symbol}</span>` +
    `</div>`;
}

export function renderDeck(cards) {
  return `<div class="deck">${cards.map(renderCard).join("")}</div>`;
}
