import { SUITS, createDeck, shuffle } from "../../core/cards.js";

export const GAMES = [...SUITS, "grand"];
export const CARD_POINTS = { A: 11, 10: 10, K: 4, O: 3, U: 2, 9: 0, 8: 0, 7: 0 };

// Fixed deal: cards 0-15 go to the human, 16-31 to the computer, two cards for each stack.
// shortcut: the seed parity selects Vorhand, change it when S8 adds the dealer.
export function newGame(seed, vorhand = seed % 2 === 0 ? "human" : "computer") {
  const cards = shuffle(createDeck(), seed);
  const stacks = (from) =>
    Array.from({ length: 8 }, (_, i) => ({ down: cards[from + 2 * i], up: cards[from + 2 * i + 1] }));
  return {
    seed, vorhand, trump: null, turn: vorhand, trick: [], tricks: [],
    players: { human: { stacks: stacks(0) }, computer: { stacks: stacks(16) } },
  };
}

export const isOver = (state) => state.tricks.length === 16;

export function applyMove(state, move) {
  if (move.type === "play") return play(state, move.stack);
  if (move.type !== "announce") throw new Error(`Unknown move type: ${move.type}`);
  if (state.trump !== null) throw new Error("The game is already announced");
  if (!GAMES.includes(move.game)) throw new Error(`Unknown game: ${move.game}`);
  return { ...state, trump: move.game };
}

// The legal stacks of the player in turn, for the lead card of the open trick.
export function legalStacksFor(state) {
  return legalStacks(state.players[state.turn].stacks, state.trump, state.trick[0]?.card);
}

function play(state, index) {
  if (state.trump === null) throw new Error("The game is not announced yet");
  if (isOver(state)) throw new Error("The game is over");
  if (!legalStacksFor(state).includes(index)) throw new Error(`Stack ${index} is not legal`);
  const player = state.turn;
  const { card, stacks } = playFromStack(state.players[player].stacks, index);
  const players = { ...state.players, [player]: { stacks } };
  const trick = [...state.trick, { player, card }];
  if (trick.length < 2) return { ...state, players, trick, turn: player === "human" ? "computer" : "human" };
  const winner = trick[trickWinner(trick[0].card, trick[1].card, state.trump) === "lead" ? 0 : 1].player;
  return { ...state, players, trick: [], tricks: [...state.tricks, { winner, cards: trick }], turn: winner };
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
