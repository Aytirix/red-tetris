import { Socket } from "socket.io";
import { emitPlayersRoom, emitSubscrib } from "../emitters/roomEmitters.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";
import { userSocketStore } from "../userSocketStore.js";

export function handlerDisconnect(socket: Socket): void {
			socket.on("disconnect", () => {
				console.log("User disconnected: " + socket.id);
				for (const room of roomSocketStore.values()) {
					if (!room.removePlayerBySocketId(socket.id))
						continue
					if (room.countPlayer() === 0)
						roomSocketStore.delete(room.name)
					else
						emitPlayersRoom(room.getPlayers())
					emitSubscrib()
					break
				}
				spectatorSocketStore.delete(socket.id)
				userSocketStore.delete(socket.id)
			});
	}
