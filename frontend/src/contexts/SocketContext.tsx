import React, { createContext, useContext, useEffect, useState } from "react";
import { socket, registerAllListeners } from "../socket/socket";
import type { Socket } from "socket.io-client";

interface SocketContextType {
	socket: Socket;
	isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
	const [isConnected, setIsConnected] = useState(socket.connected);

	useEffect(() => {
		registerAllListeners();

		function onConnect() {
			setIsConnected(true);
		}
		function onDisconnect() {
			setIsConnected(false);
		}

		socket.on("connect", onConnect);
		socket.on("disconnect", onDisconnect);

		return () => {
			socket.off("connect", onConnect);
			socket.off("disconnect", onDisconnect);
		};
	}, []);

	return (
		<SocketContext.Provider value={{ socket, isConnected }}>
			{children}
		</SocketContext.Provider>
	);
}

export function useSocket(): SocketContextType {
	const context = useContext(SocketContext);
	if (!context) {
		throw new Error("useSocket must be used within a SocketProvider");
	}
	return context;
}
