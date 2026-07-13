import type { Socket } from "socket.io";
import type { Game } from "./Game.js";
import type { Player } from "./Player.js";

export class Room {
	public readonly name: string;
	private players: Player[];
	private hostPlayerId: string | null ;
	private status: "waiting" | "playing" | "finished" ;
	private mode: "classique" | "ultra" | "sprint";
	private visibility: boolean;
	private game: Game | null;
	constructor (name: string) {
		this.name = name;
		this.players = [];
		this.hostPlayerId = null;
		this.status = "waiting";
		this.visibility = false;
		this.game = null;
		this.mode = "classique"
	}
	addPlayer(player: Player) : boolean {
		if (!this.canJoin())
			return (false);
		if (!this.hostPlayerId)
			this.hostPlayerId = player.getSocketId()
		this.players.push(player)
		return (true);
	}
	canJoin() : boolean {
		return this.status === "waiting"
	}
	setStatus(status: "waiting" | "playing" | "finished") : void {
		this.status = status
	}
	setMode(mode: string, socket: Socket) : boolean {
		if (socket.id !== this.hostPlayerId)
			return false
		if (mode !== "classique" && mode !== "ultra" && mode !== "sprint")
			return false
		this.mode = mode
		return true
	}
	setPrivate(visibility: boolean, socket: Socket) : boolean {
		if (socket.id === this.hostPlayerId) {
			this.visibility = visibility
			return true
		}
		return false
	}
	setGame(game: Game | null) : void {
		this.game = game
	}
	getGame() : Game | null {
		return this.game
	}
	getPlayers() : Player[] {
		return (this.players)
	}
	getPrivate() : boolean {
		return (this.visibility)
	}
	getHostName() : string | null {
		const host = this.players.find((player) => player.getSocketId() === this.hostPlayerId);
		if (!host)
			return null;
		return host.getName();
	}
	getHostId() : string | null {
		return this.hostPlayerId
	}
	getMode() : "classique" | "ultra" | "sprint" {
		return this.mode
	}
	getStatus() : "waiting" | "playing" | "finished" {
		return this.status
	}
	countPlayer() : number {
		return this.players.length
	}
	removePlayer(playerToRemove: Player): boolean {
		const index = this.players.findIndex((currentPlayer) =>
			currentPlayer.getSocketId() === playerToRemove.getSocketId()
		);
		if (index === -1)
			return false;  

		this.players.splice(index, 1);

		if (playerToRemove.getSocketId() === this.hostPlayerId) {
			const firstPlayer = this.players[0];

			if (firstPlayer)
				this.hostPlayerId = firstPlayer.getSocketId();
			else
				this.hostPlayerId = null;
		}
		return true;
	}
	removePlayerBySocketId(socketId: string): boolean {
		const playerToRemove = this.players.find(
			(player) => player.getSocketId() === socketId
		);
		if (!playerToRemove)
			return false;
		
		return this.removePlayer(playerToRemove);
	}
	removePlayerByName(socketId: string, username: string) : boolean {
		if (this.getHostId() === socketId) {
			const players = this.getPlayers()
			for (const player of players) {
				if (player.getName() === username) {
					this.removePlayer(player)
					return true
				}
			}
		}
		return false
	}
	reassignHost(player: Player) : void {
		this.hostPlayerId = player.getSocketId()
	}
	searchName(username: string): boolean {
		return this.getPlayers().some((player) => player.getName() === username)
	}
	findPlayerByName(username: string): Player | undefined {
		return this.players.find((player) => player.getName() === username)
	}
	startGame() : void {}
	}
