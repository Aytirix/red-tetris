import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameStatePayload } from "../../types/game";
import { emitGameDrop, emitGameJoker, emitGameMove, emitGameRotate, emitSubscribeSpectator } from "../../socket/events/game";
import { actionForCode, loadKeyBindings } from "../../config/keyBindings";
import { useKeyLabel } from "../../hooks/useKeyLabel";
import { useShop } from "../../contexts/ShopContext";
import { getPieceTheme, themeCssVars } from "../../config/pieceThemes";
import { computeMainCellSize, computeMiniCellSize, fitCellSize } from "../../config/boardSizing";
import { useViewportSize } from "../../hooks/useViewportSize";
import { useElementSize } from "../../hooks/useElementSize";
import GameBoard, { type DropStreak, type DropTrail, type LockTimer } from "./GameBoard";
import GameHud from "./GameHud";
import ControlsLegend from "./ControlsLegend";
import NextPiecePreview from "./NextPiecePreview";
import OpponentsColumn from "./OpponentsColumn";

// Longueur du sillage laisse par une chute instantanee, en rangees.
const DROP_TRAIL_ROWS = 6;

const MINI_HEADER_PX = 22;
const MINI_GAP_PX = 12;
const MINI_PADDING_PX = 18;

type Props = {
	state: GameStatePayload;
	roomName: string;
	eliminated?: boolean;
	onEliminationDone?: () => void;
	onLeave?: () => void;
	onRestart?: () => void;
};

