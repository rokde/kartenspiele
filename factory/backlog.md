# Backlog

`/factory:next` runs the first unchecked item. The orchestrator checks it off and
appends the job id. Add one feature per line, phrased as an outcome. Put the
ticket in front when there is one (`PROJ-123`, `#42`, or a URL). Every commit for
that feature then references it. `/factory:import github <query>` or
`/factory:import jira <jql>` adds open tickets here.

Example: `- [ ] PROJ-1 a hello CLI command that greets a name passed as an argument`


- [x] S1 Walking skeleton: `index.html` shows "Karten" from `src/main.js`, `node --test` runs one passing test, and the README gives the start and test commands. → 001-walking-skeleton
- [x] S2 German deck: the app shows all 32 cards as CSS cards with suit symbols and ranks. Tests check the deck and a seeded shuffle. Needs S1. → 002-german-deck
- [x] S3 Game menu and registry: the start screen lists the registered games and opens a stub Offiziersskat screen. A "back" button returns to the menu. Needs S1. → 003-game-menu
- [x] S4 Deal and table: a new Offiziersskat game deals 8 stacks to each player, and the table shows the open cards of both players and the hidden cards below. Needs S2, S3. → 004-deal-and-table
- [x] S5 Game announcement: Vorhand announces suit or Grand. The human selects from buttons, the computer selects the suit with the most strength. The table shows the trump. Needs S4. → 005-announcement
- [x] S6 Trick rules: pure functions for trump order, legal moves (follow suit, trump as a suit), trick winner, and the reveal of the card below. Unit tests cover each rule. Needs S4. → 006-trick-rules
- [x] S7 Play a full game: the human clicks legal cards, the computer plays a random legal card, tricks resolve, and the game ends after 16 tricks. Needs S5, S6. → 007-full-game
- [x] S8 Score and next game: the app counts the card points, shows win, loss, or draw, keeps a score list, and starts the next game with the other dealer. Needs S7. → 008-score-next-game
- [x] S12 Wikipedia deal and result: a new game deals in steps (4 down each, 4 up for Vorhand), Vorhand announces from these 4 open cards only, then the rest is dealt (4 up for the dealer, 4 down each, 4 up each). The announcer wins with 61 or more, 60:60 goes to the opponent, and "draw" is gone. Tests check the deal order, the hidden stock, the AI announce on 4 cards, and the 60:60 result. Needs S8. → 009-wikipedia-deal
- [x] S13 Skat deck with card images: the deck uses Kreuz, Pik, Herz, Karo and Bube, Dame, König, Ass (ids, names, trump order, tests). The card face layer draws the cards with the vendored CardMeister `<playing-card>` web component (`vendor/cardmeister/elements.cardmeister.full.js`, Unlicense, no network calls) using `cid` ids (e.g. `Jc`, `Th`) and `letters=ABDK` for German court letters; face-down cards use its card back. When the component is not defined, a card falls back to ♣ ♠ ♥ ♦ and the rank. The Unlicense notice and source link are in `vendor/cardmeister/` and the README. Needs S12. → 010-skat-deck-images
- [x] S9 Save and resume: the app saves the current game and the score list to `localStorage` after each move, and resumes them after a reload. A "new game" button clears the current game. Needs S13. → 011-save-resume
- [ ] S14 Sound: `src/core/sound.js` plays the 4 MP3 files from `assets/sounds/` (card play for each played card, shuffle at each deal, success when the human wins, lost when the human loses). A mute button stays visible, its setting stays after a reload, and no sound plays before the first click. A credits view lists the card and sound attributions. Tests check the mute setting and the event-to-sound mapping. Needs S12, S13.
- [ ] S15 Card animations: `src/core/motion.js` deals the cards from a central stack in the steps of S12, flies each played card to the trick, and sweeps the finished trick to a won-tricks pile at the side of the winner. Each pile grows with each trick. The trick clears after 2.5 seconds or when the next card is played. With `prefers-reduced-motion`, the cards go to their places without motion. Needs S12, S13.
- [ ] S10 Better computer: the computer uses rules of thumb (take a trick with points cheaply, give low cards when it loses, keep trumps, take care which card below it reveals, announce from the 4 open cards). Tests check some fixed positions. Needs S12.
- [ ] S11 Rules page: a short German rules text (the Wikipedia rule set above, with the stepwise deal and the 60:60 rule) is available from the game screen, so that the human can check the rule set. Needs S12.
