export class Player {
	private readonly name: string;
	private readonly socketId: string
	constructor (name : string, socketId : string) {
		this.name = name
		this.socketId = socketId
	}
	getName() : string {
		return this.name
	}
	getSocketId() : string {
		return this.socketId
	}
}