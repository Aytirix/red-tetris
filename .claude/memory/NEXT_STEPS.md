---
name: Next Steps
description: Prioritized roadmap for Red Piece
type: project
---

# Next Steps — Red Piece

## Priority 1 — Core Tetris Game
- Complete `GamePage.tsx` with full Tetris rendering (Grid/Flexbox, no Canvas)
- Real-time multiplayer sync via Socket.io (game events)
- Handle game start, piece drop, line clear, game over

## Priority 2 — Multiplayer Flow
- Room lobby: player list, ready state, game start trigger
- Spectator boards showing other players' grids
- Garbage line mechanic (lines sent to opponents on clear)

## Priority 3 — Polish
- Score/leaderboard display
- Win/lose screens
- Sound effects (optional)

## Priority 4 — Tests
- Subject requires testing — no tests written yet
- Unit tests for game logic (piece rotation, collision, line clear)
- Integration tests for WS events

## Notes
- Backend game logic owned by teammate — coordinate before implementing multiplayer events
- Hand detection (MediaPipe webcam) already added — may need integration into game controls
