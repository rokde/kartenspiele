import { cardName } from "./cards.js";

export const TRICK_PAUSE = 2500;
export const DURATIONS = { deal: 300, fly: 300, sweep: 350 };
export const DEAL_STAGGER = 40;
export const DEAL_STEP = 250;
const EASE = "cubic-bezier(0.2, 0.8, 0.3, 1)";

const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];

// The transform that puts an element with the rect `at` onto the rect `target`.
function onto(at, target) {
  const [ax, ay] = center(at);
  const [tx, ty] = center(target);
  return `translate(${tx - ax}px, ${ty - ay}px) scale(${target.height / at.height})`;
}

// Animation never changes the state. A view renders the new state and finds the elements to move.
export function createMotion({
  reduced = false,
  animate = (element, frames, options) => element.animate(frames, options),
  setTimeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  let open = [];
  let timer = null;
  let winner = null;

  const start = (element, frames, options) => {
    const animation = animate(element, frames, { easing: EASE, ...options });
    open.push(animation);
    return animation;
  };

  // FLIP: the element is already at its new place. It starts at the old rect and moves home.
  const flyIn = (view, element, from, options) =>
    start(element, [{ transform: onto(view.rect(element), from) }, { transform: "none" }], { fill: "backwards", ...options });

  function sweep(view, ghosts, player) {
    const pile = view.pile(player);
    for (const ghost of ghosts) {
      if (reduced || !pile) {
        view.drop(ghost);
        continue;
      }
      const frames = [{ transform: "none", opacity: 1 }, { transform: onto(view.rect(ghost), view.rect(pile)), opacity: 0.5 }];
      const drop = () => view.drop(ghost);
      start(ghost, frames, { duration: DURATIONS.sweep, fill: "forwards" }).finished.then(drop, drop);
    }
  }

  // `timed(event, delay, duration)` gets the schedule of each deal and play animation, so that sound can follow it.
  function run(events, view, timed = () => {}) {
    for (const animation of open) animation.finish();
    open = [];
    clearTimeout(timer);
    timer = null;
    // The next card clears the waiting trick at once. The sweep runs before that card flies.
    const swept = events.some((e) => e.type === "play") ? winner : null;
    const ghosts = swept ? view.lift() : [];
    winner = null;
    const from = new Map();
    for (const event of events) {
      const element = event.type === "play" && view.card(event.card);
      if (element) from.set(event, view.rect(element));
    }
    view.render();
    const trick = events.find((e) => e.type === "trick");
    if (trick) {
      winner = trick.winner;
      timer = setTimeout(() => {
        timer = null;
        const player = winner;
        winner = null;
        sweep(view, view.lift(), player);
      }, TRICK_PAUSE);
    }
    sweep(view, ghosts, swept);
    if (reduced) return Promise.resolve();
    let delay = ghosts.length ? DURATIONS.sweep : 0;
    for (const event of events) {
      if (event.type === "deal") {
        const deck = view.deck();
        const dealt = deck ? view.dealt(event) : [];
        dealt.forEach((element, i) =>
          flyIn(view, element, view.rect(deck), { duration: DURATIONS.deal, delay: delay + i * DEAL_STAGGER }));
        if (dealt.length) timed(event, delay, (dealt.length - 1) * DEAL_STAGGER + DURATIONS.deal);
        delay += DEAL_STEP;
      } else if (event.type === "play") {
        const element = from.has(event) && view.card(event.card);
        if (element) flyIn(view, element, from.get(event), { duration: DURATIONS.fly, delay });
        timed(event, delay, DURATIONS.fly);
        delay += DURATIONS.fly;
      }
    }
    return Promise.allSettled(open.map((a) => a.finished)).then(() => {});
  }

  // The player left the game screen. The waiting trick stays on the table until the next card.
  function cancel() {
    clearTimeout(timer);
    timer = null;
    winner = null;
  }

  return { run, cancel };
}

// The view for the game screen in `root`. `render` shows the current state, `onClear` notes a swept trick.
export function domView(root, render, onClear) {
  const rect = (element) => element.getBoundingClientRect();
  return {
    render,
    rect,
    card: (card) => root.querySelector(`.card[aria-label="${cardName(card)}"]`),
    deck: () => root.querySelector(".deal-stack"),
    pile: (player) => root.querySelector(`.pile[data-player="${player}"] .card-back:last-child`) ??
      root.querySelector(`.pile[data-player="${player}"] .pile__slot`),
    dealt: ({ player, side, stacks }) => stacks
      .map((i) => root.querySelector(`.row[data-player="${player}"] > .stack:nth-child(${i + 1}) ${side === "up" ? ".card" : ".card-back"}`))
      .filter(Boolean),
    // Copies of the trick cards stay at their place on top of the page. The trick area gets empty.
    lift() {
      const ghosts = [...root.querySelectorAll(".trick__card .card")].map((card) => {
        const { left, top, width, height } = rect(card);
        const ghost = card.cloneNode(true);
        ghost.classList.add("ghost");
        ghost.setAttribute("aria-hidden", "true");
        Object.assign(ghost.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
        root.ownerDocument.body.append(ghost);
        return ghost;
      });
      root.querySelector(".trick__cards")?.replaceChildren();
      root.querySelector(".trick__winner")?.remove();
      onClear();
      return ghosts;
    },
    drop: (ghost) => ghost.remove(),
  };
}
