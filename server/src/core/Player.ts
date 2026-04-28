import type { Socket } from "socket.io";

export class Player {
	private readonly name: string;
	private readonly socketId: string;
	private readonly socket: Socket;
	private readonly avatar: string;
	private readonly faction: string;
	constructor (name: string, socket: Socket, avatar: string, faction: string) {
		this.name = name
		this.socketId = socket.id
		this.socket = socket
		this.avatar = avatar
		this.faction = faction
	}
	getName() : string {
		return this.name
	}
	getSocketId() : string {
		return this.socketId
	}
	getAvatar() : string {
		return this.avatar
	}
	getFaction() : string {
		return this.faction
	}
	getSocket() : Socket {
		return this.socket
	}
}