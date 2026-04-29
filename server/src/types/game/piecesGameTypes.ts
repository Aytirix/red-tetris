import type { PieceType } from "./gameTypes.js";

export const I = [
					[1,1,1,1]
				] as const;

export const J = [
					[1,0,0],
					[1,1,1]
				] as const;

export const L = [
					[0, 0, 1] ,
					[1, 1, 1]
				] as const;

export const O = [
					[1,1],
					[1,1]
				] as const;

export const S = [
					[0,1,1],
					[1,1,0]
				] as const;

export const T = [
					[0,1,0],
					[1,1,1]
				] as const;

export const Z = [
					[1,1,0],
					[0,1,1]
				] as const;

export const PIECES_TYPES: PieceType[] = ["I", "J", "L","O", "S", "T", "Z"] as const;

export 	const pieces = {
		I: I,
		J: J,
		L: L,
		O: O,
		S: S,
		T: T,
		Z: Z,
	}

export type PieceCell = 0 | 1;

export type PieceShape = readonly (readonly PieceCell[])[]
