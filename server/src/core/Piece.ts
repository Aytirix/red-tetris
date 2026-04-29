import type { PieceType } from "../types/game/gameTypes.js";
import type { PieceShape } from "../types/game/piecesGameTypes.js";

export class Piece {
	public shape: PieceShape;
	public type: PieceType;
	private y: number;
	private x: number;
	private rotation: number;
	constructor (shape: PieceShape, type: PieceType) {
		this.type = type
		this.shape = shape;
		this.y = 0;
		this.x = 4;
		this.rotation = 0;
	}
	moveLeft() : void {
		this.x -= 1
	}
	moveRight() : void {
		this.x += 1
	}
	moveDown() : void {
		this.y += 1
	}
	getY() : number {
		return this.y
	}
	getX() : number {
		return this.x
	}
	getRotate() : number {
		return this.rotation
	}
}