import * as offiziersskat from "../games/offiziersskat/index.js";

const games = [offiziersskat];

export function listGames() {
  return games;
}

export function getGame(id) {
  return games.find((game) => game.id === id);
}
