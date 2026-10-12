const VERSION = 1;

const key = (gameId) => `karten:${gameId}`;

// Storage can throw (private mode, quota, disabled). A failed save does nothing, so the game stays playable.
export function save(storage, gameId, data) {
  try {
    storage.setItem(key(gameId), JSON.stringify({ version: VERSION, data }));
  } catch {}
}

// Returns the saved data, or null when there is no readable save of this version.
export function load(storage, gameId) {
  try {
    const saved = JSON.parse(storage.getItem(key(gameId)));
    return saved?.version === VERSION ? saved.data ?? null : null;
  } catch {
    return null;
  }
}

// True when a `storage` event changed the save of this game. A null key means `localStorage.clear()`.
export const isSaveOf = (event, gameId) => event.key === null || event.key === key(gameId);
