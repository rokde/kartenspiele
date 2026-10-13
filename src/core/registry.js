import * as offiziersskat from "../games/offiziersskat/index.js";
import * as skat from "../games/skat/index.js";

const games = [offiziersskat, skat];

export function listGames() {
  return games;
}

export function getGame(id) {
  return games.find((game) => game.id === id);
}
