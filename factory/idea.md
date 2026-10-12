# Idea
mach mir bitte eine browserspielumgebung, in der es verschiedene kartenspiele geben kann. es soll komplett im browser only, client only als einzelspieler gespielt werden. erstmal immer gegen computergegner. starte mit offiziersskat. es soll regelkonform ablaufen. spielstände werden im browser gespeichert. nutze das deutsche blatt und frage mich erst wieder wenn das spiel spielbar ist. bedenke, ich möchte später weitere spiele ergänzen. es soll dann auch gemeinsame spiele geben, am besten mit einer client zu client verbindung im browser wenn das geht. aber erst später. dann leg mal los

## Feedback 1
nutze responsive design und mach es hübsch und etwas verspielt

## Feedback 2

(Human, verbatim, after S1–S8 were playable:)

ich kenne die offiziersskatregeln leicht anders. auf https://de.wikipedia.org/wiki/Offiziersskat wird speziell das Austeilen entsprechend erklärt. Das unterscheidet sich vom aktuell implementierten. und es wäre toll, wenn wir die echten deutschen Blätter verwenden könnten: https://de.wikipedia.org/wiki/Datei:Svg-cards-2.0.svg
oder zumindest diese Symbole:

•  (♠ – schwarz, Symbol für den Adel / Lanzenspitze)
• Herz (♥ – rot, Symbol für den Klerus / Liebe)
• Karo (♦ – rot, Symbol für das Bürgertum / Kaufleute)
• Kreuz / Treff (♣ – schwarz, Symbol für den Bauernstand / Kleeblatt)

