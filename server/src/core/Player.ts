import type { Socket } from "socket.io";
import type { Game } from "./Game.js";

export class Player {
	private readonly name: string;
	private readonly socketId: string;
	private readonly socket: Socket;
	private readonly avatar: string;
	private readonly faction: string;
	private game: Game | undefined;
	private inGame: boolean;
	constructor (name: string, socket: Socket, avatar: string, faction: string) {
		this.name = name
		this.socketId = socket.id
		this.socket = socket
		this.avatar = avatar
		this.faction = faction
		this.inGame = false
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
	getGame() : Game | undefined {
		return this.game
	}
	getInGame() : boolean {
		return this.inGame
	}
	setGame(game: Game) : void {
		this.game = game
	}
	setInGame(inGame: boolean) : void {
		this.inGame = inGame
	}
}