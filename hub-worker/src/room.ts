import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

// Ported from ../../hub/server.js: a room is just a set of peers that get
// every message anyone else in the room sends, verbatim. No persistence,
// no history — matches the old in-memory `allConnections[id]` relay.
export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const roomId = roomIdFromUrl(request.url);
    // Attached (not just held in an instance field) because hibernation can
    // evict and recreate this Durable Object between events.
    server.serializeAttachment(roomId);

    // Hibernation API: this room's Durable Object can be evicted from memory
    // while sockets sit idle, and gets woken back up on the next message —
    // that's what keeps a quiet room from costing anything on the free plan.
    this.ctx.acceptWebSocket(server);

    const peerCount = this.ctx.getWebSockets().length - 1;
    server.send(JSON.stringify({ type: "init-connection", peerCount }));
    await this.reportPeerCount(roomId, peerCount + 1);

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
    try {
      // Only needed when the *server* side wants to close; if the client
      // already completed the close handshake (the common case), the socket
      // is closed already and calling close() again throws.
      ws.close(code, reason);
    } catch (e) {
      // Already closed — nothing to do.
    }
    const roomId = ws.deserializeAttachment() as string | null;
    if (roomId) {
      // `ws` itself is still included in getWebSockets() while this handler
      // runs (it's only dropped once the handler returns), so exclude it.
      const remaining = this.ctx.getWebSockets().filter((socket) => socket !== ws).length;
      await this.reportPeerCount(roomId, remaining);
    }
  }

  private async reportPeerCount(roomId: string, peerCount: number): Promise<void> {
    const prefix = roomIdPrefix(roomId);
    if (!prefix) {
      return;
    }
    const id = this.env.REGISTRY.idFromName("global");
    await this.env.REGISTRY.get(id).report(roomId, prefix, peerCount);
  }
}

// Mirrors the /hub/<id> path index.ts already routed on to reach this DO.
function roomIdFromUrl(url: string): string {
  const match = new URL(url).pathname.match(/^\/hub\/+([^/]+)\/*$/);
  return match ? match[1] : "";
}

// Only rooms minted by /findroom look like "<prefix>__<id>" (see registry.ts);
// ordinary share-link rooms never contain "__", so they're skipped here to
// keep the registry limited to rooms that actually use the findRoom feature.
function roomIdPrefix(roomId: string): string | null {
  const index = roomId.indexOf("__");
  return index === -1 ? null : roomId.slice(0, index);
}
