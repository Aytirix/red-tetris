import type { Socket } from "socket.io";
import type { Game } from "./Game.js";
import { DEFAULT_THEME_ID } from "../config/shopThemes.js";

export class Player {
	private readonly name: string;
	private readonly socketId: string;
	private readonly socket: Socket;
	private readonly avatar: string;
	private readonly faction: string;
	// Cosmetique equipe au moment de rejoindre: c'est CE theme que voient les
	// spectateurs du plateau de ce joueur (et non le leur).
	private readonly theme: string;
	private game: Game | undefined;
	constructor (name: string, socket: Socket, avatar: string, faction: string, theme: string = DEFAULT_THEME_ID) {
		this.name = name
		this.socketId = socket.id
		this.socket = socket
		this.avatar = avatar
		this.faction = faction
		this.theme = theme
	}
	getTheme() : string {
		return this.theme
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
	setGame(game: Game) : void {
		this.game = game
	}
}