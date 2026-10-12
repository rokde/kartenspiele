import { save, load } from "./storage.js";
import { DURATIONS } from "./motion.js";

export const SOUNDS = {
  play: "assets/sounds/card-play.mp3",
  deal: "assets/sounds/shuffle.mp3",
  win: "assets/sounds/win.mp3",
  lose: "assets/sounds/lose.mp3",
};

// Each sound follows its animation. `motions` holds the { type, delay, duration } that motion.run reports.
// A card sound follows its fly, the deal sound all deal flies, and win or lose starts when the last fly ends.
// Without motion, all sounds start at once and the deal sound stops after DURATIONS.deal.
export function timeSounds(events, motions) {
  const flies = motions.filter((m) => m.type === "play");
  const deals = motions.filter((m) => m.type === "deal");
  const end = (list) => Math.max(0, ...list.map((m) => m.delay + m.duration));
  let i = 0;
  return events.map((event) => {
    if (event === "play") return [event, flies[i++] ?? {}];
    if (event === "deal") return [event, deals.length ? { delay: deals[0].delay, duration: end(deals) - deals[0].delay } : { duration: DURATIONS.deal }];
    return [event, { delay: end(flies) }];
  });
}

// Browsers block audio before the first user gesture, so nothing plays until unlock().
export function createSound(storage, {
  createAudio = (src) => new Audio(src),
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  let muted = load(storage, "sound") === true;
  let unlocked = false;
  let preloaded = [];
  const timers = new Set();
  const playing = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const stop = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear();
    for (const audio of playing) audio.pause();
    playing.clear();
  };
  return {
    isMuted: () => muted,
    setMuted(value) {
      muted = value;
      save(storage, "sound", muted);
      if (muted) stop();
    },
    // Loading is allowed before a user gesture. The kept elements fill the browser cache for the first play.
    preload() {
      preloaded = Object.values(SOUNDS).map(createAudio);
    },
    unlock() {
      unlocked = true;
    },
    // The sound starts after `delay` ms. With a `duration`, it stops that many ms after its start.
    play(event, { delay = 0, duration } = {}) {
      if (!unlocked || muted || !Object.hasOwn(SOUNDS, event)) return;
      const audio = createAudio(SOUNDS[event]);
      const start = () => {
        playing.add(audio);
        // A blocked or failed sound is not an error for the player.
        Promise.resolve(audio.play()).catch(() => {});
        if (duration !== undefined) later(() => {
          audio.pause();
          playing.delete(audio);
        }, duration);
      };
      if (delay > 0) later(start, delay);
      else start();
    },
    // Pause each playing sound and cancel each waiting sound.
    stop,
  };
}
