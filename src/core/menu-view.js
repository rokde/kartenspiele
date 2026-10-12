export function renderMenu(games) {
  const buttons = games
    .map((game) => `<button type="button" class="game-button" data-game-id="${game.id}">${game.name}</button>`)
    .join("");
  return `<nav class="menu" aria-label="Spiele">${buttons}</nav>`;
}

export function renderGameScreen(game) {
  return `<button type="button" class="back-button" data-action="back">Zurück</button>` +
    `<section class="game-screen">${game.render()}</section>`;
}
