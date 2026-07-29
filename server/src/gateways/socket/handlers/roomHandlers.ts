import type { Socket } from "socket.io";
import { isEmptyPayload, isValidRoomJoinPayload, isValidRoomKickPayload, isValidRoomModePayload, isValidRoomName, isValidRoomSetPrivatePayload, isValidSubscribeSpectatorPayload } from "../validators/validateRoomEvent.js";
import { emitError } from "../emitters/systemEmitters.js";
import { roomSocketStore } from "../roomSocketStore.js";
import { createRoom, getRoom } from "../../../services/roomService.js";
import { emitKickedRoom, emitPlayersRoom, emitRoomDenied, emitRoomJoined, emitRoomSettings, emitSubscrib } from "../emitters/roomEmitters.js";
import { emitCountdown, emitGameUpdate, emitSpectatorForPlayer, emitSpectatorGame } from "../emitters/gameEmitters.js";
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
	const currentRoom = getRoom(socket)
	if (currentRoom) {
		// Meme room: join idempotent, on se contente de renvoyer l'etat courant.
		if (currentRoom.name === payload.roomId) {
			emitRoomJoined(socket, currentRoom)
			return;
		}
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
			if (room.getPrivate()) {
				const username = userSocketStore.get(socket.id)?.username ?? null
				if (!username || !room.isMember(username)) {
					emitRoomDenied(socket, "private")
					return
				}
			}
			if (room.getStatus() === "waiting" && room.isFull()) {
				const username = userSocketStore.get(socket.id)?.username ?? null
				const stalePlayer = username ? room.findPlayerByName(username) : undefined
				if (!stalePlayer || stalePlayer.getSocketId() === socket.id) {
					emitRoomDenied(socket, "full")
					return
				}
				room.removePlayer(stalePlayer)
			}
			const newPlayer = await createPlayer(socket)
			if (!newPlayer) {
				emitError(socket, "room:join", "Failed to join room")
				return
			}
			if (!room.addPlayer(newPlayer)) {
				emitRoomJoined(socket, room)
				return
				}
				emitRoomJoined(socket, room)
				emitPlayersRoom(room.getPlayers())
			}
		}

export function handlerRoomSubscribe(socket: Socket, payload: unknown) : void {
	if (isEmptyPayload(payload)) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = true;
		emitSubscrib();
	}
}

export function handlerRoomUnsubscribe(socket: Socket, payload: unknown) : void {
	if (isEmptyPayload(payload)) {
		const session = userSocketStore.get(socket.id)
		if (session)
			session.subscribe = false
	}
}

/** Sortie propre d'un socket de sa room. */
function leaveRoom(socket: Socket, room: Room) : boolean {
	room.getGame()?.abandon(socket.id)
	if (!room.removePlayerBySocketId(socket.id))
		return false
	if (room.countPlayer() === 0) {
		// Room videe: si un decompte etait en cours (pas encore de Game), il faut
		// l'annuler pour qu'il ne cree pas une partie sur une room supprimee.
		room.clearCountdown()
		roomSocketStore.delete(room.name)
	} else
		emitPlayersRoom(room.getPlayers())
	return true
}

