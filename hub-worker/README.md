# TogetherJS hub, on Cloudflare Workers

A port of `../hub/server.js` to Cloudflare Workers + Durable Objects. Same
protocol, same behavior, no server to babysit:

- `GET /status` → `200 OK` health check.
- WebSocket connections to `/hub/<roomId>` join a room; every message from one
  peer is relayed verbatim to every other peer in the same room. Setting
  `"server-echo": true` on a message also sends it back to the sender.
- On connect, the server sends `{"type": "init-connection", "peerCount": N}`
  where `N` is the number of peers already in the room.

Each room is one Durable Object instance (`src/room.ts`), addressed by name
from the room id (`src/index.ts`) — this mirrors the original's in-memory
`allConnections[id]` grouping, just with Cloudflare managing the instance
lifecycle instead of a single long-running Node process. Rooms use the
WebSocket Hibernation API, so an idle room's Durable Object can be evicted
from memory between messages at no cost.

Not ported: the Hixie-76 (pre-RFC6455) websocket compat shim, `/server-source`,
`/load` stats, and `/findroom` (prefix-based room auto-assignment) — see the
note in `site/docs/index.md` if you need `/findroom`.

## Setup

```sh
npm install
```

## Local dev

```sh
npm run dev
```

Runs a local server via `wrangler dev` (prints the URL, typically
`http://localhost:8787`). Point `TogetherJSConfig_hubBase` at it to test
against a local build.

## Deploy

```sh
npm run deploy
```

Requires a Cloudflare account (`wrangler` will prompt you to log in on first
use). Deploys to your account's `*.workers.dev` subdomain by default; add a
`routes` entry in `wrangler.toml` to use a custom domain instead. No credit
card is required — Durable Objects with the SQLite storage backend (configured
in `wrangler.toml`) run on the Workers Free plan.

After deploying, point TogetherJS at the printed URL:

```javascript
TogetherJSConfig_hubBase = "https://togetherjs-hub.<your-subdomain>.workers.dev";
```
