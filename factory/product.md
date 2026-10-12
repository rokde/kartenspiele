# Product: Karten

## Goal
One player gets a card game site that runs only in the browser. The player plays Offiziersskat against a computer, or against a friend in a second browser through a short room code. The game uses the Wikipedia rules, a Skat deck, light animations, and sound, and a game registry lets us add more games later.

## Scope
- In: one static web app (HTML, CSS, JavaScript modules). No server code.
- In: a game menu with a registry. Each game is one module with one common interface.
- In: a 32-card Skat deck with French suits and German names (Kreuz, Pik, Herz, Karo; 7, 8, 9, 10, Bube, Dame, König, Ass). The card faces come from CardMeister (https://cardmeister.github.io/, Unlicense), vendored as one JS file in `vendor/cardmeister/`. When the component does not load, the card shows a CSS fallback with ♣ ♠ ♥ ♦ and the rank.
- In: a small "card face" layer in `src/core/`. Later, a second deck (for example real German suits) is one more face set.
- In: Offiziersskat for 2 players (human against computer), rule set below.
- In: a computer opponent that plays only legal cards and uses simple rules of thumb.
- In: light animations. The cards fly from a central stack when the game deals. A played card flies to the trick. The trick moves to the pile of the winner. Each player has a pile of won tricks that grows. The trick clears after 2.5 seconds, or immediately when the next card is played. With `prefers-reduced-motion`, the app skips the motion and keeps the state changes.
- In: one shared sound module for all games: card play, shuffle/deal, win, loss. A visible mute button. The app keeps the mute setting in `localStorage`. The app plays no sound before the first user gesture.
- In: credits in the app and in the README for the card faces (CardMeister, Unlicense), the 4 sounds (Pixabay attributions from the idea), and PeerJS (MIT).
- In: save in `localStorage`. The current game against the computer and its score list stay after a page reload.
- In (Feedback 4): Offiziersskat with 2 humans in 2 browsers. Player 1 opens a room and gets a short code (for example `KREUZ-42`). Player 2 types the code. The public PeerJS broker (`0.peerjs.com`) only sets up the connection. The game data then goes directly browser to browser over a WebRTC data channel.
- In: the host browser holds the game state and checks each move with `rules.js`. The guest sends moves only. The guest gets a view without the face-down cards and without the stock, so devtools do not show hidden cards.
- In: a clear German message when the room code is unknown, the broker is not reachable, or the other player leaves. The player can go back to the menu.
- Out: the whole-repo audit from Feedback 4 (it is a separate audit job; its "Must fix" findings run as jobs before S16).
- Out: an own signaling server or TURN server (the human accepted the public PeerJS broker; PeerJS default STUN/TURN is enough for a first version).
- Out: reconnect after a page reload or a lost connection, and saving an online game (one session is enough; the host can open a new room).
- Out: more than 2 players, spectators, chat, matchmaking, a list of open rooms (the code is the only way to meet).
- Out: online play for other games (no other game exists yet; the link layer in `src/core/` makes it possible later).
- Out: protection against a modified host (friendly games between people who know each other).
- Out: more games than Offiziersskat (the registry makes them possible; add them as new slices later).
- Out: Null game, Kontra/Re, game values, Buben-Spitzen, Schneider/Schwarz, Ramsch, passing (the human did not ask for them; the card-point result is enough to play).
- Out: a real German-suited deck image set (the linked file and symbols are French-suited; the card face layer lets us add it later).
- Out: sound conversion (MP3 plays in all current browsers, and no converter is installed).
- Out: background music and more sound events (the human named 4 sounds only).
- Out: accounts, online high scores (client only).
- Out: a build step, frameworks, bundlers (the browser runs ES modules directly).

### Offiziersskat rule set (Wikipedia)
- 32 cards. Each player gets 16 cards: 8 stacks in a row. Each stack has 1 card face down and 1 card face up on top.
- The deal goes in steps. The dealer gives 4 face-down cards to each player. Then the dealer puts 4 face-up cards on the face-down cards of the non-dealer (Vorhand).
- Vorhand sees only these 4 face-up cards and announces the game: a suit game (Farbspiel) or Grand. Vorhand is the announcer (Ansager).
- After the announcement, the dealer gets 4 face-up cards on the own face-down cards. Then the dealer gives the last 16 cards in groups of 4: face down to each player, then face up to each player.
- In a suit game, the 4 Buben and the 7 cards of the suit are trump. In Grand, only the 4 Buben are trump.
- Trump order: Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube, then A, 10, K, D, 9, 8, 7 of the trump suit. Other suits: A, 10, K, D, 9, 8, 7.
- Vorhand leads the first trick. A player must follow suit (trump counts as one suit). If the player cannot follow, the player can play any card.
- A player can play only face-up cards. When a player plays a card from a stack, the card below turns face up.
- The trick winner leads the next trick.
- Card points: A 11, 10 10, K 4, D 3, B 2, 9/8/7 0. Total 120. The announcer wins with 61 points or more. With 60 to 60, the opponent of the announcer wins. There is no draw.
- The dealer changes after each game.

## Stack
- Language: JavaScript (ES modules), HTML, CSS. Browser only.
- Test runner: `node --test` (Node v24.21 is installed). Tests cover the pure logic, not the DOM. Online tests use an in-memory link pair, not the network.
- Start: `python3 -m http.server 8000 --bind 127.0.0.1` in the repo root (Python 3.9.6 is installed), then open `http://localhost:8000/`. ES modules do not load from `file://`, so a local server is necessary. For a 2-browser test, open the same URL in 2 browser windows (or 2 `playwright-cli` sessions); both need internet access to `0.peerjs.com`.
- Card faces: CardMeister `<playing-card>` custom element, vendored unchanged (`elements.cardmeister.full.js`, ~149 KB, court images included). No build step, no CDN.
- Animation: CSS transitions and the Web Animations API. Sound: `HTMLAudioElement` with MP3 files.
- Online: PeerJS 1.5.5 browser build, vendored unchanged as `vendor/peerjs/peerjs.min.js` (UMD global `Peer`). The app loads it only when the player opens the 2-player screen, so single player makes no network calls.

## Dependencies
- CardMeister `<playing-card>` (https://github.com/cardmeister/cardmeister.github.io, Unlicense), vendored as `vendor/cardmeister/elements.cardmeister.full.js`. Chosen by the human (idea.md Feedback 3).
- PeerJS 1.5.5 (https://github.com/peers/peerjs, MIT), vendored with its LICENSE as `vendor/peerjs/`: the public broker speaks the PeerJS signaling protocol, and the platform has WebRTC but no client for that protocol. Chosen by the human (idea.md Feedback 4).
- Nothing else: the platform has ES modules, `localStorage`, Web Animations, `Audio`, WebRTC, and `node:test`.

## Architecture
- `index.html` + `src/main.js`: start the app, show the menu (single player and "Zu zweit spielen"), the mute button, and the credits.
- `src/core/`: `cards.js`, `card-view.js`, `registry.js`, `storage.js`, `sound.js`, `motion.js` (as before); new `room-code.js` (make and normalize codes, pure) and `link.js` (PeerJS wrapper: `host(code)` / `join(code)` give a link with `send`, `onMessage`, `onClose`).
- `src/games/offiziersskat/`: `rules.js` (pure state and moves), `ai.js`, `index.js` (render, motion and sound events), new `online.js` (seat view for the guest: swap seats, hide face-down cards and stock; host and guest session over any link).
- `vendor/cardmeister/`, `vendor/peerjs/`, `assets/sounds/`.
- Single player: the view sends a move -> `rules.js` returns a new state -> storage saves it -> the view renders it with motion and sound. On the computer turn, `ai.js` selects the move.
- Online: the host is seat `human`, the guest is seat `computer` (no AI). A guest click sends `{type:"move"}` -> the host checks the turn and applies it -> the host sends the guest view `{type:"state"}` -> both browsers render through the same path as single player.
- The state is plain JSON. Animation, sound, and the network never change the rules.

## Slices
1. S1 Walking skeleton: `index.html` shows "Karten" from `src/main.js`, `node --test` runs one passing test, and the README gives the start and test commands.
2. S2 German deck: the app shows all 32 cards as CSS cards with suit symbols and ranks. Tests check the deck and a seeded shuffle. Needs S1.
3. S3 Game menu and registry: the start screen lists the registered games and opens a stub Offiziersskat screen. A "back" button returns to the menu. Needs S1.
4. S4 Deal and table: a new Offiziersskat game deals 8 stacks to each player, and the table shows the open cards of both players and the hidden cards below. Needs S2, S3.
5. S5 Game announcement: Vorhand announces suit or Grand. The human selects from buttons, the computer selects the suit with the most strength. The table shows the trump. Needs S4.
6. S6 Trick rules: pure functions for trump order, legal moves (follow suit, trump as a suit), trick winner, and the reveal of the card below. Unit tests cover each rule. Needs S4.
7. S7 Play a full game: the human clicks legal cards, the computer plays a random legal card, tricks resolve, and the game ends after 16 tricks. Needs S5, S6.
8. S8 Score and next game: the app counts the card points, shows win, loss, or draw, keeps a score list, and starts the next game with the other dealer. Needs S7.
9. S12 Wikipedia deal and result: a new game deals in steps (4 down each, 4 up for Vorhand), Vorhand announces from these 4 open cards only, then the rest is dealt (4 up for the dealer, 4 down each, 4 up each). The announcer wins with 61 or more, 60:60 goes to the opponent, and "draw" is gone. Tests check the deal order, the hidden stock, the AI announce on 4 cards, and the 60:60 result. Needs S8.
10. S13 Skat deck with card images: the deck uses Kreuz, Pik, Herz, Karo and Bube, Dame, König, Ass (ids, names, trump order, tests). The card face layer draws the cards with the vendored CardMeister `<playing-card>` web component (`vendor/cardmeister/elements.cardmeister.full.js`, Unlicense, no network calls) using `cid` ids (e.g. `Jc`, `Th`) and `letters=ABDK` for German court letters; face-down cards use its card back. When the component is not defined, a card falls back to ♣ ♠ ♥ ♦ and the rank. The Unlicense notice and source link are in `vendor/cardmeister/` and the README. Needs S12.
11. S9 Save and resume: the app saves the current game and the score list to `localStorage` after each move, and resumes them after a reload. A "new game" button clears the current game. Needs S13.
12. S14 Sound: `src/core/sound.js` plays the 4 MP3 files from `assets/sounds/` (card play for each played card, shuffle at each deal, success when the human wins, lost when the human loses). A mute button stays visible, its setting stays after a reload, and no sound plays before the first click. A credits view lists the card and sound attributions. Tests check the mute setting and the event-to-sound mapping. Needs S12, S13.
13. S15 Card animations: `src/core/motion.js` deals the cards from a central stack in the steps of S12, flies each played card to the trick, and sweeps the finished trick to a won-tricks pile at the side of the winner. Each pile grows with each trick. The trick clears after 2.5 seconds or when the next card is played. With `prefers-reduced-motion`, the cards go to their places without motion. Needs S12, S13.
14. S10 Better computer: the computer uses rules of thumb (take a trick with points cheaply, give low cards when it loses, keep trumps, take care which card below it reveals, announce from the 4 open cards). Tests check some fixed positions. Needs S12.
15. S11 Rules page: a short German rules text (the Wikipedia rule set above, with the stepwise deal and the 60:60 rule) is available from the game screen, so that the human can check the rule set. Needs S12.
16. S16 Room code and connection: the Offiziersskat menu entry gets "Zu zweit spielen". "Raum öffnen" shows a short code (word from Kreuz/Pik/Herz/Karo/Bube/Dame/König/Ass plus 2 digits, e.g. `KREUZ-42`) with a copy button; "Raum beitreten" has a code field. `src/core/room-code.js` makes and normalizes codes (case, spaces, missing dash; peer id `karten-<code>`); `src/core/link.js` wraps the lazily loaded vendored PeerJS (`vendor/peerjs/`, MIT LICENSE). When both browsers connect, both show "Verbunden". README and credits name PeerJS and the use of `0.peerjs.com`. Tests check the code functions. Needs S15.
17. S17 Online session logic: `src/games/offiziersskat/online.js` has a pure guest view (seats swapped, face-down cards and stock hidden, legal stacks kept) and host and guest sessions over a link. The host applies only moves of the player in turn, rejects illegal moves, and sends the new view after each change. Tests play a full seeded game over an in-memory link pair, check that the guest view never holds a hidden card, and check that an out-of-turn move changes nothing. Needs S12.
18. S18 Play Offiziersskat in 2 browsers: after "Verbunden", the host deals, Vorhand (host or guest) announces with the buttons, and both players play a full game by clicks. Each browser shows its own row as "Du" and the other as "Mitspieler", with the same motion, sound, and win/loss message from its own view. "Nächstes Spiel" (host) starts the next game with the other dealer, and the score list shows in both browsers. Online games are not saved, and single player save stays unchanged. Needs S16, S17.
19. S19 Connection errors: an unknown code shows "Raum nicht gefunden", a code that is in use makes a new code, a broker that is not reachable shows "Keine Verbindung zum Vermittlungsserver", and when the other player leaves, the table shows "Mitspieler hat das Spiel verlassen" with a button back to the menu. A timeout stops the waiting after 15 seconds on join. Tests check the error-to-message mapping. Needs S18.

## Open questions
- (answered 2026-10-12) Deck: the human chose the French-suited deck (Kreuz, Pik, Herz, Karo) with German names.
- (answered, Feedback 4) 2-browser mode: short room code, public PeerJS broker for signaling only.
- Some networks (strict company or mobile NAT) can block a direct connection. The plan uses the PeerJS default STUN/TURN only. If the human needs play on such networks, an own TURN server becomes a new plan item.
