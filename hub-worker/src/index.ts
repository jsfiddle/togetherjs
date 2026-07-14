import type { Env } from "./env";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return new Response("OK");
    }

    if (url.pathname === "/findroom") {
      return handleFindRoom(request, url, env);
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

// Ported from hub/server.js:120-136,167-194 — same validation and CORS
// behavior, backed by the Registry Durable Object instead of an in-process
// `allConnections` scan.
async function handleFindRoom(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  const prefix = url.searchParams.get("prefix") || "";
  const max = parseInt(url.searchParams.get("max") || "", 10);
  if (!prefix || !max || prefix.search(/[^a-zA-Z0-9]/) !== -1) {
    return new Response(
      "Bad request: you must include a valid prefix=CHARS&max=NUM portion of the URL",
      { status: 400, headers: { "Content-Type": "text/plain", ...CORS_HEADERS } }
    );
  }

  const id = env.REGISTRY.idFromName("global");
  const name = await env.REGISTRY.get(id).findRoom(prefix, max);
  return new Response(JSON.stringify({ name }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export { Room } from "./room";
export { Registry } from "./registry";
export type { Env } from "./env";
