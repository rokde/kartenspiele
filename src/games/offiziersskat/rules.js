import { SUITS, createDeck, shuffle } from "../../core/cards.js";

export const GAMES = [...SUITS, "grand"];
export const CARD_POINTS = { A: 11, 10: 10, K: 4, D: 3, B: 2, 9: 0, 8: 0, 7: 0 };

// The dealer deals in steps of 4 cards: [role, first stack, side]. Vorhand is the non-dealer.
const FIRST_DEAL = [["vorhand", 0, "down"], ["dealer", 0, "down"], ["vorhand", 0, "up"]];
const REST_DEAL = [["dealer", 0, "up"], ["vorhand", 4, "down"], ["dealer", 4, "down"], ["vorhand", 4, "up"], ["dealer", 4, "up"]];

// Vorhand announces from the first deal only. The undealt cards stay hidden in the stock.
export function newGame(seed, dealer = "computer", scores = []) {
  const vorhand = other(dealer);
  const empty = () => Array.from({ length: 8 }, () => ({ down: null, up: null }));
  return deal({
    seed, dealer, vorhand, scores, trump: null, turn: vorhand, trick: [], tricks: [],
    players: { human: { stacks: empty() }, computer: { stacks: empty() } }, stock: shuffle(createDeck(), seed),
  }, FIRST_DEAL);
}

function deal(state, steps) {
  const players = { ...state.players };
  let stock = state.stock;
  for (const [role, first, side] of steps) {
    const player = state[role];
    const cards = stock.slice(0, 4);
    stock = stock.slice(4);
    players[player] = { stacks: players[player].stacks.map((stack, i) =>
      (i >= first && i < first + 4 ? { ...stack, [side]: cards[i - first] } : stack)) };
  }
  return { ...state, players, stock };
}

export const isOver = (state) => state.tricks.length === 16;

const other = (player) => (player === "human" ? "computer" : "human");

export function nextGame(state, seed) {
  if (!isOver(state)) throw new Error("The game is not over");
  return newGame(seed, other(state.dealer), state.scores);
}

export function points(state) {
  const sum = { human: 0, computer: 0 };
  for (const { winner, cards } of state.tricks) for (const { card } of cards) sum[winner] += CARD_POINTS[card.rank];
  return sum;
}

// The announcer (Vorhand) wins with 61 points or more. With 60:60 the opponent wins.
export function winner(state) {
  return points(state)[state.vorhand] >= 61 ? state.vorhand : other(state.vorhand);
}

export function applyMove(state, move) {
  if (move.type === "play") return play(state, move.stack);
  if (move.type !== "announce") throw new Error(`Unknown move type: ${move.type}`);
  if (state.trump !== null) throw new Error("The game is already announced");
  if (!GAMES.includes(move.game)) throw new Error(`Unknown game: ${move.game}`);
  return deal({ ...state, trump: move.game }, REST_DEAL);
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
  if (trick.length < 2) return { ...state, players, trick, turn: other(player) };
  const winner = trick[trickWinner(trick[0].card, trick[1].card, state.trump) === "lead" ? 0 : 1].player;
  const next = { ...state, players, trick: [], tricks: [...state.tricks, { winner, cards: trick }], turn: winner };
  return isOver(next) ? { ...next, scores: [...state.scores, points(next)] } : next;
}

const ORDER = ["7", "8", "9", "D", "K", "10", "A"];

export function isTrump(card, trump) {
  return card.rank === "B" || card.suit === trump;
}

export function suitOf(card, trump) {
  return isTrump(card, trump) ? "trump" : card.suit;
}

// Buben rank above all other cards, Kreuz-Bube highest (SUITS lists Kreuz first).
function strength(card) {
  return card.rank === "B" ? 100 - SUITS.indexOf(card.suit) : ORDER.indexOf(card.rank);
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
