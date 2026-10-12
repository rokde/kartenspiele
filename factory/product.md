# Product: Karten

## Goal
One player gets a card game site that runs only in the browser. The player plays Offiziersskat against a computer, with the German deck and correct rules. The site has a game registry so that we can add more games later.

## Scope
- In: one static web app (HTML, CSS, JavaScript modules). No server code.
- In: a game menu with a registry. Each game is one module with one common interface.
- In: German deck with 32 cards (Eichel, Grün, Rot, Schellen; 7, 8, 9, 10, Unter, Ober, König, Ass). Cards are drawn with CSS and text. No image files.
- In: Offiziersskat for 2 players (human against computer), rule set below.
- In: a computer opponent that plays only legal cards and uses simple rules of thumb.
- In: save in `localStorage`. The current game and the score list stay after a page reload.
- Out: multiplayer and peer-to-peer (WebRTC) (the idea says "later"; WebRTC also needs a signaling path, so it is a separate plan).
- Out: more games than Offiziersskat (the registry makes them possible; add them as new slices later).
- Out: Null game (not all Offiziersskat rule sets have it; see open questions).
- Out: accounts, server, online high scores (client only).
- Out: card images and animations (CSS cards are enough to play).
- Out: a build step, frameworks, bundlers (the browser runs ES modules directly).

### Offiziersskat rule set (default)
- 32 cards. Each player gets 16 cards: 8 stacks in a row. Each stack has 1 card face down and 1 card face up on top.
- The non-dealer (Vorhand) looks at the open cards and announces the game: a suit game (Farbspiel) or Grand. In a suit game, the 4 Unter and the 7 cards of the suit are trump. In Grand, only the 4 Unter are trump.
- Trump order: Eichel-Unter, Grün-Unter, Rot-Unter, Schellen-Unter, then A, 10, K, O, 9, 8, 7 of the trump suit. Other suits: A, 10, K, O, 9, 8, 7.
- Vorhand leads the first trick. A player must follow suit (trump counts as one suit). If the player cannot follow, the player can play any card.
- A player can play only face-up cards. When a player plays a card from a stack, the card below turns face up.
- The trick winner leads the next trick.
- Card points: A 11, 10 10, K 4, O 3, U 2, 9/8/7 0. Total 120. More than 60 points wins. 60 to 60 is a draw.
- The dealer changes after each game.

## Stack
- Language: JavaScript (ES modules), HTML, CSS. Browser only.
- Test runner: `node --test` (Node v24 is installed). Tests cover the pure game logic, not the DOM.
- Start: `python3 -m http.server 8000` in the repo root (Python 3.9 is installed), then open `http://localhost:8000/`. ES modules do not load from `file://`, so a local server is necessary.

## Dependencies
- none (the platform has ES modules, `localStorage`, and `node:test`)

## Architecture
- `index.html` + `src/main.js`: start the app and show the game menu.
- `src/core/`: cards and German deck, seeded shuffle, game registry, storage (`localStorage` wrapper with a version key).
- `src/games/offiziersskat/`: `rules.js` (pure state and moves: deal, announce, legal moves, play, trick winner, score), `ai.js` (selects a move from the state), `view.js` (renders the state and sends clicks as moves).
- Data flow: the view sends a move -> `rules.js` returns a new state -> storage saves it -> the view renders it. When the computer has the turn, `ai.js` selects a move and the same path runs.
- A game module exports `{ id, name, newGame, applyMove, legalMoves, aiMove, render }`. Later games and a later network layer use the same move path.
- The state is plain JSON, so storage and a later network sync can send it without changes.
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
9. S9 Save and resume: the app saves the current game and the score list to `localStorage` after each move, and resumes them after a reload. A "new game" button clears the current game. Needs S8.
10. S10 Better computer: the computer uses rules of thumb (take a trick with points cheaply, give low cards when it loses, keep trumps, take care which card below it reveals). Tests check some fixed positions. Needs S7.
11. S11 Rules page: a short German rules text is available from the game screen, so that the human can check the rule set. Needs S3.

## Open questions
- Offiziersskat has many house rules. Is the default above correct (16 cards in 8 stacks, Vorhand announces, suit or Grand, more than 60 points wins)? Or do you want the Null game, a hand of cards, or game values like in Skat? The plan uses the default until you answer.
