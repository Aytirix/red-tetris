import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
} from "react";
import { socket } from "../socket/socket";
import {
	normalizeUsernameAvailability,
	type AppFaction,
	type NormalizedUsernameAvailability,
	USER_RESULT_USERNAME_AVAILABLE_EVENT,
} from "../socket/userState";

export type WsEventSnapshot = {
	payload: unknown;
	receivedAt: number;
};

type WsState = {
	lastByEvent: Record<string, WsEventSnapshot>;
	session: {
		faction: AppFaction | null;
		lastUsernameAvailability: NormalizedUsernameAvailability | null;
	};
};

type WsStateAction =
	| {
		type: "ws:event";
		eventName: string;
		payload: unknown;
		receivedAt: number;
		currentUsername: string | null;
	}
	| {
		type: "session:set-current-user-faction";
		faction: AppFaction | null;
	}
	| {
		type: "session:clear-current-user-faction";
	};

type WsActions = {
	rememberCurrentUserFaction: (faction: AppFaction | null) => void;
	clearCurrentUserFaction: () => void;
};

const initialState: WsState = {
	lastByEvent: {},
	session: {
		faction: null,
		lastUsernameAvailability: null,
	},
};

const WsStateContext = createContext<WsState | null>(null);
const WsActionsContext = createContext<WsActions | null>(null);

function readStoredUsername(): string | null {
	const username = localStorage.getItem("username")?.trim();
	return username ? username : null;
}

function reduceWsState(state: WsState, action: WsStateAction): WsState {
	switch (action.type) {
		case "ws:event": {
			const nextState: WsState = {
				...state,
				lastByEvent: {
					...state.lastByEvent,
					[action.eventName]: {
						payload: action.payload,
						receivedAt: action.receivedAt,
					},
				},
			};

			if (action.eventName !== USER_RESULT_USERNAME_AVAILABLE_EVENT) {
				return nextState;
			}

			const result = normalizeUsernameAvailability(action.payload);
			if (!result) {
				return nextState;
			}

			nextState.session = {
				...state.session,
				lastUsernameAvailability: result,
				faction: action.currentUsername && result.username === action.currentUsername
					? result.user_faction
					: state.session.faction,
			};

			return nextState;
		}

		case "session:set-current-user-faction":
			return {
				...state,
				session: {
					...state.session,
					faction: action.faction,
				},
			};

		case "session:clear-current-user-faction":
			return {
				...state,
				session: {
					...state.session,
					faction: null,
				},
			};

		default:
			return state;
	}
}

export function WsStateProvider({ children }: { children: React.ReactNode }) {
	const [state, dispatch] = useReducer(reduceWsState, initialState);

	useEffect(() => {
		function handleAny(eventName: string, ...args: unknown[]) {
			dispatch({
				type: "ws:event",
				eventName,
				payload: args.length <= 1 ? args[0] : args,
				receivedAt: Date.now(),
				currentUsername: readStoredUsername(),
			});
		}

		socket.onAny(handleAny);

		return () => {
			socket.offAny(handleAny);
		};
	}, []);

	const rememberCurrentUserFaction = useCallback((faction: AppFaction | null) => {
		dispatch({ type: "session:set-current-user-faction", faction });
	}, []);

	const clearCurrentUserFaction = useCallback(() => {
		dispatch({ type: "session:clear-current-user-faction" });
	}, []);

	const actions = useMemo<WsActions>(() => ({
		rememberCurrentUserFaction,
		clearCurrentUserFaction,
	}), [clearCurrentUserFaction, rememberCurrentUserFaction]);

	return (
		<WsActionsContext.Provider value={actions}>
			<WsStateContext.Provider value={state}>
				{children}
			</WsStateContext.Provider>
		</WsActionsContext.Provider>
	);
}

export function useWsState(): WsState {
	const context = useContext(WsStateContext);
	if (!context) {
		throw new Error("useWsState must be used within a WsStateProvider");
	}
	return context;
}

export function useWsSession() {
	return useWsState().session;
}

export function useWsEvent<T = unknown>(eventName: string): T | null {
	const event = useWsState().lastByEvent[eventName];
	return (event?.payload as T | undefined) ?? null;
}

export function useRememberCurrentUserFaction(): WsActions["rememberCurrentUserFaction"] {
	const context = useContext(WsActionsContext);
	if (!context) {
		throw new Error("useRememberCurrentUserFaction must be used within a WsStateProvider");
	}
	return context.rememberCurrentUserFaction;
}

export function useClearCurrentUserFaction(): WsActions["clearCurrentUserFaction"] {
	const context = useContext(WsActionsContext);
	if (!context) {
		throw new Error("useClearCurrentUserFaction must be used within a WsStateProvider");
	}
	return context.clearCurrentUserFaction;
}
