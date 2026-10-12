import { createDeck, shuffle } from "../../core/cards.js";

// Fixed deal: cards 0-15 go to the human, 16-31 to the computer, two cards for each stack.
export function newGame(seed) {
  const cards = shuffle(createDeck(), seed);
  const stacks = (from) =>
    Array.from({ length: 8 }, (_, i) => ({ down: cards[from + 2 * i], up: cards[from + 2 * i + 1] }));
  return { seed, players: { human: { stacks: stacks(0) }, computer: { stacks: stacks(16) } } };
}
