export function renderMenu(games) {
  const rows = games.map((game) => `<div class="menu__row" role="group" aria-label="${game.name}">` +
    `<button type="button" class="game-button" data-game-id="${game.id}">${game.name}</button>` +
    (game.online ? `<button type="button" class="game-button game-button--duo" data-online="${game.id}">${game.onlineLabel ?? "Zu zweit spielen"}</button>` : "") +
    (game.rulesHtml ? `<button type="button" class="back-button" data-rules="${game.id}" aria-label="Regeln ${game.name}" title="Regeln ${game.name}">Regeln</button>` : "") +
    `</div>`).join("");
  return `<nav class="menu" aria-label="Spiele">${rows}</nav>` +
    `<p class="menu-extra"><button type="button" class="back-button" data-action="credits">Credits</button></p>`;
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
    `<h3>Töne</h3><ul>${sounds}</ul>` +
    `<h3>Zu zweit spielen</h3><ul><li>${link("https://github.com/peers/peerjs", "PeerJS")} (MIT-Lizenz). ` +
    `Im Spiel zu zweit baut der öffentliche Vermittlungsserver 0.peerjs.com die Verbindung auf. ` +
    `PeerJS fragt dazu auch den STUN-Server von Google (stun.l.google.com). ` +
    `Wenn keine direkte Verbindung möglich ist, leiten die TURN-Server von PeerJS die Spieldaten weiter. ` +
    `Der Mitspieler und diese Server sehen die IP-Adresse beider Browser.</li></ul></section>`;
}

const backBar = `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button></div>`;

export function renderRoomChoice(title = "Zu zweit spielen") {
  return backBar + `<section class="room"><h2>${title}</h2>` +
    `<p>Öffne einen Raum und gib den Code deinem Mitspieler. Oder tritt mit seinem Code bei.</p>` +
    `<p class="room__actions"><button type="button" class="game-button" data-action="host">Raum öffnen</button>` +
    `<button type="button" class="game-button" data-action="join">Raum beitreten</button></p></section>`;
}

// `code` must be a normalized room code. The screen never shows the raw input.
// With `start`, the host can start the game before the room is full.
export function renderRoom(code, status, { copy = false, start = false } = {}) {
  return backBar + `<section class="room"><h2>Raum ${copy ? "geöffnet" : "beitreten"}</h2>` +
    `<p class="room__code">${code}</p>` +
    (copy ? `<p class="room__actions"><button type="button" class="back-button" data-action="copy">Code kopieren</button></p>` : "") +
    `<p class="status" role="status">${status}</p>` +
    (start ? `<p class="room__actions"><button type="button" class="game-button" data-action="start">Spiel starten</button></p>` : "") + `</section>`;
}

export function renderJoinForm() {
  return backBar + `<section class="room"><h2>Raum beitreten</h2>` +
    `<form class="room__form"><label for="room-code">Code</label>` +
    `<input id="room-code" class="room__input" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="KREUZ-42">` +
    `<button type="submit" class="game-button" data-action="join-code">Beitreten</button></form>` +
    `<p class="room__hint" role="alert"></p></section>`;
}

export function renderRules(game) {
  return `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button></div>` +
    `<section class="credits rules">${game.rulesHtml}` +
    `<p>Quelle: ${link(...(game.source ?? ["https://de.wikipedia.org/wiki/Offiziersskat", "Offiziersskat bei Wikipedia"]))}</p></section>`;
}

// The other player left the online game.
export function renderLeft() {
  return `<div class="leave-notice"><p class="leave-notice__text" role="alert">Mitspieler hat das Spiel verlassen</p>` +
    `<button type="button" class="game-button" data-action="back">Zum Menü</button></div>`;
}

const confirmNew = `<div class="leave-notice confirm-new" role="alertdialog" aria-labelledby="confirm-new-text">` +
  `<p id="confirm-new-text" class="leave-notice__text">Neues Spiel starten? Die Spielliste wird gelöscht.</p>` +
  `<p class="confirm-new__actions"><button type="button" class="game-button" data-action="new-confirm">Neues Spiel starten</button>` +
  `<button type="button" class="back-button" data-action="new-cancel">Abbrechen</button></p></div>`;

// An online game has no restart and no rules page, so its bar has only "Zurück".
// With `left`, the game shows the leave notice above the table. With `confirmNew`, it asks before a restart.
export function renderGameScreen(game, state, options = {}) {
  return `<div class="screen-bar"><button type="button" class="back-button" data-action="back">Zurück</button>` +
    (options.online ? "" : `<button type="button" class="back-button" data-action="rules">Regeln</button>` +
    `<button type="button" class="back-button" data-action="new">Neues Spiel</button>`) + `</div>` +
    (options.confirmNew && !options.online ? confirmNew : "") +
    `<section class="game-screen">${options.left ? renderLeft() : ""}${game.render(state, options)}</section>`;
}
