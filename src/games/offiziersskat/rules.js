import { SUITS, createDeck, shuffle } from "../../core/cards.js";

export const GAMES = [...SUITS, "grand"];
export const CARD_POINTS = { A: 11, 10: 10, K: 4, O: 3, U: 2, 9: 0, 8: 0, 7: 0 };

// Fixed deal: cards 0-15 go to the human, 16-31 to the computer, two cards for each stack.
// shortcut: the seed parity selects Vorhand, change it when S8 adds the dealer.
export function newGame(seed, vorhand = seed % 2 === 0 ? "human" : "computer") {
  const cards = shuffle(createDeck(), seed);
  const stacks = (from) =>
    Array.from({ length: 8 }, (_, i) => ({ down: cards[from + 2 * i], up: cards[from + 2 * i + 1] }));
  return { seed, vorhand, trump: null, players: { human: { stacks: stacks(0) }, computer: { stacks: stacks(16) } } };
}

export function applyMove(state, move) {
  if (move.type !== "announce") throw new Error(`Unknown move type: ${move.type}`);
  if (state.trump !== null) throw new Error("The game is already announced");
  if (!GAMES.includes(move.game)) throw new Error(`Unknown game: ${move.game}`);
  return { ...state, trump: move.game };
}

const ORDER = ["7", "8", "9", "O", "K", "10", "A"];

export function isTrump(card, trump) {
  return card.rank === "U" || card.suit === trump;
}

export function suitOf(card, trump) {
  return isTrump(card, trump) ? "trump" : card.suit;
}

// Unter rank above all other cards, Eichel-U highest (SUITS lists Eichel first).
function strength(card) {
  return card.rank === "U" ? 100 - SUITS.indexOf(card.suit) : ORDER.indexOf(card.rank);
}

export function beats(card, other, trump) {
  const suit = suitOf(card, trump);
  const otherSuit = suitOf(other, trump);
  if (suit !== otherSuit) return suit === "trump";
  return strength(card) > strength(other);
}

export function legalStacks(stacks, trump, led) {
  const open = stacks.flatMap((stack, i) => (stack.up ? [i] : []));
  if (!led) return open;
  const follow = open.filter((i) => suitOf(stacks[i].up, trump) === suitOf(led, trump));
  return follow.length ? follow : open;
}

export function trickWinner(lead, second, trump) {
  return beats(second, lead, trump) ? "second" : "lead";
}

export function playFromStack(stacks, index) {
  const { down, up } = stacks[index];
  if (!up) throw new Error(`Stack ${index} has no face-up card`);
  const next = stacks.map((stack, i) => (i === index ? { down: null, up: down } : { ...stack }));
  return { card: up, stacks: next };
}
