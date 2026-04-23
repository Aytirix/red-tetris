import type { Game } from "./Game.js";
import type { Player } from "./Player.js";

export class Room {
	public readonly name: string;
	private players: Player[];
	private hostPlayerId: string | null ;
	private status: "waiting" | "playing" | "finished" ;
	private game: Game | null;
	constructor (name: string) {
		this.name = name;
		this.players = [];
		this.hostPlayerId = null;
		this.status = "waiting";
		this.game = null;
	}
	canJoin() : boolean {
		return this.status === "waiting"
	}
	addPlayer(player: Player) : boolean {
		if (!this.canJoin())
			return (false);
		if (!this.hostPlayerId)
			this.hostPlayerId = player.getSocketId()
		this.players.push(player)
		return (true);
	}
	getPlayers() : Player[] {
		return (this.players)
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
	removePlayer(playerToRemove: Player): boolean {
		const index = this.players.findIndex((currentPlayer) =>
			currentPlayer.getSocketId() === playerToRemove.getSocketId()
		);
		if (index === -1)
			return false;  

		this.players.splice(index, 1);

		if (playerToRemove.getSocketId() === this.hostPlayerId) {
			if (this.players.length > 0)
				this.hostPlayerId = this.players[0].getSocketId();
			else
				this.hostPlayerId = null;
		}
		return true;
	}
	reassignHost(player: Player) : void {
		this.hostPlayerId = player.getSocketId()
	}
	startGame() : void {}
}