// Two connected in-memory links with the API of src/core/link.js. Each message is a structured clone.
export function linkPair() {
  const sides = [0, 1].map(() => ({ message: [], close: [], open: true }));
  const make = (self, peer) => ({
    send: (data) => {
      if (self.open) for (const fn of peer.message) fn(structuredClone(data));
    },
    onMessage: (fn) => self.message.push(fn),
    onClose: (fn) => self.close.push(fn),
    close: () => {
      for (const side of [self, peer]) {
        if (!side.open) continue;
        side.open = false;
        for (const fn of side.close) fn();
      }
    },
  });
  return [make(sides[0], sides[1]), make(sides[1], sides[0])];
}
