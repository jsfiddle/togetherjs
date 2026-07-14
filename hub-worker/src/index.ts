export interface Env {
  ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return new Response("OK");
    }

    // Matches the old hub's /hub/<id> routing (hub/server.js:247).
    const match = url.pathname.match(/^\/hub\/+([^/]+)\/*$/);
    if (!match) {
      return new Response("Resource not found", { status: 404 });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }

    const roomId = match[1];
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};

export { Room } from "./room";
