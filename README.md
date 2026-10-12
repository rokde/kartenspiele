# Karten

A card game site that runs only in the browser.

## Start

ES modules do not load from `file://`. Start a local server in the repo root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://localhost:8000/`.

## Test

```sh
node --test
```

## Credits

- Card faces: [CardMeister](https://cardmeister.github.io/) `<playing-card>` web component.
  Source: https://github.com/cardmeister/cardmeister.github.io.
  License: the Unlicense (public domain).
  The app uses an unchanged copy in `vendor/cardmeister/` (see `vendor/cardmeister/LICENSE`).
- Sounds (in `assets/sounds/`, MP3 files from Pixabay, with the silence at the start and end cut):
  - `card-play.mp3`: Sound Effect by [freesound_community](https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468) from [Pixabay](https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=91468)
  - `shuffle.mp3`: Sound Effect by [freesound_community](https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662) from [Pixabay](https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=94662)
  - `win.mp3`: Sound Effect by [freesound_community](https://pixabay.com/de/users/freesound_community-46691455/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297) from [Pixabay](https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=6297)
  - `lose.mp3`: Sound Effect by [Ribhav Agrawal](https://pixabay.com/de/users/ribhavagrawal-39286533/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571) from [Pixabay](https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=230571)
- 2-player connection: [PeerJS](https://github.com/peers/peerjs) 1.5.5.
  License: MIT.
  The app uses an unchanged copy of the npm browser bundle in `vendor/peerjs/` (see `vendor/peerjs/LICENSE`).
  The app loads PeerJS only when a player selects "Zu zweit spielen". Single player makes no network calls.
  In 2-player mode, the public PeerJS broker `0.peerjs.com` only sets up the connection.
  The broker and the other player see the IP address of each browser.
  The game data then goes directly from browser to browser over WebRTC.
