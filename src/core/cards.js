export const SUITS = ["eichel", "gruen", "rot", "schellen"];
export const RANKS = ["7", "8", "9", "10", "U", "O", "K", "A"];

export const SUIT_SYMBOLS = { eichel: "🌰", gruen: "🍃", rot: "♥", schellen: "🔔" };

const SUIT_NAMES = { eichel: "Eichel", gruen: "Grün", rot: "Rot", schellen: "Schellen" };
const RANK_NAMES = {
  7: "Sieben", 8: "Acht", 9: "Neun", 10: "Zehn",
  U: "Unter", O: "Ober", K: "König", A: "Ass",
};

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

// mulberry32: a small seeded PRNG, so that the same seed gives the same game.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards, seed) {
  const random = mulberry32(seed);
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function cardName(card) {
  return `${SUIT_NAMES[card.suit]} ${RANK_NAMES[card.rank]}`;
}
