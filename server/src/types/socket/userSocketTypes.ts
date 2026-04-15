import type { Socket } from "socket.io";

export type CheckUsernamePayload = {
	username: string;
};

export type userRegisterPayload = {
	username: string;
	faction: string;
	avatar: string;
}

export type SocketValidator = (payload: unknown) => boolean;

export type SocketValidatorMap = Record<string, SocketValidator>;