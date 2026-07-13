import type { Game } from "../../core/Game.js";
import type { Player } from "../../core/Player.js";

export const spectatorSocketStore = new Map<string, {game: Game, player: Player}>();
