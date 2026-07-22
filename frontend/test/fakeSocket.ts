import { vi } from "vitest";

// Faux socket.io-client utilise par les tests de composants/contextes.
// Il reproduit uniquement la surface consommee par le front: on/off/emit,
// onAny/offAny, onAnyOutgoing/offAnyOutgoing et le flag `connected`.
// `receive()` simule un message venant du serveur.

type Handler = (...args: unknown[]) => void;
type AnyHandler = (event: string, ...args: unknown[]) => void;

export type FakeSocket = {
	connected: boolean;
	on: (event: string, handler: Handler) => FakeSocket;
	off: (event: string, handler?: Handler) => FakeSocket;
	emit: ((event: string, ...args: unknown[]) => FakeSocket) & {
		mock: { calls: unknown[][] };
		mockClear: () => void;
	};
	onAny: (handler: AnyHandler) => FakeSocket;
	offAny: (handler: AnyHandler) => FakeSocket;
	onAnyOutgoing: (handler: AnyHandler) => FakeSocket;
	offAnyOutgoing: (handler: AnyHandler) => FakeSocket;
	/** Simule la reception d'un event serveur (declenche les handlers + onAny). */
	receive: (event: string, ...args: unknown[]) => void;
	/** Nombre de handlers encore abonnes a un event: sert a verifier le cleanup. */
	listenerCount: (event: string) => number;
	/** Nombre de handlers onAny / onAnyOutgoing encore abonnes. */
	anyListenerCount: () => number;
	anyOutgoingListenerCount: () => number;
	/** Liste des events emis, dans l'ordre. */
	emitted: () => unknown[][];
	reset: () => void;
};

export function createFakeSocket(): FakeSocket {
	const handlers = new Map<string, Handler[]>();
	let anyHandlers: AnyHandler[] = [];
	let anyOutgoingHandlers: AnyHandler[] = [];

	const emit = vi.fn((event: string, ...args: unknown[]) => {
		for (const handler of [...anyOutgoingHandlers]) handler(event, ...args);
		return socket;
	});

	const socket: FakeSocket = {
		connected: true,
		on(event, handler) {
			const list = handlers.get(event) ?? [];
			list.push(handler);
			handlers.set(event, list);
			return socket;
		},
		off(event, handler) {
			if (!handler) {
				handlers.delete(event);
				return socket;
			}
			const list = handlers.get(event) ?? [];
			const index = list.indexOf(handler);
			if (index !== -1) list.splice(index, 1);
			handlers.set(event, list);
			return socket;
		},
		emit: emit as unknown as FakeSocket["emit"],
		onAny(handler) {
			anyHandlers.push(handler);
			return socket;
		},
		offAny(handler) {
			anyHandlers = anyHandlers.filter((h) => h !== handler);
			return socket;
		},
		onAnyOutgoing(handler) {
			anyOutgoingHandlers.push(handler);
			return socket;
		},
		offAnyOutgoing(handler) {
			anyOutgoingHandlers = anyOutgoingHandlers.filter((h) => h !== handler);
			return socket;
		},
		receive(event, ...args) {
			for (const handler of [...anyHandlers]) handler(event, ...args);
			for (const handler of [...(handlers.get(event) ?? [])]) handler(...args);
		},
		listenerCount(event) {
			return (handlers.get(event) ?? []).length;
		},
		anyListenerCount() {
			return anyHandlers.length;
		},
		anyOutgoingListenerCount() {
			return anyOutgoingHandlers.length;
		},
		emitted() {
			return emit.mock.calls as unknown[][];
		},
		reset() {
			handlers.clear();
			anyHandlers = [];
			anyOutgoingHandlers = [];
			emit.mockClear();
			socket.connected = true;
		},
	};

	return socket;
}
