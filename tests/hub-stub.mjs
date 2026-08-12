/* A dependency-light stand-in for hub-worker/src/room.ts, for tests.
 *
 * The real hub is a Cloudflare Durable Object; running wrangler for every test
 * is slow and needs network. This reproduces the only behaviour the client
 * depends on: an "init-connection" greeting carrying the current peer count,
 * then verbatim broadcast of every message to every *other* socket in the room
 * (unless the message sets "server-echo").
 */

import { WebSocketServer } from "ws";
import http from "node:http";

export function startHub(port = 0) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    // /findroom, used by the findRoom config option.
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/findroom") {
      const prefix = url.searchParams.get("prefix") || "room";
      const max = parseInt(url.searchParams.get("max") || "2", 10);
      let name = null;
      for (let i = 1; ; i++) {
        const candidate = `${prefix}__${i}`;
        if ((rooms.get(candidate)?.size ?? 0) < max) {
          name = candidate;
          break;
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ name }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server });
  wss.on("connection", (socket, req) => {
    const match = /^\/hub\/+([^/?]+)/.exec(req.url);
    const roomId = match ? match[1] : "";
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    const room = rooms.get(roomId);

    socket.send(JSON.stringify({ type: "init-connection", peerCount: room.size }));
    room.add(socket);

    socket.on("message", (data) => {
      const text = data.toString();
      let serverEcho = false;
      try {
        serverEcho = !!JSON.parse(text)["server-echo"];
      } catch {
        // The real hub silently drops unparseable messages.
        return;
      }
      for (const peer of room) {
        if (peer === socket && !serverEcho) continue;
        if (peer.readyState === peer.OPEN) peer.send(text);
      }
    });

    socket.on("close", () => {
      room.delete(socket);
      if (!room.size) rooms.delete(roomId);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        port: server.address().port,
        url: `http://localhost:${server.address().port}`,
        close: () =>
          new Promise((r) => {
            for (const room of rooms.values()) {
              for (const socket of room) socket.terminate();
            }
            wss.close(() => server.close(r));
          }),
      });
    });
  });
}
