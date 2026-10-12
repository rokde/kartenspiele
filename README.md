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
