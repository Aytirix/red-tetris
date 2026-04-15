import type { Socket } from "socket.io";

export type CheckUsernamePayload = {
	username: string;
};

export type SocketValidator = (socket: Socket, payload: unknown) => boolean;

export type SocketValidatorMap = Record<string, SocketValidator>;