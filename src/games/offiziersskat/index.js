import { renderCard, renderCardBack } from "../../core/card-view.js";

export { newGame } from "./rules.js";

export const id = "offiziersskat";
export const name = "Offiziersskat";

function renderRow(label, player) {
  const stacks = player.stacks
    .map((stack) => `<li class="stack">${renderCard(stack.up)}${renderCardBack()}</li>`)
    .join("");
  return `<h3 class="row__label">${label}</h3><ul class="row">${stacks}</ul>`;
}

export function render(state) {
  return `<h2>${name}</h2><div class="table">` +
    renderRow("Computer", state.players.computer) +
    renderRow("Du", state.players.human) +
    `</div>`;
}
