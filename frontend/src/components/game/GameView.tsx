import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameStatePayload } from "../../types/game";
import { emitGameDrop, emitGameJoker, emitGameMove, emitGameRotate, emitSubscribeSpectator } from "../../socket/events/game";
import { actionForCode, loadKeyBindings } from "../../config/keyBindings";
import { useKeyLabel } from "../../hooks/useKeyLabel";
import { useShop } from "../../contexts/ShopContext";
import { getPieceTheme, themeCssVars } from "../../config/pieceThemes";
import GameBoard from "./GameBoard";
import GameHud from "./GameHud";
import NextPiecePreview from "./NextPiecePreview";
import OpponentsColumn from "./OpponentsColumn";

const MAIN_CELL_SIZE = 38;
const MINI_CELL_SIZE = 10;
const MINI_HEADER_PX = 22;
const MINI_GAP_PX = 12;
const MINI_PADDING_PX = 18;

type Props = {
	state: GameStatePayload;
	roomName: string;
	playerName: string;
	eliminated?: boolean;
	onEliminationDone?: () => void;
	onLeave?: () => void;
};

export default function GameView({ state, roomName, playerName, eliminated = false, onEliminationDone, onLeave }: Props) {
	const isSpectator = state.spectator !== false;
	const spectatorOf = isSpectator ? (state.spectator as string) : null;
	const isSolo = roomName.startsWith("sologame_");
	const showLevel = isSolo;

	const { equipped } = useShop();
	// En spectateur, on affiche le cosmétique DU JOUEUR OBSERVÉ (envoyé par le serveur),
	// pas le nôtre. Sur son propre plateau on garde le thème local, qui reflète
	// immédiatement un changement fait à la boutique en cours de session.
	const pieceTheme = getPieceTheme(isSpectator ? (state.theme ?? equipped) : equipped);
	// Touche du joker affichée dans le HUD, dans la disposition réelle du joueur.
	// La lecture localStorage est mémoïsée: sans ça elle repartirait à CHAQUE frame.
	const keyLabel = useKeyLabel();
	const jokerBinding = useMemo(() => loadKeyBindings().joker, []);
	const jokerKey = keyLabel(jokerBinding);

	const boardRows = state.board.length;
	const mainBoardHeightPx = boardRows * MAIN_CELL_SIZE;

	// Secousse du plateau quand le joueur encaisse des lignes de pénalité.
	// Une ligne de pénalité est une rangée entièrement composée de cellules "penalty"
	// (les lignes serveur sont pleines) : la pièce en chute ne peut jamais en former
	// une, donc ce comptage est fiable.
	const penaltyRows = useMemo(
		() => state.board.filter((row) => row.length > 0 && row.every((cell) => cell === "penalty")).length,
		[state.board]
	);
	// Alterne 1/2 : reposer la MÊME classe ne relance pas l'animation, donc deux salves
	// rapprochées ne produiraient qu'une seule secousse. 0 = pas de secousse.
	const [shakePhase, setShakePhase] = useState(0);
	// null au premier rendu : sert de valeur de référence, aucune secousse à l'entrée
	// (utile si on rejoint/spectate un plateau déjà pénalisé).
	const prevPenaltyRows = useRef<number | null>(null);
	// Le plateau AFFICHÉ peut changer d'identité (bascule spectateur / clic sur un
	// mini-plateau) : on rebase alors le compteur, sinon passer sur un adversaire déjà
	// pénalisé déclencherait une secousse alors qu'on n'a rien encaissé.
	const watchedBoard = state.spectator;
	const prevWatchedBoard = useRef(watchedBoard);
	useEffect(() => {
		const targetChanged = prevWatchedBoard.current !== watchedBoard;
		prevWatchedBoard.current = watchedBoard;
		if (targetChanged || prevPenaltyRows.current === null) {
			prevPenaltyRows.current = penaltyRows;
			return;
		}
		if (penaltyRows > prevPenaltyRows.current)
			setShakePhase((phase) => (phase === 1 ? 2 : 1));
		prevPenaltyRows.current = penaltyRows;
	}, [penaltyRows, watchedBoard]);

	// Split opponents: left column fills until full (2 minis per row), then right (under next piece)
	const { left, right } = useMemo(() => {
		if (state.opponents.length === 0) return { left: [], right: [] };
		const oppRows = state.opponents[0].board.length;
		const miniHeight = oppRows * MINI_CELL_SIZE + MINI_HEADER_PX + MINI_PADDING_PX;
		const rowsAvail = Math.max(
			1,
			Math.floor((mainBoardHeightPx + MINI_GAP_PX) / (miniHeight + MINI_GAP_PX))
		);
		const fitLeft = rowsAvail * 2;
		return {
			left: state.opponents.slice(0, fitLeft),
			right: state.opponents.slice(fitLeft),
		};
	}, [state.opponents, mainBoardHeightPx]);

	// Keyboard input — only for player (non-spectator).
	// Les touches sont personnalisables (menu « Touches » du dashboard) ; on les lit
	// au montage de la partie, la config ne changeant pas en cours de jeu.
	useEffect(() => {
		if (isSpectator) return;
		const bindings = loadKeyBindings();
		function onKey(e: KeyboardEvent) {
			// Un évènement sans code physique (IME, clavier virtuel) ne doit jamais
			// être rattaché à une action.
			if (!e.code) return;
			// Alias historique imposé par le sujet: KeyX pivote aussi, tant que cette
			// touche n'a pas été réassignée à une autre action par le joueur.
			const action = actionForCode(bindings, e.code) ?? (e.code === "KeyX" ? "rotate" : null);
			if (!action) return;
			// Chute rapide et joker ne doivent pas se répéter si la touche reste enfoncée.
			if (e.repeat && (action === "hardDrop" || action === "joker")) return;
			e.preventDefault();
			switch (action) {
				case "moveLeft": emitGameMove("left"); break;
				case "moveRight": emitGameMove("right"); break;
				case "softDrop": emitGameMove("down"); break;
				case "rotate": emitGameRotate(); break;
				case "hardDrop": emitGameDrop(); break;
				case "joker": emitGameJoker(); break;
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isSpectator]);

	function handleSpectatorSelect(username: string) {
		if (!isSpectator) return;
		emitSubscribeSpectator(roomName, username);
	}

	return (
		<div className="tetris-stage" data-recipe={pieceTheme.recipe} style={themeCssVars(pieceTheme) as CSSProperties}>
			{onLeave && (
				<button type="button" className="button button-ghost tetris-stage__leave" onClick={onLeave}>
					Quitter la partie
				</button>
			)}
			<div className="tetris-stage__inner">
				{/* Left column — first opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--left"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<OpponentsColumn
						opponents={left}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
					/>
				</aside>

				{/* Center — main board with score on top, level top-right */}
				<div className="tetris-stage__center">
					<GameHud
						score={state.score}
						level={state.level}
						showLevel={showLevel}
						spectatorOf={spectatorOf}
						mode={state.mode}
						lines={state.lines}
						linesTarget={state.linesTarget}
						timeLeftMs={state.timeLeftMs}
						jokersLeft={state.jokersLeft}
						jokerKey={jokerKey}
					/>
					<div
						className={`tetris-stage__board-wrap${shakePhase ? ` tetris-stage__board-wrap--shake-${shakePhase}` : ""}`}
						onAnimationEnd={() => setShakePhase(0)}
					>
						<GameBoard
							board={state.board}
							cellSize={MAIN_CELL_SIZE}
							ghost={state.ghost}
							ghostPiece={state.currentPiece?.type ?? null}
							fade={state.fade}
						/>
					</div>
				</div>

				{/* Right column — next piece, then overflow opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--right"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<NextPiecePreview piece={state.nextPiece} />
					<OpponentsColumn
						opponents={right}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
						scrollable
						className="tetris-opponents--right"
					/>
				</aside>
			</div>
			{/* avoid unused warning for player name in this component scope */}
			<span hidden>{playerName}</span>

			{eliminated && (
				<div className="tetris-gameover-overlay">
					<span
						className="tetris-gameover-overlay__text"
						onAnimationEnd={onEliminationDone}
					>
						GAME OVER
					</span>
				</div>
			)}
		</div>
	);
}
