export class Player {
	private readonly name: string;
	private readonly socketId: string;
	private readonly avatar: string;
	private readonly faction: string;
	constructor (name: string, socketId: string, avatar: string, faction: string) {
		this.name = name
		this.socketId = socketId
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
}