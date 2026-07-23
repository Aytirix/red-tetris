// Seuils, cooldowns et indices de landmarks pour les contrôles à la main.
// Porté depuis le bac à sable frontend (frontend/src/test/hands_detector) — la logique
// de gestes est pure, elle tourne désormais côté serveur: c'est le serveur qui reçoit
// l'image, détecte les 21 points et DÉCIDE l'action à appliquer à la partie.
// Ces valeurs sont volontairement exposées pour être réglées "à chaud" pendant les tests.

// Détection de poing: ratio (bout→poignet) / (mcp→poignet). En dessous => doigt replié.
export const FIST_RATIO_THRESHOLD = 0.85;
// Nombre de doigts (hors pouce) repliés pour compter un poing.
export const FIST_MIN_CURLED_FINGERS = 4;

// Cooldowns par action (ms) pour éviter le spam de gestes.
export const COOLDOWN_MOVE_MS = 150;
export const COOLDOWN_ROTATE_MS = 300;
export const COOLDOWN_SOFT_DROP_MS = 70;
export const COOLDOWN_HARD_DROP_MS = 500;
// Après un hard drop, toutes les autres actions sont bloquées ce laps de temps.
export const COOLDOWN_RELEASE_BLOCK_MS = 350;

// Contrôles au mouvement. X est mirroré car la webcam est affichée en mode selfie.
export const MOTION_MIRROR_X = true;
export const MOTION_HISTORY_MS = 1400;
export const MOTION_TRACK_LOST_MS = 350;

// Détection de swipe de la paume (mouvement franc gauche/droite/bas).
export const MOTION_SWIPE_WINDOW_MS = 260;
export const MOTION_SWIPE_HAND_SCALE_RATIO = 0.8;
export const MOTION_SWIPE_MIN_DISTANCE = 0.1;
export const MOTION_SWIPE_MAX_DISTANCE = 0.24;
export const MOTION_SWIPE_MIN_SPEED = 0.45;
export const MOTION_SWIPE_DOMINANCE_RATIO = 1.2;
export const MOTION_SWIPE_REPEAT_BLOCK_MS = 350;
export const MOTION_TWO_HAND_DROP_WINDOW_MS = 150;

// Rotation par POING fermé (remplace le cercle du doigt du bac à sable): on tourne la
// pièce sur le FRONT montant "main ouverte -> poing", pas tant que le poing reste fermé.
export const FIST_ROTATE_REPEAT_BLOCK_MS = 400;

// Indices des landmarks (modèle MediaPipe Hands, 21 points).
export const LM = {
	WRIST: 0,
	INDEX_MCP: 5,
	INDEX_TIP: 8,
	MIDDLE_MCP: 9,
	MIDDLE_TIP: 12,
	RING_MCP: 13,
	RING_TIP: 16,
	PINKY_MCP: 17,
	PINKY_TIP: 20,
} as const;
