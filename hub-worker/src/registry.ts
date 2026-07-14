import { DurableObject } from "cloudflare:workers";
import { Env } from "./env";

interface RoomEntry {
  prefix: string;
  peerCount: number;
}

// Singleton (always addressed via env.REGISTRY.idFromName("global")). A
// single Room Durable Object only knows about its own peers, so /findroom's
// "pick the least-populated room for this prefix" query (ported from
// ../../hub/server.js:167-194) needs a place that knows about all rooms.
export class Registry extends DurableObject<Env> {
  private rooms: Record<string, RoomEntry> | null = null;

  private async rows(): Promise<Record<string, RoomEntry>> {
    if (!this.rooms) {
      this.rooms = (await this.ctx.storage.get<Record<string, RoomEntry>>("rooms")) ?? {};
    }
    return this.rooms;
  }

  // Called by Room DOs on connect/disconnect to keep this registry's view of
  // peer counts current. peerCount === 0 drops the room from the registry.
  async report(roomId: string, prefix: string, peerCount: number): Promise<void> {
    const rooms = await this.rows();
    if (peerCount > 0) {
      rooms[roomId] = { prefix, peerCount };
    } else {
      delete rooms[roomId];
    }
    await this.ctx.storage.put("rooms", rooms);
  }

  async findRoom(prefix: string, max: number): Promise<string> {
    const rooms = await this.rows();
    let smallestCount: number | undefined;
    let smallestRooms: string[] = [];
    for (const roomId in rooms) {
      const entry = rooms[roomId];
      if (entry.prefix !== prefix || entry.peerCount >= max) {
        continue;
      }
      if (smallestCount === undefined || entry.peerCount < smallestCount) {
        smallestCount = entry.peerCount;
        smallestRooms = [roomId];
      } else if (entry.peerCount === smallestCount) {
        smallestRooms.push(roomId);
      }
    }
    if (smallestRooms.length) {
      return smallestRooms[Math.floor(Math.random() * smallestRooms.length)];
    }
    return `${prefix}__${generateId()}`;
  }
}

function generateId(length = 10): string {
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return s;
}
