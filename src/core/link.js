import { peerId } from "./room-code.js";

// Loads the vendored PeerJS bundle. It sets the global `Peer`.
const loadPeerJs = () => new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = new URL("../../vendor/peerjs/peerjs.min.js", import.meta.url).href;
  script.onload = () => resolve(globalThis.Peer);
  script.onerror = () => reject(Object.assign(new Error("PeerJS did not load"), { type: "peerjs-load" }));
  document.head.append(script);
});

// `end` runs after the close. The first link ends the peer, so a close of it also ends all other links.
const wrap = (conn, end) => ({
  send: (data) => conn.send(data),
  onMessage: (fn) => conn.on("data", fn),
  onClose: (fn) => conn.on("close", fn),
  close: () => {
    conn.close();
    end();
  },
});

// `load` gives the Peer class. It runs once, on the first host or join call.
export function createLinks(load = loadPeerJs) {
  let loading;
  const Peer = () => (loading ??= load().catch((error) => {
    loading = null;
    throw error;
  }));

  // The Promise resolves with the first open data channel. An abort destroys the peer.
  // With `more`, each later data channel goes to `more`. Without it, the peer closes later channels.
  const connect = async (id, signal, start, more) => {
    const PeerClass = await Peer();
    signal?.throwIfAborted();
    return new Promise((resolve, reject) => {
      const peer = id ? new PeerClass(id) : new PeerClass();
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        peer.destroy();
        reject(error);
      };
      signal?.addEventListener("abort", () => fail(signal.reason));
      peer.on("error", fail);
      let linked = false;
      start(peer, (conn) => conn.on("open", () => {
        if (linked && more) return more(wrap(conn, () => {}));
        if (settled) return conn.close();
        settled = linked = true;
        resolve(wrap(conn, () => peer.destroy()));
      }));
    });
  };

  return {
    host: (code, signal, more) => connect(peerId(code), signal, (peer, ready) => peer.on("connection", ready), more),
    join: (code, signal) => connect(null, signal, (peer, ready) =>
      peer.on("open", () => ready(peer.connect(peerId(code), { reliable: true })))),
  };
}

export const { host, join } = createLinks();

const BROKER = "Keine Verbindung zum Vermittlungsserver";
const MESSAGES = new Map([
  ["peer-unavailable", "Raum nicht gefunden"],
  ["network", BROKER],
  ["server-error", BROKER],
  ["socket-error", BROKER],
  ["peerjs-load", BROKER],
  ["join-timeout", "Keine Antwort vom Raum. Bitte versuche es noch einmal."],
]);

// A fixed German text for a connection error. The app never shows the PeerJS error text.
export const connectionMessage = (error) => MESSAGES.get(error?.type) ?? "Keine Verbindung. Bitte versuche es noch einmal.";
