import { SUITS, RANKS, createDeck, shuffle } from "../../core/cards.js";

export const CARD_POINTS = { A: 11, 10: 10, K: 4, D: 3, B: 2, 9: 0, 8: 0, 7: 0 };
export const SUIT_BASE = { kreuz: 12, pik: 11, herz: 10, karo: 9 };
export const GAME_TYPES = [...SUITS, "grand", "null"];
export const PHASES = ["bid", "skat", "discard", "play", "over", "passed"];
const FLAGS = ["schneider", "schwarz", "ouvert"];

const nullValue = (game) => (game.hand ? (game.ouvert ? 59 : 35) : game.ouvert ? 46 : 23);
export const baseValue = (game) => (game.type === "null" ? nullValue(game) : game.type === "grand" ? 24 : SUIT_BASE[game.type]);

// All game values that can occur. Suit games go up to 18 times the base, Grand up to 11 times.
const times = (base, max) => Array.from({ length: max - 1 }, (_, i) => base * (i + 2));
export const BID_VALUES = [...new Set([
  ...SUITS.flatMap((suit) => times(SUIT_BASE[suit], 18)), ...times(24, 11), 23, 35, 46, 59,
])].sort((a, b) => a - b);

export const vorhand = (state) => (state.dealer + 1) % 3;
export const mittelhand = (state) => (state.dealer + 2) % 3;
export const hinterhand = (state) => state.dealer;

export const sameCard = (a, b) => a.suit === b.suit && a.rank === b.rank;
const without = (cards, card) => cards.filter((c) => !sameCard(c, card));
const sum = (cards) => cards.reduce((total, card) => total + CARD_POINTS[card.rank], 0);

// The deal goes 3-Skat-4-3 from Vorhand. `seat` is a seat or "skat".
export function dealSteps(dealer) {
  const order = [0, 1, 2].map((i) => (dealer + 1 + i) % 3);
  const round = (first, count) => order.map((seat) => ({ seat, first, count }));
  return [...round(0, 3), { seat: "skat", first: 0, count: 2 }, ...round(3, 4), ...round(7, 3)];
}

export function newGame(seed, dealer = 0, scores = [], computers = [1, 2]) {
  const deck = shuffle(createDeck(), seed);
  const hands = [[], [], []];
  let skat = [];
  let next = 0;
  for (const { seat, count } of dealSteps(dealer)) {
    const cards = deck.slice(next, next += count);
    if (seat === "skat") skat = cards;
    else hands[seat].push(...cards);
  }
  const state = { seed, dealer, computers, scores, log: [], hands, skat, phase: "bid", said: ["", "", ""],
    declarer: null, pickedUp: false, game: null, trick: [], tricks: [] };
  // Mittelhand bids to Vorhand first.
  return { ...state, bid: { value: 0, sayer: mittelhand(state), hearer: vorhand(state), round: 1 }, turn: mittelhand(state) };
}

export const isOver = (state) => state.phase === "over" || state.phase === "passed";

export function nextGame(state, seed) {
  if (!isOver(state)) throw new Error("The game is not over");
  return newGame(seed, (state.dealer + 1) % 3, state.scores, state.computers);
}

// Order inside a suit, lowest first.
const SUIT_ORDER = ["7", "8", "9", "D", "K", "10", "A"];
const NULL_ORDER = ["7", "8", "9", "10", "B", "D", "K", "A"];

export const isTrump = (card, type) => type !== "null" && (card.rank === "B" || card.suit === type);
export const suitOf = (card, type) => (isTrump(card, type) ? "trump" : card.suit);

// A higher number is a higher card in its suit. Buben rank above all, Kreuz-Bube highest.
export function rankOf(card, type) {
  if (type === "null") return NULL_ORDER.indexOf(card.rank);
  return card.rank === "B" ? 100 - SUITS.indexOf(card.suit) : SUIT_ORDER.indexOf(card.rank);
}

// True when `card` beats `best`, the card that wins the trick so far.
export function beats(card, best, type) {
  const suit = suitOf(card, type);
  if (suit !== suitOf(best, type)) return suit === "trump";
  return rankOf(card, type) > rankOf(best, type);
}

export function trickWinner(trick, type) {
  return trick.reduce((best, played) => (beats(played.card, best.card, type) ? played : best)).seat;
}

export function legalCards(hand, type, lead) {
  if (!lead) return hand;
  const follow = hand.filter((card) => suitOf(card, type) === suitOf(lead, type));
  return follow.length ? follow : hand;
}

