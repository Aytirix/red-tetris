import type { Socket } from "socket.io";
import { isValidRoomJoinPayload, isValidRoomKickPayload, isValidRoomModePayload, isValidRoomName, isValidRoomSetPrivatePayload, isValidSubscribeSpectatorPayload } from "../validators/validateRoomEvent.js";
import { emitError } from "../emitters/systemEmitters.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { createRoom, getRoom } from "../../../services/roomService.js";
import { emitKickedRoom, emitPlayersRoom, emitRoomJoined, emitRoomSettings, emitSubscrib } from "../emitters/roomEmitters.js";
import { emitSpectatorGame } from "../emitters/gameEmitters.js";
import { userSocketStore } from "../userSocketStore.js";
import { Game } from "../../../core/Game.js";
import { createPlayer } from "../../../services/playerService.js";
import type { Room } from "../../../core/room.js";
import type { Player } from "../../../core/Player.js";
import { spectatorSocketStore } from "../spectatorSocketStore.js";

export async function handlerRoomJoin(socket: Socket, payload: unknown): Promise<void> {
	if (!isValidRoomJoinPayload(payload)) {
		emitError(socket, "room:join", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	if (!isValidRoomName(payload.roomId)) {
		emitError(socket, "room:join", "Invalid roomId");
		console.log("Error: roomId invalid");
		return;
	}
	// Un socket ne doit jamais etre assis dans deux rooms a la fois: sinon le meme
	// socketId peut etre injecte deux fois dans une partie et desynchroniser
	// Room.players de Game.state.
	const currentRoom = getRoom(socket)
	if (currentRoom) {
		// Meme room: join idempotent, on se contente de renvoyer l'etat courant.
		if (currentRoom.name === payload.roomId) {
			emitRoomJoined(socket, currentRoom)
			return;
		}
		// Room differente: on quitte proprement l'ancienne (comme un room:leave) au
		// lieu de refuser, sinon un changement de room plus rapide que l'aller-retour
		// room:join/room:joined laisserait le client bloque sur l'ecran de connexion.
		leaveRoom(socket, currentRoom)
	}
	const room = roomSocketStore.get(payload.roomId)
	if (!room) {
		const newRoom = await createRoom(socket, payload.roomId)
		if (!newRoom) {
			emitError(socket, "room:join", "Failed to create room");
			return;
		}
			console.log("Room created: ", newRoom.name)
			roomSocketStore.set(payload.roomId, newRoom)
			emitRoomJoined(socket, newRoom)
			emitPlayersRoom(newRoom.getPlayers())
		}
	else {
			const newPlayer = await createPlayer(socket)
			if (!newPlayer)
				return
			if (!room.addPlayer(newPlayer)) {
				emitRoomJoined(socket, room)
				return
				}
				emitRoomJoined(socket, room)
				emitPlayersRoom(room.getPlayers())
			}
		}

export function handlerRoomSubscribe(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = true;
		emitSubscrib();
	}
}

export function handlerRoomUnsubscribe(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = false
	}
}

/**
 * Sortie propre d'un socket de sa room. Quitter en pleine partie sort d'abord le
 * joueur de la Game (mort + reevaluation de la fin de partie): sinon l'interval de
 * gravite survivrait a la suppression de la room.
 */
function leaveRoom(socket: Socket, room: Room) : boolean {
	room.getGame()?.abandon(socket.id)
	if (!room.removePlayerBySocketId(socket.id))
		return false
	if (room.countPlayer() === 0)
		roomSocketStore.delete(room.name)
	else
		emitPlayersRoom(room.getPlayers())
	return true
}

export function handlerRoomLeave(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		if (!leaveRoom(socket, room))
			return
		socket.emit("room:left")
		emitSubscrib()
	}
}