außerdem fehlt mir eine leichte Animation. Bspw. die Karten austeilen vom Stapel weg, dann das hinlegen zum Stich und dann sollte ein Stich auch automatisch mit einer Animation abgeräumt werden in die Richtung desjenigen, der auch den Stich gewonnen hat. an jeder Hand sollte sich der Stapel der gewonnenen Stiche eben vergrößern. Und nach x Sekunden eben abräumen oder wenn ein Spieler bereits den nächsten Zug macht. Das wäre cool. Und ich hätte gern noch Sound. den können wir für alle Kartenspiele verwenden. Das Legen einer Karte können wir untermalen mit dem Sound ~/Downloads/freesound_community-flipcard-91468.mp3 (Attribution: Sound Effect by <a href="https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468">Pixabay</a>) und das Mischen von Karten können wir damit machen: ~/Downloads/freesound_community-card-shuffle-94662.mp3 (Attribution: Sound Effect by <a href="https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662">freesound_community</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662">Pixabay</a>). Du kannst die Sounds auch gerne umwandeln, wenn mp3 nicht so gut ist. Wenn der Spieler gewinnt dann spielen wir den Sound: ~/Downloads/freesound_community-success-1-6297.mp3 (Attribution Sound Effect by <a href="https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297">freesound_community</a> from <a href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297">Pixabay</a>) und wenn der Spieler verloren hat, dann den Sound: ~/Downloads/ribhavagrawal-lost-the-game-effect-230571.mp3 (Attribution Sound Effect by <a href="https://pixabay.com/de/users/ribhavagrawal-39286533/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571">Ribhav Agrawal</a> from <a href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571">Pixabay</a>)

### Coordinator notes for the planner (research, not the human's words)

Absolute sound file paths (MP3, 30–100 KB each; MP3 plays in all current browsers, no ffmpeg on this machine, so keep MP3): `/Users/rok/Downloads/freesound_community-flipcard-91468.mp3` (card play), `/Users/rok/Downloads/freesound_community-card-shuffle-94662.mp3` (shuffle/deal), `/Users/rok/Downloads/freesound_community-success-1-6297.mp3` (human wins), `/Users/rok/Downloads/ribhavagrawal-lost-the-game-effect-230571.mp3` (human loses). Copy them into the repo (e.g. `assets/sounds/`) and show the attributions in the app (credits) and README.

Wikipedia "Offiziersskat" rules that differ from the current build:
1. **Deal in steps, trump chosen early.** The dealer deals 4 face-down cards to each player, then 4 face-up cards onto the non-dealer's face-down cards. The non-dealer (Vorhand) now chooses trump (a suit or Grand) seeing only those 4 face-up cards. Only then the dealer gets 4 face-up cards. The remaining 16 cards follow in groups of four (face-down for both, then face-up for both). End state is the same as now: 8 stacks of 2 (down + up) per player. Current build deals everything first and announces after — wrong.
2. **60:60 is not a draw:** with 60:60 the opponent of the announcer (Ansager) wins.
3. Trump order Kreuz(=Eichel) > Pik(=Grün) > Herz(=Rot) > Karo(=Schellen) Buben, then A,10,K,D,9,8,7 — already matches. Follow-suit, reveal after the trick, 120 points, 61 wins — already match.
4. Optional (Wikipedia mentions, not requested): Kontra/Re, game values (Grand 24, Kreuz 12, Pik 11, Herz 10, Karo 9) with Buben-Spitzen, Schneider/Schwarz, Ramsch, passing. Keep out unless cheap; a simple game-value score list would be a later slice at most.

Cards: the linked `Svg-cards-2.0.svg` (David Bellot, LGPL-2.1+, 924 KB, https://upload.wikimedia.org/wikipedia/commons/a/a1/Svg-cards-2.0.svg) is a **French-suited** deck (Kreuz/Pik/Herz/Karo, Bube/Dame/König/Ass, Paris portraits), as are the listed symbols. The coordinator reads the human's wish as: switch the deck to French suits (the usual German Skat look) using these SVG card faces for 7–A, with ♣♠♥♦ fallback. LGPL needs the license text and attribution shipped. Prefer extracting only the 32 needed cards (or a trimmed sprite) to keep the page light; no build step, no runtime deps. Keep suit/rank names in German (Kreuz, Pik, Herz, Karo; Bube, Dame, König, Ass). Keep the deck behind a small "card face" layer so another deck (e.g. real German suits) can be added later.

Animation: deal from a central stack, card flies to the trick area, after the trick the cards sweep toward the winner's side onto a growing won-tricks pile per player; the trick clears automatically after a few seconds or when the next card is played. Respect `prefers-reduced-motion` (skip/shorten motion, keep state changes). Sound: one shared core sound module for all games, with a visible mute toggle (remembered in `localStorage`) and no sound before the first user gesture (autoplay rules).

The remaining backlog S9 (save/resume), S10 (better computer), S11 (rules page) still stands; order the new work before or between them as fits best.

## Feedback 3 (2026-10-12)

> vielleicht können wir das nehmen? https://cardmeister.github.io/

Coordinator notes: CardMeister `<playing-card>` web component, Unlicense (public domain), one self-contained JS file, no network calls (checked), 52 French cards incl. court images and card back; `letters=ABDK` gives German index letters (B, D, K, A). Replaces the Bellot SVG extraction in S13 (no LGPL handling needed). Sample render checked in a browser: Buben, Herz 7–A and card back look right.

## Feedback 4
User (verbatim): "mach mal ein komplettes audit bitte und danach spielen wir mit 2 browsern. Am besten via code eingabe oder sowas - das man seinen 2. spieler findet"

Decision (AskUserQuestion): "Kurzer Raum-Code (Empfohlen)" — player 1 opens a game and gets a short room code (e.g. "KREUZ-42"), player 2 types it in. The public PeerJS broker (0.peerjs.com) is used only to set up the connection; the game then runs directly browser↔browser over WebRTC. This is an accepted external service; network is needed only for 2-player mode. Single player vs computer stays fully offline.
Planned order: first the whole-repo audit (its Must fix findings), then the 2-browser Offiziersskat.
