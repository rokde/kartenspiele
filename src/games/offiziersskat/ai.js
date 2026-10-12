import { SUITS } from "../../core/cards.js";
import { CARD_POINTS, beats, isTrump, legalStacks, legalStacksFor, strength } from "./rules.js";

// Rules of thumb on the visible cards only: own and human open cards, the trick, and the trump.
// The same state always gives the same move.
export function aiMove(state) {
  if (state.trump === null) return { type: "announce", game: announce(state.players.computer.stacks) };
  const { trump } = state;
  const stacks = state.players[state.turn].stacks;
  const legal = legalStacksFor(state);
  const card = (i) => stacks[i].up;
  const points = (c) => CARD_POINTS[c.rank];
  const trumpKey = (c) => (isTrump(c, trump) ? 1 : 0);
  const low = (c) => [points(c), trumpKey(c), strength(c)];
  const lead = state.trick[0]?.card;
  if (!lead) {
    const human = state.players[state.turn === "human" ? "computer" : "human"].stacks;
    const safe = legal.filter((i) =>
      !legalStacks(human, trump, card(i)).some((j) => beats(human[j].up, card(i), trump)));
    if (safe.length) return play(stacks, safe, (c) => [-points(c), trumpKey(c), strength(c)]);
    return play(stacks, legal, low);
  }
  const winners = legal.filter((i) => beats(card(i), lead, trump));
  if (winners.length && points(lead) > 0) return play(stacks, winners, (c) => [trumpKey(c), strength(c)]);
  return play(stacks, legal, low);
}

// Two or more Buben: Grand. Else the suit with the most non-Bube cards, then the most points, then the SUITS order.
function announce(stacks) {
  const cards = stacks.map((stack) => stack.up).filter(Boolean);
  if (cards.filter((card) => card.rank === "B").length >= 2) return "grand";
  const strengthOf = (suit) => {
    const own = cards.filter((card) => card.suit === suit && card.rank !== "B");
    return [own.length, own.reduce((sum, card) => sum + CARD_POINTS[card.rank], 0)];
  };
  let best = SUITS[0];
  for (const suit of SUITS.slice(1)) {
    const [count, points] = strengthOf(suit);
    const [bestCount, bestPoints] = strengthOf(best);
    if (count > bestCount || (count === bestCount && points > bestPoints)) best = suit;
  }
  return best;
}

// Lowest key wins. On a tie, prefer a stack with a card below (it opens one more card), then the lowest index.
// Only the presence of the card below is visible, never its face.
function play(stacks, indices, key) {
  const full = (i) => [...key(stacks[i].up), stacks[i].down ? 0 : 1, i];
  const less = (a, b) => {
    const k = a.findIndex((x, n) => x !== b[n]);
    return k >= 0 && a[k] < b[k];
  };
  return { type: "play", stack: indices.reduce((best, i) => (less(full(i), full(best)) ? i : best)) };
}
