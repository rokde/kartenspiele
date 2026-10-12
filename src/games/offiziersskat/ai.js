import { SUITS } from "../../core/cards.js";
import { CARD_POINTS, legalStacksFor } from "./rules.js";

// Announce from the open cards only (the first deal). Strength of a suit: first the card count, then the card points. The Buben are trump in every game, so skip them.
export function aiMove(state, random = Math.random) {
  if (state.trump !== null) {
    const legal = legalStacksFor(state);
    return { type: "play", stack: legal[Math.floor(random() * legal.length)] };
  }
  const cards = state.players.computer.stacks.map((stack) => stack.up).filter((card) => card && card.rank !== "B");
  const strength = (suit) => {
    const own = cards.filter((card) => card.suit === suit);
    return [own.length, own.reduce((sum, card) => sum + CARD_POINTS[card.rank], 0)];
  };
  let best = SUITS[0];
  for (const suit of SUITS.slice(1)) {
    const [count, points] = strength(suit);
    const [bestCount, bestPoints] = strength(best);
    if (count > bestCount || (count === bestCount && points > bestPoints)) best = suit;
  }
  return { type: "announce", game: best };
}
