import { save, load } from "./storage.js";

export const SOUNDS = {
  play: "assets/sounds/card-play.mp3",
  deal: "assets/sounds/shuffle.mp3",
  win: "assets/sounds/win.mp3",
  lose: "assets/sounds/lose.mp3",
};

// Browsers block audio before the first user gesture, so nothing plays until unlock().
export function createSound(storage, createAudio = (src) => new Audio(src)) {
  let muted = load(storage, "sound") === true;
  let unlocked = false;
  return {
    isMuted: () => muted,
    setMuted(value) {
      muted = value;
      save(storage, "sound", muted);
    },
    unlock() {
      unlocked = true;
    },
    play(event) {
      if (!unlocked || muted || !Object.hasOwn(SOUNDS, event)) return;
      // A blocked or failed sound is not an error for the player.
      Promise.resolve(createAudio(SOUNDS[event]).play()).catch(() => {});
    },
  };
}
