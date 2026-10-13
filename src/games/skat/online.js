import { SUITS, RANKS } from "../../core/cards.js";
import { BID_VALUES, PHASES, applyMove, checkGame, checkScore, isOver, nextGame } from "./rules.js";
import { aiMove } from "./ai.js";

const copyCard = (card) => card && { suit: card.suit, rank: card.rank };
const copyPlayed = ({ seat, card }) => ({ seat, card: copyCard(card) });

// The state from the view of one seat. The seed, the log and hidden cards stay out.
// A seat sees its own hand, the declarer hand in Ouvert, and the Skat after its own pickup or after the end.
export function seatView(state, seat) {
  const open = (s) => s === seat || (state.game?.ouvert && s === state.declarer);
  const skatOpen = isOver(state) || (seat === state.declarer && state.pickedUp);
  return {
    me: seat, dealer: state.dealer, computers: [...state.computers],
    scores: state.scores.map((row) => ({ declarer: row.declarer, game: { ...row.game }, value: row.value })),
    phase: state.phase, turn: state.turn, bid: { ...state.bid }, said: [...state.said],
    declarer: state.declarer, pickedUp: state.pickedUp, game: state.game && { ...state.game },
    hands: state.hands.map((hand, s) => hand.map((card) => (open(s) ? copyCard(card) : null))),
    skat: state.skat.map((card) => (skatOpen ? copyCard(card) : null)),
    trick: state.trick.map(copyPlayed),
    tricks: state.tricks.map(({ winner, cards }) => ({ winner, cards: cards.map(copyPlayed) })),
  };
}

// The host is seat 0, guest i is seat i + 1. The computer plays the other seats on the host.
export function hostSession(links, state, onChange) {
  const send = (i) => links[i].send({ type: "state", view: seatView(state, i + 1) });
  const sendAll = () => links.forEach((_, i) => send(i));
  const apply = (seat, move) => {
    try {
      // applyMove parses the untrusted move and throws on an illegal one or one out of turn.
      state = applyMove(state, move, seat);
    } catch {
      return false;
    }
    onChange(state);
    sendAll();
    return true;
  };
  links.forEach((link, i) => link.onMessage((message) => {
    // The first view can get lost, so a guest asks for the current view. The host reads no other field.
    if (message?.type === "ready") return send(i);
    if (message?.type === "move") apply(i + 1, message.move);
  }));
  sendAll();
  return {
    move: (move) => apply(0, move),
    // The move of the computer seat in turn. False when no computer seat is in turn.
    ai: () => state.computers.includes(state.turn) && apply(state.turn, aiMove(state)),
    // Only the host calls this. No guest message starts a new game.
    next(seed) {
      state = nextGame(state, seed);
      onChange(state);
      sendAll();
    },
  };
}

const SAID = new Set(["", "Ja", "Passe", ...BID_VALUES.map(String)]);

// Host views reach the HTML. Returns a clean copy of a valid view, or null.
export function checkView(data) {
  const fail = () => { throw new Error("Invalid view"); };
  const ok = (condition) => condition || fail();
  const list = (value, max) => (ok(Array.isArray(value) && value.length <= max), value);
  const seat = (value) => (ok([0, 1, 2].includes(value)), value);
  const maybe = (value) => (value === null ? null : seat(value));
  const card = (value) => {
    if (value === null) return null;
    ok(SUITS.includes(value?.suit) && RANKS.includes(value.rank));
    return { suit: value.suit, rank: value.rank };
  };
  const played = (value) => ({ seat: seat(value?.seat), card: card(value.card) ?? fail() });
  try {
    ok(typeof data === "object" && data !== null && PHASES.includes(data.phase));
    const b = data.bid;
    ok((b?.value === 0 || BID_VALUES.includes(b.value)) && [1, 2, 3].includes(b.round) && typeof data.pickedUp === "boolean");
    const game = data.game === null ? null : checkGame(data.game) ?? fail();
    return {
      me: seat(data.me), dealer: seat(data.dealer), computers: list(data.computers, 2).map(seat),
      scores: list(data.scores, Infinity).map((row) => checkScore(row) ?? fail()),
      phase: data.phase, turn: maybe(data.turn),
      bid: { value: b.value, sayer: seat(b.sayer), hearer: maybe(b.hearer), round: b.round },
      said: (ok(list(data.said, 3).length === 3), data.said.map((s) => (ok(SAID.has(s)), s))),
      declarer: maybe(data.declarer), pickedUp: data.pickedUp, game,
      hands: (ok(list(data.hands, 3).length === 3), data.hands.map((hand) => list(hand, 12).map(card))),
      skat: list(data.skat, 2).map(card),
      trick: list(data.trick, 2).map(played),
      tricks: list(data.tricks, 10).map((t) => ({ winner: seat(t?.winner), cards: (ok(list(t.cards, 3).length === 3), t.cards.map(played)) })),
    };
  } catch {
    return null;
  }
}

export function guestSession(link, onView) {
  link.onMessage((message) => {
    const view = message?.type === "state" ? checkView(message.view) : null;
    if (view) onView(view);
  });
  link.send({ type: "ready" });
  return { move: (move) => link.send({ type: "move", move }) };
}
