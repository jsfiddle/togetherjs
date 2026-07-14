import { DurableObject } from "cloudflare:workers";

// Ported from ../../hub/server.js: a room is just a set of peers that get
// every message anyone else in the room sends, verbatim. No persistence,
// no history — matches the old in-memory `allConnections[id]` relay.
export class Room extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Hibernation API: this room's Durable Object can be evicted from memory
    // while sockets sit idle, and gets woken back up on the next message —
    // that's what keeps a quiet room from costing anything on the free plan.
    this.ctx.acceptWebSocket(server);

    const peerCount = this.ctx.getWebSockets().length - 1;
    server.send(JSON.stringify({ type: "init-connection", peerCount }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let serverEcho = false;
    if (typeof message === "string") {
      try {
        const parsed = JSON.parse(message);
        serverEcho = !!(parsed && parsed["server-echo"]);
      } catch (e) {
        // Original hub silently dropped unparseable messages; keep that behavior.
        return;
      }
    }

    for (const socket of this.ctx.getWebSockets()) {
      if (socket === ws && !serverEcho) {
        continue;
      }
      socket.send(message);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    ws.close(code, reason);
  }
}
