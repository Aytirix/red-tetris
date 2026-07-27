import type { Room } from "../../core/room.js";

// Registre des rooms vivantes, indexees par nom. Les imports `Socket` et `createRoom`
// qui trainaient ici n'etaient pas utilises, et `createRoom` creait en prime un cycle
// d'imports roomSocketStore -> roomService -> roomSocketStore.
export const roomSocketStore = new Map<string, Room>();