export function handleRoomKick(socket: Socket, payload: unknown) : void {
	if (!isValidRoomKickPayload(payload)) {
		emitError(socket, "room:kick", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const username = payload.username
	const room = getRoom(socket)
	if (!room)
		return
	// Kicker en pleine partie retirerait le joueur de la Room sans le retirer de la
	// Game: il ne pourrait plus jouer (getRoom -> null) alors que la gravite continue
	// de faire tomber ses pieces = elimination a la demande par l'hote.
	if (room.getStatus() !== "waiting") {
		emitError(socket, "room:kick", "Cannot kick during a running game");
		return
	}
	if (!room.searchName(username)) {
		emitError(socket, "room:kick", "Invalid username");
		console.log("Error: username invalid for kick");
		return;
	}
	const playerToKick = room.findPlayerByName(username)
	if (!playerToKick) {
		emitError(socket, "room:kick", "Invalid username");
		console.log("Error: player not found for kick");
		return;
	}
	if (!room.removePlayerByName(socket.id, username)) {
		emitError(socket, "room:kick", "Only host can kick players");
		console.log("Error: Only host can kick players");
		return;
	}
	emitKickedRoom(playerToKick.getSocket())
	emitPlayersRoom(room.getPlayers())
}

export function handleRoomMode(socket: Socket, payload: unknown) : void {
	if (!isValidRoomModePayload(payload)) {
		emitError(socket, "room:setMode", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const mode = payload.mode
	const room = getRoom(socket)
	if (!room)
		return
	// Changer le mode en pleine partie ferait diverger room.mode de game.mode.
	if (room.getStatus() !== "waiting") {
		emitError(socket, "room:setMode", "Cannot change mode during a running game");
		return
	}
	if (!room.setMode(mode, socket)) {
		emitError(socket, "room:setMode", "Invalid Mode or Not Host");
		console.log("Error: Invalid Mode or Not Host");
		return;
	}
	emitRoomSettings(room)
}

export function handleRoomSetPrivate(socket: Socket, payload: unknown) : void {
	if (!isValidRoomSetPrivatePayload(payload)) {
		emitError(socket, "room:setPrivate", "Invalid payload");
		console.log("Error: payload invalid");
		return;
	}
	const room = getRoom(socket)
	const visibility = payload.private
	if (!room)
		return
	if (room.getStatus() !== "waiting") {
		emitError(socket, "room:setPrivate", "Cannot change visibility during a running game");
		return
	}
	if (!room.setPrivate(visibility, socket)) {
		emitError(socket, "room:setPrivate", "only host can change visibility");
		console.log("Error: Invalid Mode or only host can change visibility");
		return;
	}
	emitRoomSettings(room)
}

export function handleRoomStart(socket: Socket, payload: unknown) : void {
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		// Les controles passent AVANT la construction de la Game: son constructeur
		// rattache tous les joueurs a la partie (setGame/setInGame). Le construire en
		// premier laissait n'importe quel non-hote reattacher tout le monde a une partie
		// morte, et un second room:start creait un deuxieme setInterval sans nettoyer le
		// premier - deux boucles de gravite sur les memes joueurs.
		if (socket.id !== room.getHostId())
			return
		if (room.getStatus() !== "waiting")
			return
		// Copie du tableau: getPlayers() renvoie la liste vivante de la Room, un depart
		// en cours de partie muterait sinon retroactivement Game.players (dont dependent
		// isSolo, getTickSpeed et updateLevel).
		const game = new Game(room.getMode(), [...room.getPlayers()], room)
		room.setStatus("playing")
		room.setGame(game)
		game.start()
	}
}

export function handleMove(socket: Socket, payload: unknown) : void {
	if (spectatorSocketStore.has(socket.id))
		return
	if (
		!payload ||
		typeof payload !== "object" ||
		!("direction" in payload) ||
		(payload.direction !== "left" && payload.direction !== "right" && payload.direction !== "down")
	) {
		emitError(socket, "game:move", "Invalid payload");
		return
	}

	const room = getRoom(socket)
	if (!room)
		return
	const game = room.getGame()
	if (!game)
		return
	game.move(socket.id, payload.direction)
}

export function handleRotate(socket: Socket, payload: unknown) : void {
	if (spectatorSocketStore.has(socket.id))
		return
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const game = room.getGame()
		if (!game)
			return
		game.rotate(socket.id)
	}
}

export function handleDrop(socket: Socket, payload: unknown) : void {
	if (spectatorSocketStore.has(socket.id))
		return
	if (!payload) {
		const room = getRoom(socket)
		if (!room)
			return
		const game = room.getGame()
		if (!game)
			return
		game.drop(socket.id)
	}
}

function getRoomByName(roomName: string) : Room | null {
	const room = roomSocketStore.get(roomName)
	if (!room)
		return null
	return room
}

function getGameInRoom(room: Room) : Game | null {
	if (room.getStatus() !== "playing")
		return null
	return room.getGame()
}

function getPlayerToSpectate(game: Game, username: null | string) : Player | null {
	if (username === null) {
		const firstPlayer = game.players[0]
		if (!firstPlayer)
			return null
		return firstPlayer
	}
	if (username === "")
		return null
	for (const player of game.players) {
		if (player.getName() === username)
			return player
	}
	return null
}

function saveSpectatorSubscription(socket: Socket, game: Game, player: Player) : void {
	spectatorSocketStore.set(socket.id, {
		game: game,
		player: player,
	})
}

export function handleSubscribeSpectator(socket: Socket, payload: unknown) : void {
	if (!isValidSubscribeSpectatorPayload(payload)) {
		emitError(socket, "game:subscribeSpectatorGame", "Invalid payload");
		return
	}

	const room = getRoomByName(payload.roomId)
	if (!room) {
		emitError(socket, "game:subscribeSpectatorGame", "Room not found");
		return
	}

	const game = getGameInRoom(room)
	if (!game) {
		emitError(socket, "game:subscribeSpectatorGame", "Game not found");
		return
	}

	// Un joueur VIVANT de cette partie ne doit jamais pouvoir se mettre en spectateur:
	// les frames spectateur contiennent les plateaux REELS des adversaires, ce qui
	// annulerait completement le spectre impose par le sujet. Seuls un joueur elimine
	// ou un socket exterieur a la partie peuvent spectater.
	const requesterState = game.getPlayerStateBySocketId(socket.id)
	if (requesterState && requesterState.isAlive) {
		emitError(socket, "game:subscribeSpectatorGame", "Alive players cannot spectate");
		return
	}

	const playerSpectated = getPlayerToSpectate(game, payload.user)
	if (!playerSpectated) {
		emitError(socket, "game:subscribeSpectatorGame", "Player not found");
		return
	}

	saveSpectatorSubscription(socket, game, playerSpectated)
	emitSpectatorGame(socket, game, playerSpectated)
}

export function handleUnsubscribeSpectator(socket: Socket, payload: unknown) : void {
	if (!payload)
		spectatorSocketStore.delete(socket.id)
}