// Spitzen: the number of top trumps that the declarer has (mit) or misses (ohne) in a row.
export function spitzen(cards, type) {
  const top = [...SUITS.map((suit) => ({ suit, rank: "B" })),
    ...(type === "grand" ? [] : [...SUIT_ORDER].reverse().map((rank) => ({ suit: type, rank })))];
  const has = (card) => cards.some((c) => sameCard(c, card));
  const mit = has(top[0]);
  let n = 0;
  while (n < top.length && has(top[n]) === mit) n++;
  return n;
}

// The result of a finished game by ISkO. The Skat counts for the declarer.
export function result(state) {
  const { game, declarer, tricks, skat } = state;
  const bid = state.bid.value;
  const own = tricks.filter((t) => t.winner === declarer);
  const base = baseValue(game);
  let won;
  let value = base;
  let points = 0;
  if (game.type === "null") {
    won = own.length === 0;
  } else {
    points = sum([...own.flatMap((t) => t.cards.map((p) => p.card)), ...skat]);
    const cards = [...tricks.flatMap((t) => t.cards.filter((p) => p.seat === declarer).map((p) => p.card)), ...skat];
    const schneider = points >= 90 || points <= 30 || game.schneider;
    const schwarz = own.length === 0 || own.length === 10 || game.schwarz;
    const levels = [game.hand, schneider, game.schneider, schwarz, game.schwarz, game.ouvert].filter(Boolean).length;
    value = (spitzen(cards, game.type) + 1 + levels) * base;
    won = points >= 61 && (!game.schneider || points >= 90) && (!game.schwarz || own.length === 10);
  }
  // Überreizt: the game is lost with the smallest multiple of the base value that reaches the bid.
  const overbid = value < bid;
  if (overbid) value = Math.ceil(bid / base) * base;
  won = won && !overbid;
  return { won, value, score: won ? value : -2 * value, points, overbid };
}

const isCard = (value) => SUITS.includes(value?.suit) && RANKS.includes(value.rank);
const copyCard = (value) => (isCard(value) ? { suit: value.suit, rank: value.rank } : null);

// Moves come from the UI, the AI, saves and guests. Returns a clean move, or null.
export function parseMove(move) {
  switch (move?.type) {
    case "bid":
      return BID_VALUES.includes(move.value) ? { type: "bid", value: move.value } : null;
    case "yes":
    case "pass":
    case "pickup":
      return { type: move.type };
    case "discard":
    case "takeback":
    case "play": {
      const card = copyCard(move.card);
      return card && { type: move.type, card };
    }
    case "declare":
      if (!GAME_TYPES.includes(move.game) || !FLAGS.every((f) => move[f] === undefined || typeof move[f] === "boolean")) return null;
      return { type: "declare", game: move.game, ...Object.fromEntries(FLAGS.map((f) => [f, move[f] === true])) };
    default:
      return null;
  }
}

// Throws on a move that is not legal, or on a move of a seat that is not in turn. The state stays unchanged.
export function applyMove(state, input, seat = state.turn) {
  const move = parseMove(input);
  if (!move) throw new Error("Malformed move");
  if (isOver(state)) throw new Error("The game is over");
  if (seat !== state.turn) throw new Error("Not in turn");
  const next = { bid, skat: skatPhase, discard: discardPhase, play: playPhase }[state.phase](state, move);
  return { ...next, log: [...state.log, move] };
}

function bid(state, move) {
  const { bid: b, turn: seat } = state;
  const said = [...state.said];
  if (move.type === "bid") {
    if (seat !== b.sayer || move.value <= b.value) throw new Error("Illegal bid");
    said[seat] = String(move.value);
    const next = { ...state, said, bid: { ...b, value: move.value } };
    return b.hearer === null ? toDeclarer(next, seat) : { ...next, turn: b.hearer };
  }
  if (move.type === "yes") {
    if (seat !== b.hearer) throw new Error("Only the hearer says yes");
    said[seat] = "Ja";
    return { ...state, said, turn: b.sayer };
  }
  if (move.type !== "pass") throw new Error("Not a bid move");
  said[seat] = "Passe";
  const next = { ...state, said };
  // All 3 seats passed: eingepasst.
  if (b.round === 3) return { ...next, phase: "passed", turn: null };
  const winner = seat === b.sayer ? b.hearer : b.sayer;
  if (b.round === 1) return { ...next, bid: { ...b, sayer: hinterhand(state), hearer: winner, round: 2 }, turn: hinterhand(state) };
  if (b.value > 0) return toDeclarer(next, winner);
  // Nobody bid: the last seat can play for 18 or pass.
  return { ...next, bid: { ...b, sayer: winner, hearer: null, round: 3 }, turn: winner };
}

