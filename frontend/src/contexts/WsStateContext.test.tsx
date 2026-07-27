import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";

const ws = vi.hoisted(() => ({ socket: null as unknown as FakeSocket }));

vi.mock("../socket/socket", () => ({
	get socket() { return ws.socket; },
}));

import {
	WsStateProvider,
	useClearCurrentUserFaction,
	useRememberCurrentUserFaction,
	useWsEvent,
	useWsSession,
	useWsState,
} from "./WsStateContext";

function wrapper({ children }: { children: ReactNode }) {
	return <WsStateProvider>{children}</WsStateProvider>;
}

beforeEach(() => {
	ws.socket = createFakeSocket();
	localStorage.clear();
});

afterEach(cleanup);

describe("WsStateContext — journal des evenements", () => {
	it("memorise le dernier payload de chaque event", () => {
		const { result } = renderHook(() => useWsEvent<{ id: number }>("room:joined"), { wrapper });

		expect(result.current).toBeNull();

		act(() => { ws.socket.receive("room:joined", { id: 1 }); });
		expect(result.current).toEqual({ id: 1 });

		act(() => { ws.socket.receive("room:joined", { id: 2 }); });
		expect(result.current).toEqual({ id: 2 });
	});

	it("conserve les evenements multi-arguments sous forme de tableau", () => {
		const { result } = renderHook(() => useWsEvent<unknown[]>("room:players"), { wrapper });

		act(() => { ws.socket.receive("room:players", "a", "b"); });

		expect(result.current).toEqual(["a", "b"]);
	});

	it("horodate chaque reception", () => {
		const { result } = renderHook(() => useWsState(), { wrapper });

		act(() => { ws.socket.receive("room:joined", null); });

		expect(result.current.lastByEvent["room:joined"].receivedAt).toBeTypeOf("number");
	});

	it("se desabonne du socket au demontage", () => {
		const { unmount } = renderHook(() => useWsState(), { wrapper });
		expect(ws.socket.anyListenerCount()).toBe(1);

		unmount();
		expect(ws.socket.anyListenerCount()).toBe(0);
	});
});

describe("WsStateContext — session utilisateur", () => {
	it("retient la faction du pseudo courant", () => {
		localStorage.setItem("username", "luffy");
		const { result } = renderHook(() => useWsSession(), { wrapper });

		act(() => {
			ws.socket.receive("user:ResultUsernameAvailable", {
				available: true,
				user_faction: "pirate",
				username: "luffy",
			});
		});

		expect(result.current.faction).toBe("pirate");
		expect(result.current.lastUsernameAvailability?.username).toBe("luffy");
	});

	it("n'ecrase pas la faction pour un autre pseudo", () => {
		localStorage.setItem("username", "luffy");
		const { result } = renderHook(() => useWsSession(), { wrapper });

		act(() => {
			ws.socket.receive("user:ResultUsernameAvailable", {
				available: true, user_faction: "pirate", username: "luffy",
			});
		});
		act(() => {
			ws.socket.receive("user:ResultUsernameAvailable", {
				available: true, user_faction: "marine", username: "zoro",
			});
		});

		expect(result.current.faction).toBe("pirate");
		expect(result.current.lastUsernameAvailability?.username).toBe("zoro");
	});

	it("ignore un payload de disponibilite mal forme", () => {
		const { result } = renderHook(() => useWsSession(), { wrapper });

		act(() => { ws.socket.receive("user:ResultUsernameAvailable", { available: "invalid" }); });

		expect(result.current.lastUsernameAvailability).toBeNull();
	});

	it("ignore un pseudo vide dans le localStorage", () => {
		localStorage.setItem("username", "   ");
		const { result } = renderHook(() => useWsSession(), { wrapper });

		act(() => {
			ws.socket.receive("user:ResultUsernameAvailable", {
				available: true, user_faction: "pirate", username: "luffy",
			});
		});

		expect(result.current.faction).toBeNull();
	});

	it("permet de forcer puis d'effacer la faction courante", () => {
		const { result } = renderHook(() => ({
			session: useWsSession(),
			remember: useRememberCurrentUserFaction(),
			clear: useClearCurrentUserFaction(),
		}), { wrapper });

		act(() => { result.current.remember("marine"); });
		expect(result.current.session.faction).toBe("marine");

		act(() => { result.current.clear(); });
		expect(result.current.session.faction).toBeNull();
	});
});

describe("WsStateContext — garde-fous", () => {
	it("useWsState exige le provider", () => {
		expect(() => renderHook(() => useWsState())).toThrowError(
			"useWsState must be used within a WsStateProvider",
		);
	});

	it("useRememberCurrentUserFaction exige le provider", () => {
		expect(() => renderHook(() => useRememberCurrentUserFaction())).toThrowError(
			"useRememberCurrentUserFaction must be used within a WsStateProvider",
		);
	});

	it("useClearCurrentUserFaction exige le provider", () => {
		expect(() => renderHook(() => useClearCurrentUserFaction())).toThrowError(
			"useClearCurrentUserFaction must be used within a WsStateProvider",
		);
	});
});
