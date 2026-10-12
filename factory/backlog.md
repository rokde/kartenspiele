# Backlog

`/factory:next` runs the first unchecked item. The orchestrator checks it off and
appends the job id. Add one feature per line, phrased as an outcome. Put the
ticket in front when there is one (`PROJ-123`, `#42`, or a URL). Every commit for
that feature then references it. `/factory:import github <query>` or
`/factory:import jira <jql>` adds open tickets here.

Example: `- [ ] PROJ-1 a hello CLI command that greets a name passed as an argument`


- [x] S1 Walking skeleton: `index.html` shows "Karten" from `src/main.js`, `node --test` runs one passing test, and the README gives the start and test commands. → 001-walking-skeleton
- [ ] S2 German deck: the app shows all 32 cards as CSS cards with suit symbols and ranks. Tests check the deck and a seeded shuffle. Needs S1.
- [ ] S3 Game menu and registry: the start screen lists the registered games and opens a stub Offiziersskat screen. A "back" button returns to the menu. Needs S1.
- [ ] S4 Deal and table: a new Offiziersskat game deals 8 stacks to each player, and the table shows the open cards of both players and the hidden cards below. Needs S2, S3.
- [ ] S5 Game announcement: Vorhand announces suit or Grand. The human selects from buttons, the computer selects the suit with the most strength. The table shows the trump. Needs S4.
- [ ] S6 Trick rules: pure functions for trump order, legal moves (follow suit, trump as a suit), trick winner, and the reveal of the card below. Unit tests cover each rule. Needs S4.
- [ ] S7 Play a full game: the human clicks legal cards, the computer plays a random legal card, tricks resolve, and the game ends after 16 tricks. Needs S5, S6.
- [ ] S8 Score and next game: the app counts the card points, shows win, loss, or draw, keeps a score list, and starts the next game with the other dealer. Needs S7.
- [ ] S9 Save and resume: the app saves the current game and the score list to `localStorage` after each move, and resumes them after a reload. A "new game" button clears the current game. Needs S8.
- [ ] S10 Better computer: the computer uses rules of thumb (take a trick with points cheaply, give low cards when it loses, keep trumps, take care which card below it reveals). Tests check some fixed positions. Needs S7.
- [ ] S11 Rules page: a short German rules text is available from the game screen, so that the human can check the rule set. Needs S3.
