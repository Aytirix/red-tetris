import type { Socket } from "socket.io";
import { Room } from "../../core/room.js";
import { createRoom } from "../../services/roomService.js";

export const roomSocketStore = new Map<string, Room>();