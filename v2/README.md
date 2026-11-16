# Aquarium Autobattle v2

A ground-up rewrite of the aquarium auto-battler. The original project (repo root) is kept as reference only.

## Run it

```bash
cd v2
npm install
npm run dev        # server on :3101, web on http://localhost:5173
```

Production: `npm run build && npm start` - the server then serves the built web app and the game socket from one port (`PORT`, default 3101).

```bash
npm test           # engine rules tests (vitest)
npm run typecheck  # all three packages
```

## Layout

| Path | What it is |
| --- | --- |
| `packages/engine` | Pure TypeScript rules: pieces, grid, stats, battle, economy, AI and the game reducer. No I/O, fully deterministic (seeded RNG). |
| `apps/server` | Authoritative game server (Node + Socket.IO). Owns every session, validates every action through the engine, saves sessions to `apps/server/data/sessions.json`. |
| `apps/web` | React + Vite client. Imports the same engine to draw the board and preview drops, but the server's state always wins. |

### One source of truth

Every number on the board comes from `computeBoard()` in `packages/engine/src/stats.ts`. The battle, the AI, the stat chips, the drop preview and the inspector's breakdown all call it, so what you see is what fights.

There is no stored grid array: occupancy is derived from each piece's `pos` + `rot`, so the grid and the piece list cannot disagree.

### Protocol

- Client connects with `auth: { playerId }` (a random id kept in `localStorage`, so a refresh resumes the run).
- Client emits `action` (see `Action` in `packages/engine/src/types.ts`); server replies with an ack and the new `state`.
- Actions without randomness (buy, place, bench, sell, lock) are predicted on the client for instant feedback. The RNG state never leaves the server.

## Rules

- **Tank**: 8x6 grid. Pieces can be rotated (`R`, right-click or scroll while dragging; `R` or the Rotate button on a selected piece).
- **Adjacency**: two pieces are adjacent when any of their cells share an **edge**. Corners do not count. A bonus applies once per source piece, however many cells touch.
- **Plants / heater**: give their aura to each adjacent fish. A plant next to a filter gives +1 on each stat it already buffs.
- **Food**: preview its bonus while placed; at battle start it is eaten and adjacent fish keep the bonus permanently. Food touching no fish returns to the bench.
- **Water quality** (1-10): starts at 6-8; fish -1, plants +1, filters +1/+3. At 8+ your fish deal +30% damage; at 3 or less they deal -30% and take 1 poison per turn.
- **Battle**: each turn every living fish attacks once, fastest first. Targets are random living enemy pieces (plants and equipment soak hits). A side loses when it has no living fish. After 30 turns the side with more fish HP wins.
- **Economy**: 10 starting gold; +5 per round, +1 for a win, win streak +1..4, loss streak +2..12, comeback bonus (2g per loss, max 10) for a win that ends a streak of 2+ losses, interest 1g per 10g banked (max 5). Reroll 2g (rising after the fifth each round). Selling returns 75% of what was paid.
- **Sales**: each shop roll has a 25% chance to put one item about a third off, rising by 10% per loss in the current losing streak (max 75%). Never more than one sale item at a time.
- **Opponents**: Schooler, Aggressor, Defender, Feeder, Gardener, Balanced, chosen (or randomised) in the New game dialog along with Easy / Normal / Hard. Difficulty changes the opponent's income (-2 / 0 / +2 per round) and how many shops it looks through; it never changes the rules of battle.
- **Campaign**: 15 rounds against one AI opponent with a personality (Schooler, Aggressor, Gardener or Balanced).

Piece abilities live in `packages/engine/src/pieces.ts`; each `Trait` is implemented in `stats.ts` or `battle.ts`, so card text never promises something the engine does not do.
