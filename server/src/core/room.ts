import type { Socket } from "socket.io";
import type { Game } from "./Game.js";
import type { Player } from "./Player.js";
import { isGameMode, type GameMode } from "../types/game/gameTypes.js";
export const MAX_PLAYERS_PER_ROOM = 4;

export class Room {
	public readonly name: string;
	private players: Player[];
	private hostPlayerId: string | null ;
	private status: "waiting" | "playing" | "finished" ;
	private mode: GameMode;
	private visibility: boolean;
	private game: Game | null;
	// Timer du decompte 3-2-1 entre room:start et le vrai demarrage de la partie.
	private countdownTimer: NodeJS.Timeout | null;
	private memberNames: Set<string>;
	constructor (name: string) {
		this.name = name;
		this.players = [];
		this.hostPlayerId = null;
		this.status = "waiting";
		this.memberNames = new Set();
		// Une partie solo est forcee privee et ne peut plus etre modifiee.
		this.visibility = name.startsWith("sologame_");
		this.game = null;
		this.countdownTimer = null;
		this.mode = "classique"
	}
	// Convention front: les rooms solo ont un nom prefixe "sologame_".
	isSolo() : boolean {
		return this.name.startsWith("sologame_")
	}
	isMember(username: string) : boolean {
		return this.memberNames.has(username)
	}
	setCountdownTimer(timer: NodeJS.Timeout | null) : void {
		this.countdownTimer = timer
	}
	// Annule le decompte en cours (room videe avant le demarrage). Sans ca l'interval
	// continuerait a tourner et tenterait de creer une partie sur une room orpheline.
	clearCountdown() : void {
		if (this.countdownTimer) {
			clearInterval(this.countdownTimer)
			this.countdownTimer = null
		}
	}
	addPlayer(player: Player) : boolean {
		if (!this.canJoin())
			return (false);
		if (this.players.some((current) => current.getSocketId() === player.getSocketId()))
			return (false);
		if (!this.hostPlayerId)
			this.hostPlayerId = player.getSocketId()
		this.players.push(player)
		this.memberNames.add(player.getName())
		return (true);
	}
	canJoin() : boolean {
		return this.status === "waiting" && !this.isFull()
	}
	isFull() : boolean {
		return this.players.length >= MAX_PLAYERS_PER_ROOM
	}
	setStatus(status: "waiting" | "playing" | "finished") : void {
		this.status = status
	}
	setMode(mode: string, socket: Socket) : boolean {
		// Seul l'hote choisit le mode, et uniquement parmi les modes existants.
		if (socket.id !== this.hostPlayerId)
			return false
		if (!isGameMode(mode))
			return false
		this.mode = mode
		return true
	}
	setPrivate(visibility: boolean, socket: Socket) : boolean {
		if (socket.id !== this.hostPlayerId)
			return false
		// Une partie solo reste privee: la visibilite n'est pas modifiable.
		if (this.isSolo())
			return false
		this.visibility = visibility
		return true
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
	getMode() : GameMode {
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
					this.memberNames.delete(username)
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
	}
