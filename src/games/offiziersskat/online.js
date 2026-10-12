import { SUITS, RANKS } from "../../core/cards.js";
import { GAMES, applyMove, isOver, legalStacksFor, nextGame } from "./rules.js";

const ROLES = ["human", "computer"];
const swap = (player) => (player === "human" ? "computer" : "human");
const copyCard = (card) => card && { suit: card.suit, rank: card.rank };
const played = ({ player, card }) => ({ player: swap(player), card: copyCard(card) });
const hide = ({ stacks }) => ({ stacks: stacks.map(({ down, up }) => ({ down: down ? true : null, up: copyCard(up) })) });

// The state from the view of the guest (rules seat `computer`). The seed would give the full shuffle, so it stays out.
export function guestView(state) {
  const guestTurn = state.turn === "computer" && state.trump !== null && !isOver(state);
  return {
    dealer: swap(state.dealer), vorhand: swap(state.vorhand), turn: swap(state.turn), trump: state.trump,
    scores: state.scores.map((score) => ({ human: score.computer, computer: score.human })),
    trick: state.trick.map(played),
    tricks: state.tricks.map(({ winner, cards }) => ({ winner: swap(winner), cards: cards.map(played) })),
    players: { human: hide(state.players.computer), computer: hide(state.players.human) },
    stock: state.stock.map(() => null),
    legal: guestTurn ? legalStacksFor(state) : [],
  };
}

const isStack = (value) => Number.isInteger(value) && value >= 0 && value <= 7;

// Guest messages are untrusted. Returns a clean move, or null.
function parseMove(message) {
  const move = message?.type === "move" ? message.move : null;
  if (move?.type === "play" && isStack(move.stack)) return { type: "play", stack: move.stack };
  if (move?.type === "announce" && GAMES.includes(move.game)) return { type: "announce", game: move.game };
  return null;
}

export function hostSession(link, state, onChange) {
  const send = () => link.send({ type: "state", view: guestView(state) });
  const apply = (seat, move) => {
    if (seat !== (state.trump === null ? state.vorhand : state.turn)) return false;
    try {
      state = applyMove(state, move);
    } catch {
      return false;
    }
    onChange(state);
    send();
    return true;
  };
  link.onMessage((message) => {
    // The first view can get lost, so the guest asks for the current view. The host reads no other field.
    if (message?.type === "ready") return send();
    const move = parseMove(message);
    if (move) apply("computer", move);
  });
  send();
  return {
    move: (move) => apply("human", move),
    // Only the host calls this. No guest message starts a new game.
    next(seed) {
      state = nextGame(state, seed);
      onChange(state);
      send();
    },
  };
}

// Host views reach the HTML. Returns a clean copy of a valid view, or null.
export function checkView(data) {
  const fail = () => { throw new Error("Invalid view"); };
  const ok = (condition) => condition || fail();
  const list = (value, max) => (ok(Array.isArray(value) && value.length <= max), value);
  const role = (value) => (ok(ROLES.includes(value)), value);
  const card = (value) => {
    if (value === null) return null;
    ok(SUITS.includes(value?.suit) && RANKS.includes(value.rank));
    return { suit: value.suit, rank: value.rank };
  };
  const cardPlayed = (value) => ({ player: role(value?.player), card: card(value.card) ?? fail() });
  const stacks = (value) => {
    ok(list(value?.stacks, 8).length === 8);
    return { stacks: value.stacks.map((stack) => ({ down: stack?.down === true || (ok(stack.down === null), null), up: card(stack.up) })) };
  };
  const points = (x) => (ok(Number.isInteger(x) && x >= 0 && x <= 120), x);
  try {
    ok(typeof data === "object" && data !== null);
    ok(data.trump === null || GAMES.includes(data.trump));
    return {
      dealer: role(data.dealer), vorhand: role(data.vorhand), turn: role(data.turn), trump: data.trump,
      scores: list(data.scores, Infinity).map((s) => ({ human: points(s?.human), computer: points(s.computer) })),
      trick: list(data.trick, 1).map(cardPlayed),
      tricks: list(data.tricks, 16).map((t) => ({ winner: role(t?.winner), cards: (ok(list(t.cards, 2).length === 2), t.cards.map(cardPlayed)) })),
      players: { human: stacks(data.players?.human), computer: stacks(data.players.computer) },
      stock: list(data.stock, 32).map((x) => (ok(x === null), null)),
      legal: list(data.legal, 8).map((i) => (ok(isStack(i)), i)),
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
