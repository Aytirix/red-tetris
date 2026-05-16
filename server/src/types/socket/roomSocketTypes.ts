export type RoomJoinPayload = {
	roomId: string;
};

export type RoomJoinedPayload = {
	roomId: string;
	joined: boolean;
	players: {
		username: string;
		avatar: string;
		faction: string;
	}[];
};

export type RoomKickPayload = {
	username: string;
};

export type RoomModePayload = {
	mode: string;
}

export type RoomSetPrivatePayload = {
	private: boolean
}