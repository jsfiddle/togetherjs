import type { Room } from "./room";
import type { Registry } from "./registry";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  REGISTRY: DurableObjectNamespace<Registry>;
}
