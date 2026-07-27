import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, render, renderHook, screen } from "@testing-library/react";
import { createFakeSocket, type FakeSocket } from "../../test/fakeSocket";

const ws = vi.hoisted(() => ({
	socket: null as unknown as FakeSocket,
}));

vi.mock("../socket/socket", () => ({
	get socket() { return ws.socket; },
}));

import { SocketProvider, useSocket } from "./SocketContext";

function Probe() {
	const { isConnected, socket } = useSocket();
	const isSharedSocket = (socket as unknown) === ws.socket;
	return <span data-testid="probe">{isConnected ? "on" : "off"}:{String(isSharedSocket)}</span>;
}

beforeEach(() => {
	ws.socket = createFakeSocket();
	ws.socket.connected = false;
});

afterEach(cleanup);

describe("SocketContext", () => {
	// Le provider ne branche QUE connect/disconnect: les listeners applicatifs
	// appartiennent aux pages, qui les retirent en quittant.
	it("ne branche que connect et disconnect au montage", () => {
		render(<SocketProvider><Probe /></SocketProvider>);

		expect(ws.socket.listenerCount("connect")).toBe(1);
		expect(ws.socket.listenerCount("disconnect")).toBe(1);
	});

	it("expose le socket partage et l'etat de connexion initial", () => {
		render(<SocketProvider><Probe /></SocketProvider>);

		expect(screen.getByTestId("probe").textContent).toBe("off:true");
	});

	it("suit les evenements connect et disconnect", () => {
		render(<SocketProvider><Probe /></SocketProvider>);

		act(() => { ws.socket.receive("connect"); });
		expect(screen.getByTestId("probe").textContent).toBe("on:true");

		act(() => { ws.socket.receive("disconnect"); });
		expect(screen.getByTestId("probe").textContent).toBe("off:true");
	});

	it("part deja connecte si le socket l'etait avant le montage", () => {
		ws.socket.connected = true;
		render(<SocketProvider><Probe /></SocketProvider>);

		expect(screen.getByTestId("probe").textContent).toBe("on:true");
	});

	it("retire ses listeners au demontage", () => {
		const { unmount } = render(<SocketProvider><Probe /></SocketProvider>);
		unmount();

		expect(ws.socket.listenerCount("connect")).toBe(0);
		expect(ws.socket.listenerCount("disconnect")).toBe(0);
	});

	it("refuse d'etre utilise hors du provider", () => {
		expect(() => renderHook(() => useSocket())).toThrowError(
			"useSocket must be used within a SocketProvider",
		);
	});
});