export default function GameView({ state, roomName, eliminated = false, onEliminationDone, onLeave, onRestart }: Props) {
	const isSpectator = state.spectator !== false;
	const spectatorOf = isSpectator ? (state.spectator as string) : null;
	const isSolo = roomName.startsWith("sologame_");
	const showLevel = isSolo;

	const { equipped } = useShop();
	const pieceTheme = getPieceTheme(isSpectator ? (state.theme ?? equipped) : equipped);
	// Touche du joker affichée dans le HUD, dans la disposition réelle du joueur.
	// La lecture localStorage est mémoïsée: sans ça elle repartirait à CHAQUE frame.
	const keyLabel = useKeyLabel();
	const jokerBinding = useMemo(() => loadKeyBindings().joker, []);
	const jokerKey = keyLabel(jokerBinding);

	const boardRows = state.board.length;
	const boardCols = state.board[0]?.length ?? 0;
	const boardAreaRef = useRef<HTMLDivElement>(null);
	const boardArea = useElementSize(boardAreaRef);
	// Repli tant que rien n'est mesuré (premier rendu, environnement sans
	// ResizeObserver) : estimation à partir du viewport.
	const viewport = useViewportSize();
	const mainCellSize = useMemo(
		() => boardArea
			? fitCellSize({
				availableWidth: boardArea.width,
				availableHeight: boardArea.height,
				rows: boardRows,
				cols: boardCols,
			})
			: computeMainCellSize({
				viewportWidth: viewport.width,
				viewportHeight: viewport.height,
				rows: boardRows,
				cols: boardCols,
			}),
		[boardArea, viewport.width, viewport.height, boardRows, boardCols],
	);
	const miniCellSize = computeMiniCellSize(mainCellSize);
	// Hauteur réellement occupée par le plateau (cellules + gouttières), qui borne
	// la hauteur des colonnes latérales.
	const mainBoardHeightPx = boardRows * mainCellSize + Math.max(0, boardRows - 1) * 2;
	// Largeur du plateau, cadre compris : le HUD s'y aligne (--stage-board-width).
	const mainBoardWidthPx = boardCols * mainCellSize + Math.max(0, boardCols - 1) * 2 + 22;
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
	const [dropTrail, setDropTrail] = useState<DropTrail | null>(null);
	// Le gestionnaire clavier est monté une fois : il lirait un `state` figé au montage.
	// Ces refs lui donnent accès au fantôme et à la pièce du rendu courant.
	const ghostRef = useRef(state.ghost);
	const currentPieceRef = useRef(state.currentPiece?.type ?? null);
	const dropCountRef = useRef(0);
	useEffect(() => {
		ghostRef.current = state.ghost;
		currentPieceRef.current = state.currentPiece?.type ?? null;
	}, [state.ghost, state.currentPiece]);
	const [lockTimer, setLockTimer] = useState<LockTimer | null>(null);
	const lockSeqRef = useRef(0);
	const grounded = state.lockInMs !== null && state.ghost.length > 0;
	const lockInMs = state.lockInMs;
	useEffect(() => {
		if (!grounded) {
			setLockTimer(null);
			return;
		}
		// `prev ?? …` : une fois la jauge lancée, les frames suivantes (le joueur bouge
		// la pièce) ne doivent NI la relancer NI changer sa durée.
		setLockTimer((prev) => prev ?? {
			id: ++lockSeqRef.current,
			ms: lockInMs ?? 0,
			cells: [],
			piece: null,
		});
	}, [grounded, lockInMs]);

	// Split opponents: left column fills until full (2 minis per row), then right (under next piece)
	const { left, right } = useMemo(() => {
		if (state.opponents.length === 0) return { left: [], right: [] };
		const oppRows = state.opponents[0].board.length;
		const miniHeight = oppRows * miniCellSize + MINI_HEADER_PX + MINI_PADDING_PX;
		const rowsAvail = Math.max(
			1,
			Math.floor((mainBoardHeightPx + MINI_GAP_PX) / (miniHeight + MINI_GAP_PX))
		);
		const fitLeft = rowsAvail * 2;
		return {
			left: state.opponents.slice(0, fitLeft),
			right: state.opponents.slice(fitLeft),
		};
	}, [state.opponents, mainBoardHeightPx, miniCellSize]);
	const startDropTrail = useCallback(() => {
		const ghost = ghostRef.current;
		if (!ghost || ghost.length === 0) return;
		const topByColumn = new Map<number, number>();
		for (const cell of ghost) {
			const current = topByColumn.get(cell.x);
			if (current === undefined || cell.y < current) topByColumn.set(cell.x, cell.y);
		}
		const streaks: DropStreak[] = [];
		for (const [x, top] of topByColumn) {
			if (top <= 0) continue;
			streaks.push({ x, fromY: Math.max(0, top - DROP_TRAIL_ROWS), toY: top - 1 });
		}
		if (streaks.length === 0) return;
		dropCountRef.current += 1;
		setDropTrail({ id: dropCountRef.current, streaks, piece: currentPieceRef.current });
	}, []);
	useEffect(() => {
		if (isSpectator) return;
		const bindings = loadKeyBindings();
		const ROTATE_REPEAT_DELAY = 130;
		const ROTATE_REPEAT_RATE = 45;
		// Descente: départ presque immédiat et cadence plus soutenue que la rotation —
		// c'est un déplacement continu, pas une suite d'actions distinctes.
		const SOFT_DROP_REPEAT_DELAY = 90;
		const SOFT_DROP_REPEAT_RATE = 35;
		const MOVE_REPEAT_DELAY = 120;
		const MOVE_REPEAT_RATE = 35;

		/** Repetition d'une action tenue : delai initial puis cadence fixe. */
		function makeRepeater(fire: () => void, delayMs: number, rateMs: number) {
			let delayId = 0;
			let intervalId = 0;
			const stop = () => {
				if (delayId) { window.clearTimeout(delayId); delayId = 0; }
				if (intervalId) { window.clearInterval(intervalId); intervalId = 0; }
			};
			const start = () => {
				stop();
				fire();
				delayId = window.setTimeout(() => {
					intervalId = window.setInterval(fire, rateMs);
				}, delayMs);
			};
			return { start, stop };
		}

		// Toutes les actions « tenues ». Les autres (chute instantanée, joker) sont
		// ponctuelles et ne doivent jamais se répéter.
		const repeaters = {
			rotate: makeRepeater(() => emitGameRotate(), ROTATE_REPEAT_DELAY, ROTATE_REPEAT_RATE),
			softDrop: makeRepeater(() => emitGameMove("down"), SOFT_DROP_REPEAT_DELAY, SOFT_DROP_REPEAT_RATE),
			moveLeft: makeRepeater(() => emitGameMove("left"), MOVE_REPEAT_DELAY, MOVE_REPEAT_RATE),
			moveRight: makeRepeater(() => emitGameMove("right"), MOVE_REPEAT_DELAY, MOVE_REPEAT_RATE),
		};
		type HeldAction = keyof typeof repeaters;
		function isHeldAction(action: string): action is HeldAction {
			return action in repeaters;
		}
		function stopRepeats() {
			for (const repeater of Object.values(repeaters)) repeater.stop();
		}
		// Alias historique imposé par le sujet: KeyX pivote aussi, tant que la touche
		// n'a pas été réassignée à une autre action par le joueur.
		function actionFor(code: string) {
			return actionForCode(bindings, code) ?? (code === "KeyX" ? "rotate" : null);
		}

		function onKey(e: KeyboardEvent) {
			// Un évènement sans code physique (IME, clavier virtuel) ne doit jamais
			// être rattaché à une action.
			if (!e.code) return;
			const action = actionFor(e.code);
			if (!action) return;

			// Les actions tenues pilotent leur propre répétition → on ignore l'auto-repeat
			// de l'OS, qui doublerait la cadence.
			if (isHeldAction(action)) {
				e.preventDefault();
				if (e.repeat) return;
				// Changer de direction sans relâcher : la nouvelle prend la main, sinon les
				// deux répétitions s'annuleraient l'une l'autre.
				if (action === "moveLeft") repeaters.moveRight.stop();
				else if (action === "moveRight") repeaters.moveLeft.stop();
				repeaters[action].start();
				return;
			}

			// Chute instantanée et joker ne doivent pas se répéter si la touche reste enfoncée.
			if (e.repeat) return;
			e.preventDefault();
			switch (action) {
				// Traînée déclenchée à la frappe, pas à la réception de l'état : le
				// serveur renvoie la pièce déjà posée, l'effet arriverait trop tard.
				case "hardDrop": startDropTrail(); emitGameDrop(); break;
				case "joker": emitGameJoker(); break;
			}
		}

		// Relâcher la touche stoppe sa répétition rapide.
		function onKeyUp(e: KeyboardEvent) {
			if (!e.code) return;
			const action = actionFor(e.code);
			if (action && isHeldAction(action)) repeaters[action].stop();
		}

		// Onglet quitté (alt-tab) : le keyup n'arrive jamais, la répétition tournerait
		// dans le vide et la pièce continuerait de bouger au retour.
		function onBlur() {
			stopRepeats();
		}

		window.addEventListener("keydown", onKey);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			stopRepeats();
		};
	}, [isSpectator, startDropTrail]);

	function handleSpectatorSelect(username: string) {
		if (!isSpectator) return;
		emitSubscribeSpectator(roomName, username);
	}

	return (
		<div className="tetris-stage" data-recipe={pieceTheme.recipe} style={themeCssVars(pieceTheme) as CSSProperties}>
			{(onLeave || (isSolo && onRestart)) && (
				<div className="tetris-stage__topbtns">
					{/* Rejouer: solo uniquement — relance directement une nouvelle partie
					    (même mode) sans repasser par le lobby. */}
					{isSolo && onRestart && (
						<button type="button" className="button button-secondary" onClick={onRestart}>
							🔄 Rejouer
						</button>
					)}
					{onLeave && (
						<button type="button" className="button button-ghost tetris-stage__leave" onClick={onLeave}>
							Quitter la partie
						</button>
					)}
				</div>
			)}
			<div className="tetris-stage__inner">
				{/* Left column — first opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--left"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<OpponentsColumn
						opponents={left}
						cellSize={miniCellSize}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
					/>
				</aside>

				{/* Center — main board with score on top, level top-right */}
				<div
					className="tetris-stage__center"
					style={{ "--stage-board-width": `${mainBoardWidthPx}px` } as CSSProperties}
				>
					<GameHud
						score={state.score}
						level={state.level}
						showLevel={showLevel}
						spectatorOf={spectatorOf}
						mode={state.mode}
						lines={state.lines}
						tetris={state.tetris}
						linesTarget={state.linesTarget}
						timeLeftMs={state.timeLeftMs}
						garbageLeft={state.garbageLeft}
						jokersLeft={state.jokersLeft}
						jokerKey={jokerKey}
					/>
					{/* Boîte élastique : prend toute la hauteur restante sous le HUD. C'est
					    elle qu'on mesure pour dimensionner les cellules. */}
					<div className="tetris-stage__board-area" ref={boardAreaRef}>
						<div
							className={`tetris-stage__board-wrap${shakePhase ? ` tetris-stage__board-wrap--shake-${shakePhase}` : ""}`}
							onAnimationEnd={() => setShakePhase(0)}
						>
							<GameBoard
								board={state.board}
								cellSize={mainCellSize}
								ghost={state.ghost}
								ghostPiece={state.currentPiece?.type ?? null}
								fade={state.fade}
								dropTrail={dropTrail}
								onDropTrailEnd={() => setDropTrail(null)}
								// Cases et couleur pris sur la frame COURANTE: la pièce peut
								// encore glisser pendant le sursis, la jauge doit la suivre.
								lockTimer={lockTimer && grounded
									? { ...lockTimer, cells: state.ghost, piece: state.currentPiece?.type ?? null }
									: null}
								cascade={state.cascade}
							/>
						</div>
					</div>
				</div>

				{/* Right column — next piece, then overflow opponents */}
				<aside
					className="tetris-stage__side tetris-stage__side--right"
					style={{ maxHeight: mainBoardHeightPx }}
				>
					<NextPiecePreview piece={state.nextPiece} />
					{/* Résumé des touches: uniquement pour le joueur actif (pas les
					    spectateurs, ni les éliminés qui basculent en spectateur). */}
					{!isSpectator && <ControlsLegend mode={state.mode} />}
					<OpponentsColumn
						opponents={right}
						cellSize={miniCellSize}
						clickable={isSpectator}
						currentSpectatorTarget={spectatorOf}
						onSelect={handleSpectatorSelect}
						scrollable
						className="tetris-opponents--right"
					/>
				</aside>
			</div>
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