export function handlerRoomLeave(socket: Socket, payload: unknown) : void {
	if (isEmptyPayload(payload)) {
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
	if (playerToKick.getSocketId() === socket.id) {
		emitError(socket, "room:kick", "Cannot kick yourself");
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
	// La visibilite change: re-pousser la liste publique filtree aux abonnes du
	// dashboard, sinon une room passee en privee resterait affichee (room fantome).
	emitSubscrib()
}

// Decompte de lancement: 3 -> 2 -> 1 (une valeur par seconde), puis demarrage reel.
const COUNTDOWN_SEQUENCE = [3, 2, 1]
const COUNTDOWN_STEP_MS = 1000
function startGameWithCountdown(room: Room) : void {
	emitCountdown(room.getPlayers(), COUNTDOWN_SEQUENCE[0]!)
	let index = 0
	const timer = setInterval(() => {
		try {
			index++
			if (index < COUNTDOWN_SEQUENCE.length) {
				emitCountdown(room.getPlayers(), COUNTDOWN_SEQUENCE[index]!)
				return
			}
			// Fin du decompte.
			room.clearCountdown()
			if (room.countPlayer() === 0) {
				roomSocketStore.delete(room.name)
				return
			}
			const game = new Game(room.getMode(), [...room.getPlayers()], room)
			room.setGame(game)
			game.start()
		} catch (error) {
			// Panne confinee a CETTE room: decompte arrete, room rouverte, joueurs
			// prevenus pour ne pas rester bloques sur un ecran de decompte fige.
			console.error(`Countdown failed in room "${room.name}":`, error)
			room.clearCountdown()
			room.getGame()?.stop()
			room.setGame(null)
			room.setStatus("waiting")
			for (const player of room.getPlayers())
				emitError(player.getSocket(), "room:start", "Failed to start game")
		}
	}, COUNTDOWN_STEP_MS)
	room.setCountdownTimer(timer)
}

export function handleRoomStart(socket: Socket, payload: unknown) : void {
	if (isEmptyPayload(payload)) {
		const room = getRoom(socket)
		if (!room)
			return
		// Les controles passent AVANT tout demarrage. Un second room:start (ou un start
		// pendant le decompte) est bloque par le status "playing" pose juste apres.
		if (socket.id !== room.getHostId())
			return
		if (room.getStatus() !== "waiting")
			return
		if (room.countPlayer() === 0)
			return
		// Sprint est une COURSE: interdit a moins de 2 joueurs (regle autoritative,
		// le client ne fait que desactiver le bouton). Alignee sur GAME_MODE_MIN_PLAYERS.
		if (room.getMode() === "sprint" && room.countPlayer() < 2) {
			emitError(socket, "room:start", "Le mode Sprint nécessite au moins 2 joueurs")
			return
		}
		// Verrou immediat: empeche l'arrivee de nouveaux joueurs et un second start
		// pendant le decompte, avant meme que la Game n'existe.
		room.setStatus("playing")
		startGameWithCountdown(room)
	}
}
export function handleRoomRestart(socket: Socket, payload: unknown) : void {
	if (!isEmptyPayload(payload))
		return
	const room = getRoom(socket)
	if (!room)
		return
	if (socket.id !== room.getHostId())
		return
	if (room.countPlayer() === 0)
		return
	if (room.getMode() === "sprint" && room.countPlayer() < 2) {
		emitError(socket, "room:restart", "Le mode Sprint nécessite au moins 2 joueurs")
		return
	}
	// Stoppe proprement le decompte et/ou la partie en cours avant de relancer.
	room.clearCountdown()
	const running = room.getGame()
	if (running)
		running.stop()
	room.setGame(null)
	room.setStatus("playing")
	startGameWithCountdown(room)
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

// Joker du mode invisible: revele le plateau quelques secondes, en nombre limite.
export function handleJoker(socket: Socket, payload: unknown) : void {
	if (spectatorSocketStore.has(socket.id))
		return
	if (!isEmptyPayload(payload))
		return
	const room = getRoom(socket)
	if (!room)
		return
	const game = room.getGame()
	if (!game)
		return
	if (!game.useJoker(socket.id))
		return
	const playerState = game.getPlayerStateBySocketId(socket.id)
	if (!playerState)
		return
	emitGameUpdate(playerState, game.getState())
	emitSpectatorForPlayer(playerState, game.getState())
}

export function handleRotate(socket: Socket, payload: unknown) : void {
	if (spectatorSocketStore.has(socket.id))
		return
	if (isEmptyPayload(payload)) {
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
	if (isEmptyPayload(payload)) {
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
	if (room.getPrivate()) {
		const username = userSocketStore.get(socket.id)?.username ?? null
		if (!username || !room.isMember(username)) {
			emitError(socket, "game:subscribeSpectatorGame", "Room not found");
			return
		}
	}

	const game = getGameInRoom(room)
	if (!game) {
		emitError(socket, "game:subscribeSpectatorGame", "Game not found");
		return
	}
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
	if (isEmptyPayload(payload))
		spectatorSocketStore.delete(socket.id)
}
