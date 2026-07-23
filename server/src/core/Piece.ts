import type { PieceType } from "../types/game/gameTypes.js";
import type { PieceCell, PieceShape } from "../types/game/piecesGameTypes.js";

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
	// Decalage libre (dx, dy): utilise par les wall kicks a la rotation. dy negatif
	// remonte la piece (y croit vers le bas).
	translate(dx: number, dy: number) : void {
		this.x += dx
		this.y += dy
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
	getRotatedShape() : PieceCell[][] | null{
		const oldHeight = this.shape.length
		const oldWidth = this.shape[0]?.length
		if (!oldWidth)
			return null

		const newHeight = oldWidth
		const newWidth = oldHeight
		const rotate: PieceCell[][] = Array.from({length: newHeight}, () => Array.from({length: newWidth}, () => 0))

		for (let i = 0; i < this.shape.length; i++) {
			const row = this.shape[i]
			if (!row)
				continue
			for (let j = 0; j < row.length; j++) {
				const rotateRow = rotate[j]
				if (!rotateRow)
					continue
				rotateRow[oldHeight - 1 - i] = row[j] ?? 0
			}
		}
		return rotate
		// this.rotation = (this.rotation + 1) % 4
	}
}
