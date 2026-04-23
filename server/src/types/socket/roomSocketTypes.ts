export type RoomJoinPayload = {
	roomId: string;
};

export type RoomJoinedPayload = {
	roomId: string;
	players: {
		username: string;
		avatar: string;
		faction: string;
	}[];
};