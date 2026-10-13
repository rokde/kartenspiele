import { SUITS } from "../../core/cards.js";
import {
  BID_VALUES, CARD_POINTS, GAME_TYPES, baseValue, beats, isTrump, legalCards, rankOf, spitzen, trickWinner,
} from "./rules.js";

const points = (card) => CARD_POINTS[card.rank];

// Rules of thumb for one game type: `strength` counts trumps, Buben, side Asse and side Zehnen.
function rate(cards, type, hand = false) {
  const buben = cards.filter((c) => c.rank === "B").length;
  const side = cards.filter((c) => !isTrump(c, type));
  const aces = side.filter((c) => c.rank === "A").length;
  const tens = side.filter((c) => c.rank === "10").length;
  if (type === "null") {
    // Only low cards, and each suit in the hand has its 7.
    const low = cards.every((c) => rankOf(c, "null") <= 3);
    const sevens = SUITS.every((suit) => !cards.some((c) => c.suit === suit) || cards.some((c) => c.suit === suit && c.rank === "7"));
    return { type, strength: low && sevens ? 1 : 0, playable: low && sevens, value: baseValue({ type, hand, ouvert: false }) };
  }
  const value = (spitzen(cards, type) + (hand ? 2 : 1)) * baseValue({ type });
  if (type === "grand") {
    const strength = 2 * buben + aces + tens / 2;
    return { type, strength: strength - 8.5, playable: buben >= 2 && strength >= 8.5, value };
  }
  const trumps = cards.length - side.length;
  const strength = trumps + buben / 2 + aces + tens / 2;
  return { type, strength: strength - 7, playable: trumps >= 5 && strength >= 7, value };
}

// The highest value of a game that the hand can play. 0 means: pass at 18.
export function handValue(cards) {
  return Math.max(0, ...GAME_TYPES.map((type) => rate(cards, type)).filter((r) => r.playable).map((r) => r.value));
}

// The best game that reaches the bid: playable first, then by strength. Else the game with the highest value.
function choose(cards, bid, hand) {
  const rated = GAME_TYPES.map((type) => rate(cards, type, hand));
  const reach = rated.filter((r) => r.value >= bid);
  const pool = reach.filter((r) => r.playable).length ? reach.filter((r) => r.playable) : reach;
  if (!pool.length) return rated.reduce((a, b) => (b.value > a.value ? b : a));
  return pool.reduce((a, b) => (b.strength > a.strength ? b : a));
}

// The lowest key wins. Keys are arrays, compared from the first item.
function pick(cards, key) {
  const less = (a, b) => {
    const k = a.findIndex((x, i) => x !== b[i]);
    return k >= 0 && a[k] < b[k];
  };
  return cards.reduce((best, card) => (less(key(card), key(best)) ? card : best));
}

function bidMove(state, cards) {
  const max = handValue(cards);
  const { bid } = state;
  if (state.turn === bid.sayer) {
    const value = BID_VALUES.find((v) => v > bid.value);
    return value !== undefined && value <= max ? { type: "bid", value } : { type: "pass" };
  }
  return bid.value <= max ? { type: "yes" } : { type: "pass" };
}

// Put away cards with high points or from short suits. Keep trumps and Asse.
function discard(cards, type, hand) {
  if (type === "null") return pick(hand, (c) => [-rankOf(c, "null")]);
  const length = (c) => hand.filter((x) => !isTrump(x, type) && x.suit === c.suit).length;
  return pick(hand, (c) => [isTrump(c, type) ? 1 : 0, c.rank === "A" ? 1 : 0, length(c), -points(c), rankOf(c, type)]);
}

function playCard(state, seat, hand) {
  const { declarer } = state;
  const { type } = state.game;
  const trick = state.trick;
  const legal = legalCards(hand, type, trick[0]?.card);
  const rank = (c) => rankOf(c, type);
  const trump = (c) => (isTrump(c, type) ? 1 : 0);
  const low = (c) => [points(c), trump(c), rank(c)];
  if (!trick.length) {
    if (type === "null") return pick(legal, (c) => [rank(c)]);
    if (seat === declarer && legal.filter(trump).length >= 4) return pick(legal, (c) => [-trump(c), -rank(c)]);
    const aces = legal.filter((c) => !trump(c) && c.rank === "A");
    return aces.length ? aces[0] : pick(legal, low);
  }
  const best = trick.find((p) => p.seat === trickWinner(trick, type));
  const wins = (c) => beats(c, best.card, type);
  if (type === "null") {
    // The declarer stays below the best card. The opponents stay below the declarer, so he must take the trick.
    const under = legal.filter((c) => !wins(c));
    if (seat === declarer || best.seat === declarer) return under.length ? pick(under, (c) => [-rank(c)]) : pick(legal, (c) => [rank(c)]);
    return pick(legal, (c) => [rank(c)]);
  }
  const last = trick.length === 2;
  const partnerWins = seat !== declarer && best.seat !== declarer;
  if (partnerWins) return last ? pick(legal, (c) => [-points(c), trump(c), rank(c)]) : pick(legal, low);
  const winners = legal.filter(wins);
  const value = trick.reduce((total, p) => total + points(p.card), 0);
  if (winners.length && (value > 0 || last)) return pick(winners, (c) => [trump(c), rank(c)]);
  return pick(legal, low);
}

// The move of the seat in turn. It reads only what this seat may see: its own hand, the Skat after pickup,
// the bid and the played cards. The same state always gives the same move.
export function aiMove(state) {
  const seat = state.turn;
  const hand = state.hands[seat];
  if (state.phase === "bid") return bidMove(state, hand);
  if (state.phase === "skat") {
    const best = choose(hand, state.bid.value, true);
    // Hand only with a clear margin. Else the Skat can help.
    if (best.playable && best.strength >= 3) return { type: "declare", game: best.type };
    return { type: "pickup" };
  }
  if (state.phase === "discard") {
    const all = [...hand, ...state.skat];
    const best = choose(all, state.bid.value, false);
    if (state.skat.length < 2) return { type: "discard", card: discard(all, best.type, hand) };
    return { type: "declare", game: best.type };
  }
  return { type: "play", card: playCard(state, seat, hand) };
}