const toDeclarer = (state, seat) => ({ ...state, phase: "skat", declarer: seat, turn: seat });

function skatPhase(state, move) {
  if (move.type === "declare") return declare(state, move, true);
  if (move.type !== "pickup") throw new Error("Take the Skat or declare a Hand game");
  const hands = state.hands.map((hand, seat) => (seat === state.declarer ? [...hand, ...state.skat] : hand));
  return { ...state, hands, skat: [], pickedUp: true, phase: "discard" };
}

function discardPhase(state, move) {
  const seat = state.declarer;
  const hand = state.hands[seat];
  const set = (cards, skat) => ({ ...state, hands: state.hands.map((h, s) => (s === seat ? cards : h)), skat });
  if (move.type === "discard") {
    if (state.skat.length >= 2 || !hand.some((c) => sameCard(c, move.card))) throw new Error("Cannot put away this card");
    return set(without(hand, move.card), [...state.skat, move.card]);
  }
  if (move.type === "takeback") {
    if (!state.skat.some((c) => sameCard(c, move.card))) throw new Error("The card is not in the Skat");
    return set([...hand, move.card], without(state.skat, move.card));
  }
  if (move.type !== "declare" || state.skat.length !== 2) throw new Error("Put away exactly 2 cards, then declare");
  return declare(state, move, false);
}

// Ouvert in a suit game or Grand includes Schwarz angesagt, and Schwarz includes Schneider.
function declare(state, move, hand) {
  const isNull = move.game === "null";
  if (isNull ? move.schneider || move.schwarz : !hand && (move.schneider || move.schwarz || move.ouvert)) {
    throw new Error("This announcement is not allowed");
  }
  const schwarz = !isNull && (move.schwarz || move.ouvert);
  const game = { type: move.game, hand, schneider: !isNull && (move.schneider || schwarz), schwarz, ouvert: move.ouvert };
  return { ...state, game, phase: "play", turn: vorhand(state) };
}

function playPhase(state, move) {
  if (move.type !== "play") throw new Error("Play a card");
  const seat = state.turn;
  const { type } = state.game;
  if (!legalCards(state.hands[seat], type, state.trick[0]?.card).some((c) => sameCard(c, move.card))) throw new Error("Illegal card");
  const hands = state.hands.map((hand, s) => (s === seat ? without(hand, move.card) : hand));
  const trick = [...state.trick, { seat, card: move.card }];
  if (trick.length < 3) return { ...state, hands, trick, turn: (seat + 1) % 3 };
  const winner = trickWinner(trick, type);
  const next = { ...state, hands, trick: [], tricks: [...state.tricks, { winner, cards: trick }], turn: winner };
  // A Null game ends at the first trick of the declarer.
  if (next.tricks.length < 10 && !(type === "null" && winner === state.declarer)) return next;
  const done = { ...next, phase: "over", turn: null };
  return { ...done, scores: [...state.scores, { declarer: state.declarer, game: state.game, value: result(done).score }] };
}

// Totals for each seat from the score list.
export const totals = (scores) => [0, 1, 2].map((seat) => scores.reduce((total, row) => total + (row.declarer === seat ? row.value : 0), 0));

const isSeat = (value) => [0, 1, 2].includes(value);

// A clean copy of a game object, or null.
export function checkGame(value) {
  if (!GAME_TYPES.includes(value?.type) || ![...FLAGS, "hand"].every((f) => typeof value[f] === "boolean")) return null;
  return { type: value.type, hand: value.hand, schneider: value.schneider, schwarz: value.schwarz, ouvert: value.ouvert };
}

// A clean copy of a score row, or null.
export function checkScore(value) {
  const game = checkGame(value?.game);
  return game && isSeat(value.declarer) && Number.isInteger(value.value) && value.value !== 0 && Math.abs(value.value) <= 2000
    ? { declarer: value.declarer, game, value: value.value } : null;
}

// Saved data is untrusted. The save replays its seed and moves, so only legal states come back. Returns null when invalid.
export function restore(data) {
  try {
    const computers = data.computers;
    const scores = data.scores.map(checkScore);
    if (!Number.isInteger(data.seed) || !isSeat(data.dealer) || scores.includes(null) || !Array.isArray(data.log) ||
      !Array.isArray(computers) || !computers.every(isSeat) || new Set(computers).size !== computers.length) return null;
    return data.log.reduce((state, move) => applyMove(state, move), newGame(data.seed, data.dealer, scores, [...computers]));
  } catch {
    return null;
  }
}
