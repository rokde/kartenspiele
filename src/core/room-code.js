// "König" is "KOENIG" in a code, so that the code is easy to type on a phone.
export const ROOM_WORDS = ["KREUZ", "PIK", "HERZ", "KARO", "BUBE", "DAME", "KOENIG", "ASS"];

export function makeRoomCode(random = Math.random) {
  const word = ROOM_WORDS[Math.floor(random() * ROOM_WORDS.length)];
  const digits = String(Math.floor(random() * 100)).padStart(2, "0");
  return `${word}-${digits}`;
}

export function normalizeRoomCode(input) {
  const match = String(input ?? "").toUpperCase().replace(/Ö/g, "OE").replace(/\s+/g, "").match(/^([A-Z]+)-?(\d{2})$/);
  return match && ROOM_WORDS.includes(match[1]) ? `${match[1]}-${match[2]}` : null;
}

export const peerId = (code) => `karten-${code}`;
