# Product: Karten

## Goal
One player gets a card game site that runs only in the browser. The player plays Offiziersskat against a computer with the Wikipedia rules, a Skat deck, light animations, and sound. The site has a game registry so that we can add more games later.

## Scope
- In: one static web app (HTML, CSS, JavaScript modules). No server code.
- In: a game menu with a registry. Each game is one module with one common interface.
- In: a 32-card Skat deck with French suits and German names (Kreuz, Pik, Herz, Karo; 7, 8, 9, 10, Bube, Dame, König, Ass). The card faces come from `Svg-cards-2.0.svg` (David Bellot, LGPL-2.1+). The 32 cards are extracted once into `assets/cards/`. When an image does not load, the card shows a CSS fallback with ♣ ♠ ♥ ♦ and the rank.
- In: a small "card face" layer in `src/core/`. Later, a second deck (for example real German suits) is one more face set.
- In: Offiziersskat for 2 players (human against computer), rule set below.
- In: a computer opponent that plays only legal cards and uses simple rules of thumb.
- In: light animations. The cards fly from a central stack when the game deals. A played card flies to the trick. The trick moves to the pile of the winner. Each player has a pile of won tricks that grows. The trick clears after 2.5 seconds, or immediately when the next card is played. With `prefers-reduced-motion`, the app skips the motion and keeps the state changes.
- In: one shared sound module for all games: card play, shuffle/deal, win, loss. A visible mute button. The app keeps the mute setting in `localStorage`. The app plays no sound before the first user gesture.
- In: credits in the app and in the README for the card faces (LGPL-2.1+, license text in the repo) and the 4 sounds (Pixabay attributions from the idea).
- In: save in `localStorage`. The current game and the score list stay after a page reload.
- Out: multiplayer and peer-to-peer (WebRTC) (the idea says "later"; WebRTC also needs a signaling path, so it is a separate plan).
- Out: more games than Offiziersskat (the registry makes them possible; add them as new slices later).
- Out: Null game, Kontra/Re, game values, Buben-Spitzen, Schneider/Schwarz, Ramsch, passing (the human did not ask for them; the card-point result is enough to play).
- Out: a real German-suited deck image set (the linked file and symbols are French-suited; the card face layer lets us add it later).
- Out: sound conversion (MP3 plays in all current browsers, and no converter is installed).
- Out: background music and more sound events (the human named 4 sounds only).
- Out: accounts, server, online high scores (client only).
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
- Test runner: `node --test` (Node v24.21 is installed). Tests cover the pure logic, not the DOM.
- Start: `python3 -m http.server 8000 --bind 127.0.0.1` in the repo root (Python 3.9.6 is installed), then open `http://localhost:8000/`. ES modules do not load from `file://`, so a local server is necessary.
- Card extraction: a one-time script `tools/extract-cards.py` (Python 3.9 standard library, `xml.etree`) cuts the 32 cards from the downloaded SVG. The repo keeps the output. The app does not run the script.
- Animation: CSS transitions and the Web Animations API. Sound: `HTMLAudioElement` with MP3 files.

## Dependencies
- none (the platform has ES modules, `localStorage`, Web Animations, `Audio`, and `node:test`; Python's standard library parses the SVG)

## Architecture
- `index.html` + `src/main.js`: start the app, show the game menu, the mute button, and the credits.
- `src/core/`: `cards.js` (Skat deck, seeded shuffle), `card-view.js` (card face layer: SVG image with symbol fallback), `registry.js`, `storage.js` (`localStorage` with a version key), `sound.js` (shared sounds and mute), `motion.js` (deal, fly, and sweep animations; honors reduced motion).
- `src/games/offiziersskat/`: `rules.js` (pure state and moves: stepwise deal, announce, legal moves, play, trick winner, result), `ai.js` (selects a move from the visible cards only), `index.js` (renders the state, sends clicks as moves, names the events for motion and sound).
- `assets/cards/` (32 SVG files + LGPL license), `assets/sounds/` (4 MP3 files).
- Data flow: the view sends a move -> `rules.js` returns a new state -> storage saves it -> the view renders it and plays motion and sound for the change. When the computer has the turn, `ai.js` selects a move and the same path runs.
- The state is plain JSON. Cards that are not dealt yet stay in a hidden `stock` in the state. Animation and sound never change the state.
- Tests: `test/*.test.js` import the pure modules only.

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
10. S13 Skat deck with card images: the deck uses Kreuz, Pik, Herz, Karo and Bube, Dame, König, Ass (ids, names, trump order, tests). `tools/extract-cards.py` cuts the 32 cards from `Svg-cards-2.0.svg` into `assets/cards/`, the card face layer shows them, and a card falls back to ♣ ♠ ♥ ♦ when the image does not load. The LGPL text and attribution are in `assets/cards/` and the README. Needs S12.
11. S9 Save and resume: the app saves the current game and the score list to `localStorage` after each move, and resumes them after a reload. A "new game" button clears the current game. Needs S13.
12. S14 Sound: `src/core/sound.js` plays the 4 MP3 files from `assets/sounds/` (card play for each played card, shuffle at each deal, success when the human wins, lost when the human loses). A mute button stays visible, its setting stays after a reload, and no sound plays before the first click. A credits view lists the card and sound attributions. Tests check the mute setting and the event-to-sound mapping. Needs S12, S13.
13. S15 Card animations: `src/core/motion.js` deals the cards from a central stack in the steps of S12, flies each played card to the trick, and sweeps the finished trick to a won-tricks pile at the side of the winner. Each pile grows with each trick. The trick clears after 2.5 seconds or when the next card is played. With `prefers-reduced-motion`, the cards go to their places without motion. Needs S12, S13.
14. S10 Better computer: the computer uses rules of thumb (take a trick with points cheaply, give low cards when it loses, keep trumps, take care which card below it reveals, announce from the 4 open cards). Tests check some fixed positions. Needs S12.
15. S11 Rules page: a short German rules text (the Wikipedia rule set above, with the stepwise deal and the 60:60 rule) is available from the game screen, so that the human can check the rule set. Needs S12.

## Open questions
- (answered 2026-10-12) Deck: the human chose the French-suited SVG deck (Kreuz, Pik, Herz, Karo) with German names. Plan order confirmed as above.
