import { describe, it, expect } from "vitest";
import { Piece } from "./Piece.js";
import { I, J, L, O, S, T, Z, type PieceShape } from "../types/game/piecesGameTypes.js";

describe("Piece", () => {
	describe("constructor", () => {
		it("spawns at x = 4 and y = 0", () => {
			const piece = new Piece(O, "O");
			expect(piece.getX()).toBe(4);
			expect(piece.getY()).toBe(0);
		});

		it("keeps the shape and the type given at construction", () => {
			const piece = new Piece(T, "T");
			expect(piece.type).toBe("T");
			expect(piece.shape).toEqual(T);
		});

		it("starts with a rotation of 0", () => {
			expect(new Piece(J, "J").getRotate()).toBe(0);
		});
	});

	describe("moveLeft / moveRight / moveDown", () => {
		it("moveLeft decrements x only", () => {
			const piece = new Piece(O, "O");
			piece.moveLeft();
			expect(piece.getX()).toBe(3);
			expect(piece.getY()).toBe(0);
		});

		it("moveRight increments x only", () => {
			const piece = new Piece(O, "O");
			piece.moveRight();
			expect(piece.getX()).toBe(5);
			expect(piece.getY()).toBe(0);
		});

		it("moveDown increments y only", () => {
			const piece = new Piece(O, "O");
			piece.moveDown();
			expect(piece.getY()).toBe(1);
			expect(piece.getX()).toBe(4);
		});

		it("translate applique un decalage libre, dy negatif remonte la piece", () => {
			const piece = new Piece(O, "O");
			piece.translate(-3, 2);
			expect(piece.getX()).toBe(1);
			expect(piece.getY()).toBe(2);
			piece.translate(0, -1);
			expect(piece.getY()).toBe(1);
		});

		it("accumulates several moves", () => {
			const piece = new Piece(O, "O");
			piece.moveLeft();
			piece.moveLeft();
			piece.moveRight();
			piece.moveDown();
			piece.moveDown();
			expect(piece.getX()).toBe(3);
			expect(piece.getY()).toBe(2);
		});
	});

	describe("getRotatedShape", () => {
		// Boite carree 4x4: la barre horizontale (ligne 1) devient verticale en COLONNE 2,
		// donc au milieu de la boite. La piece pivote sur elle-meme au lieu de sauter.
		it("rotates the I piece 90 degrees (horizontal -> vertical)", () => {
			const piece = new Piece(I, "I");
			expect(piece.getRotatedShape()).toEqual([
				[0, 0, 1, 0],
				[0, 0, 1, 0],
				[0, 0, 1, 0],
				[0, 0, 1, 0],
			]);
		});

		it("rotates the T piece 90 degrees clockwise", () => {
			const piece = new Piece(T, "T");
			expect(piece.getRotatedShape()).toEqual([
				[0, 1, 0],
				[0, 1, 1],
				[0, 1, 0],
			]);
		});

		it("leaves the O piece unchanged", () => {
			const piece = new Piece(O, "O");
			expect(piece.getRotatedShape()).toEqual([
				[1, 1],
				[1, 1],
			]);
		});

		it("rotates the J piece", () => {
			const piece = new Piece(J, "J");
			expect(piece.getRotatedShape()).toEqual([
				[0, 1, 1],
				[0, 1, 0],
				[0, 1, 0],
			]);
		});

		it("rotates the L piece", () => {
			const piece = new Piece(L, "L");
			expect(piece.getRotatedShape()).toEqual([
				[0, 1, 0],
				[0, 1, 0],
				[0, 1, 1],
			]);
		});

		it("rotates the S piece", () => {
			const piece = new Piece(S, "S");
			expect(piece.getRotatedShape()).toEqual([
				[0, 1, 0],
				[0, 1, 1],
				[0, 0, 1],
			]);
		});

		it("rotates the Z piece", () => {
			const piece = new Piece(Z, "Z");
			expect(piece.getRotatedShape()).toEqual([
				[0, 0, 1],
				[0, 1, 1],
				[0, 1, 0],
			]);
		});

		// Les boites etant carrees, la rotation ne change PAS les dimensions: c'est
		// exactement ce qui empeche la piece de deriver d'une demi-case a chaque tour.
		it("garde les dimensions de la boite", () => {
			const piece = new Piece(J, "J");
			const rotated = piece.getRotatedShape();
			expect(rotated).not.toBeNull();
			expect(rotated!.length).toBe(J.length);
			expect(rotated![0]!.length).toBe(J[0].length);
		});

		// Quatre quarts de tour = retour a la forme de depart, sans decalage: une piece
		// qu'on fait tourner en boucle doit rester exactement ou elle est.
		it.each([
			["I", I],
			["J", J],
			["L", L],
			["O", O],
			["S", S],
			["T", T],
			["Z", Z],
		])("revient a sa forme initiale apres 4 rotations (%s)", (_name, shape) => {
			const piece = new Piece(shape, "T");
			for (let turn = 0; turn < 4; turn++) {
				const rotated = piece.getRotatedShape();
				expect(rotated).not.toBeNull();
				piece.shape = rotated!;
			}
			expect(piece.shape).toEqual(shape);
			expect(piece.getX()).toBe(4);
			expect(piece.getY()).toBe(0);
		});

		it("does not mutate the original shape", () => {
			const piece = new Piece(T, "T");
			piece.getRotatedShape();
			expect(piece.shape).toEqual(T);
		});

		it("returns the original shape after four rotations", () => {
			let shape: PieceShape = T;
			const piece = new Piece(shape, "T");
			for (let i = 0; i < 4; i++) {
				piece.shape = piece.getRotatedShape()!;
			}
			expect(piece.shape).toEqual(T);
		});

		it("returns null when the shape has no column", () => {
			expect(new Piece([], "I").getRotatedShape()).toBeNull();
			expect(new Piece([[]], "I").getRotatedShape()).toBeNull();
		});
	});
});
