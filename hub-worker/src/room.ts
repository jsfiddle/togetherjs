import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

// Inbound messages are billed even when dropped, so a flooding socket is closed
// rather than ignored. Real clients peak well below this (cursor is 10/s).
const RATE_PER_SECOND = 100;
const RATE_BURST = 200;

interface RateState {
  tokens: number;
  updatedAt: number;
  closed: boolean;
}

// Ported from ../../hub/server.js: a room is just a set of peers that get
// every message anyone else in the room sends, verbatim. No persistence,
// no history — matches the old in-memory `allConnections[id]` relay.
export class Room extends DurableObject<Env> {
  // In-memory only: a hibernated room is by definition not being flooded.
  private rates = new WeakMap<WebSocket, RateState>();

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
    const rate = this.rateFor(ws);
    if (rate.closed) {
      return;
    }
    if (!takeToken(rate)) {
      rate.closed = true;
      console.warn("Closing flooding socket", {
        roomId: ws.deserializeAttachment(),
        messageType: messageType(message),
      });
      try {
        ws.close(1008, "Rate limit exceeded");
      } catch (e) {
        // Already closing — nothing to do.
      }
      return;
    }

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

  private rateFor(ws: WebSocket): RateState {
    let rate = this.rates.get(ws);
    if (!rate) {
      rate = { tokens: RATE_BURST, updatedAt: Date.now(), closed: false };
      this.rates.set(ws, rate);
    }
    return rate;
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

// Token bucket: refills at RATE_PER_SECOND up to RATE_BURST, one token per message.
function takeToken(rate: RateState): boolean {
  const now = Date.now();
  rate.tokens = Math.min(RATE_BURST, rate.tokens + ((now - rate.updatedAt) / 1000) * RATE_PER_SECOND);
  rate.updatedAt = now;
  if (rate.tokens < 1) {
    return false;
  }
  rate.tokens -= 1;
  return true;
}

function messageType(message: string | ArrayBuffer): string | null {
  if (typeof message !== "string") {
    return null;
  }
  try {
    return JSON.parse(message)?.type ?? null;
  } catch (e) {
    return null;
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
