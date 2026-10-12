export function renderMenu(games) {
  const buttons = games
    .map((game) => `<button type="button" class="game-button" data-game-id="${game.id}">${game.name}</button>`)
    .join("");
  const rules = games.filter((game) => game.rulesHtml)
    .map((game) => `<button type="button" class="back-button" data-rules="${game.id}">Regeln</button>`).join("");
  return `<nav class="menu" aria-label="Spiele">${buttons}</nav>` +
    `<p class="menu-extra">${rules}<button type="button" class="back-button" data-action="credits">Credits</button></p>`;
}

const pixabay = (id, user, author, path) => {
  const ref = `?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=${id}`;
  return [`https://pixabay.com/de/users/${user}/${ref}`, author, `https://pixabay.com/${path}/${ref}`];
};

const SOUND_CREDITS = [
  ["Karte legen", ...pixabay(91468, "freesound_community-46691455", "freesound_community", "")],
  ["Mischen", ...pixabay(94662, "freesound_community-46691455", "freesound_community", "sound-effects/")],
  ["Gewonnen", ...pixabay(6297, "freesound_community-46691455", "freesound_community", "")],
  ["Verloren", ...pixabay(230571, "ribhavagrawal-39286533", "Ribhav Agrawal", "sound-effects/")],
];

const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

export function renderCredits() {
  const sounds = SOUND_CREDITS.map(([use, authorUrl, author, siteUrl]) =>
    `<li>${use}: Soundeffekt von ${link(authorUrl, author)} auf ${link(siteUrl, "Pixabay")}</li>`).join("");
  return `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button></div>` +
    `<section class="credits"><h2>Credits</h2>` +
    `<h3>Karten</h3><ul><li>${link("https://cardmeister.github.io/", "CardMeister")} (Unlicense, gemeinfrei)</li></ul>` +
    `<h3>Töne</h3><ul>${sounds}</ul></section>`;
}

export function renderRules(game) {
  return `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button></div>` +
    `<section class="credits rules">${game.rulesHtml}` +
    `<p>Quelle: ${link("https://de.wikipedia.org/wiki/Offiziersskat", "Offiziersskat bei Wikipedia")}</p></section>`;
}

export function renderGameScreen(game, state, options) {
  return `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button>` +
    `<button type="button" class="back-button" data-action="rules">Regeln</button>` +
    `<button type="button" class="back-button" data-action="new">Neues Spiel</button></div>` +
    `<section class="game-screen">${game.render(state, options)}</section>`;
}
