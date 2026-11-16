import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  BENCH_MAX, GRID_H, GRID_W, canPlace, cellsOf, computeBoard, difficultyInfo, getDef, priceOf, rerollCost, resaleOf, rotateShape, shapeCells,
  type BoardComputed, type Cell, type GameState, type Piece, type Rot, type StatBlock, type Tank,
} from '@aquarium/engine';
import { GridBoard, StatChips, type BoardGhost, type BoardItem } from './GridBoard';
import type { Dispatch } from './net';
import { PieceDetails, ShapeIcon, WaterMeter } from './ui';

type DragSource = { kind: 'shop'; index: number } | { kind: 'piece'; id: string };
type Zone = 'board' | 'bench' | 'sell' | null;

interface Drag {
  src: DragSource;
  defId: string;
  rot: Rot;
  /** Index of the shape cell under the pointer, so the piece stays "held" where it was grabbed. */
  grab: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  /** False until the pointer has moved a few pixels; a press without movement is a click. */
  active: boolean;
  zone: Zone;
  /** Where the piece's origin would land on the board. */
  cell: Cell | null;
  cellPx: number;
}

type Focus = { kind: 'piece'; id: string } | { kind: 'shop'; index: number };

const GHOST_ID = '__ghost';
const DRAG_THRESHOLD = 5;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function tankItems(tank: Tank, board: BoardComputed, classFor?: (p: Piece) => string): BoardItem[] {
  return tank.pieces
    .filter((p) => p.pos)
    .map((p) => ({
      id: p.id,
      defId: p.defId,
      cells: cellsOf(p),
      stats: board.pieces[p.id].final,
      base: board.pieces[p.id].base,
      className: classFor?.(p),
    }));
}

/** What would happen if the dragged piece were dropped right now. */
function evaluateDrop(state: GameState, drag: Drag) {
  if (drag.zone !== 'board' || !drag.cell) return null;
  const ignore = drag.src.kind === 'piece' ? drag.src.id : undefined;
  const fits = canPlace(state.player.pieces, drag.defId, drag.cell, drag.rot, ignore);
  const shopItem = drag.src.kind === 'shop' ? state.shop[drag.src.index] : null;
  const affordable = drag.src.kind === 'piece' || (!!shopItem && state.gold >= priceOf(shopItem));
  return { valid: fits && affordable, fits, affordable, cells: shapeCells(drag.defId, drag.cell, drag.rot) };
}

export function Prep({ state, dispatch, notify }: { state: GameState; dispatch: Dispatch; notify: (text: string) => void }) {
  const board = useMemo(() => computeBoard(state.player), [state.player]);
  const opponentBoard = useMemo(() => computeBoard(state.opponent), [state.opponent]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Focus | null>(null);
  const [hovered, setHovered] = useState<Focus | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  /** The opponent's tank is tucked away until asked for. */
  const [scouting, setScouting] = useState(false);
  const [scoutPiece, setScoutPiece] = useState<string | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const setDrag = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  /** Work out which drop zone the pointer is over and, on the board, which origin cell the piece snaps to. */
  const locate = useCallback((d: Drag): Drag => {
    const el = boardRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const cellPx = rect.width / GRID_W;
      if (d.x >= rect.left && d.x < rect.right && d.y >= rect.top && d.y < rect.bottom) {
        const shape = rotateShape(getDef(d.defId).shape, d.rot);
        const w = Math.max(...shape.map((c) => c.x)) + 1;
        const h = Math.max(...shape.map((c) => c.y)) + 1;
        const px = clamp(Math.floor((d.x - rect.left) / cellPx), 0, GRID_W - 1);
        const py = clamp(Math.floor((d.y - rect.top) / (rect.height / GRID_H)), 0, GRID_H - 1);
        const g = shape[d.grab] ?? shape[0];
        // Keep the grabbed cell under the pointer, but never let the piece hang off the board.
        const cell = { x: clamp(px - g.x, 0, GRID_W - w), y: clamp(py - g.y, 0, GRID_H - h) };
        return { ...d, zone: 'board', cell, cellPx };
      }
      const zone = (document.elementFromPoint(d.x, d.y)?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop as Zone | undefined;
      return { ...d, zone: zone ?? null, cell: null, cellPx };
    }
    return { ...d, zone: null, cell: null };
  }, []);

  const startDrag = (e: ReactPointerEvent, src: DragSource, defId: string, rot: Rot, grab: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDrag({ src, defId, rot, grab, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, active: false, zone: null, cell: null, cellPx: 48 });
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const rotate = () => {
      const d = dragRef.current;
      if (d?.active) setDrag(locate({ ...d, rot: ((d.rot + 1) % 4) as Rot }));
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const active = d.active || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >= DRAG_THRESHOLD;
      setDrag(locate({ ...d, x: e.clientX, y: e.clientY, active }));
    };
    const onUp = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      const s = stateRef.current;
      if (!d.active) {
        setSelected(d.src.kind === 'piece' ? { kind: 'piece', id: d.src.id } : { kind: 'shop', index: d.src.index });
        return;
      }
      const drop = evaluateDrop(s, d);
      if (drop && d.cell) {
        if (!drop.fits) return;
        if (!drop.affordable) return notify('Not enough gold');
        if (d.src.kind === 'shop') dispatch({ type: 'buy', index: d.src.index, pos: d.cell, rot: d.rot });
        else dispatch({ type: 'place', id: d.src.id, pos: d.cell, rot: d.rot });
      } else if (d.zone === 'bench') {
        if (d.src.kind === 'shop') dispatch({ type: 'buy', index: d.src.index });
        else if (s.player.pieces.find((p) => p.id === (d.src as { id: string }).id)?.pos) dispatch({ type: 'unplace', id: d.src.id });
      } else if (d.zone === 'sell' && d.src.kind === 'piece') {
        dispatch({ type: 'sell', id: d.src.id });
        setSelected(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotate();
      if (e.key === 'Escape') setDrag(null);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      rotate();
    };
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      // Trackpads fire a stream of wheel events; rotate at most once per gesture tick.
      if (e.timeStamp - lastWheel < 180) return;
      lastWheel = e.timeStamp;
      rotate();
    };
    const onCancel = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('contextmenu', onContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [dragging, dispatch, locate, notify, setDrag]);

  const selectedPiece = selected?.kind === 'piece' ? state.player.pieces.find((p) => p.id === selected.id) : undefined;

  const rotateInPlace = useCallback(
    (piece: Piece) => {
      if (!piece.pos) return;
      for (let step = 1; step <= 3; step++) {
        const rot = ((piece.rot + step) % 4) as Rot;
        if (canPlace(stateRef.current.player.pieces, piece.defId, piece.pos, rot, piece.id)) {
          dispatch({ type: 'place', id: piece.id, pos: piece.pos, rot });
          return;
        }
      }
      notify('No room to rotate here');
    },
    [dispatch, notify],
  );

  useEffect(() => {
    if (!scouting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScouting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scouting]);

  // R rotates the selected piece in place when nothing is being dragged.
  useEffect(() => {
    if (dragging || scouting || !selectedPiece?.pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') rotateInPlace(selectedPiece);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dragging, scouting, selectedPiece, rotateInPlace]);

  // ---- Live preview of the drop: ghost cells, the dragged piece's would-be stats, and deltas on its neighbours ----
  const preview = useMemo(() => {
    if (!drag?.active) return null;
    const drop = evaluateDrop(state, drag);
    if (!drop || !drag.cell) return null;
    const ghost: BoardGhost = { cells: drop.cells, valid: drop.valid, defId: drag.defId };
    if (!drop.valid) return { ghost, deltas: {}, water: undefined };
    const movingId = drag.src.kind === 'piece' ? drag.src.id : GHOST_ID;
    const pieces: Piece[] =
      drag.src.kind === 'piece'
        ? state.player.pieces.map((p) => (p.id === movingId ? { ...p, pos: drag.cell, rot: drag.rot } : p))
        : [...state.player.pieces, { id: GHOST_ID, defId: drag.defId, pos: drag.cell, rot: drag.rot, perm: { attack: 0, health: 0, speed: 0 } }];
    const after = computeBoard({ ...state.player, pieces });
    ghost.stats = after.pieces[movingId]?.final;
    const deltas: Record<string, StatBlock> = {};
    for (const [id, pc] of Object.entries(after.pieces)) {
      const before = board.pieces[id];
      if (id === movingId || !before) continue;
      const d = { attack: pc.final.attack - before.final.attack, health: pc.final.health - before.final.health, speed: pc.final.speed - before.final.speed };
      if (d.attack || d.health || d.speed) deltas[id] = d;
    }
    return { ghost, deltas, water: after.waterQuality };
  }, [drag, state, board]);

  // ---- Focus (hover wins over selection) drives the inspector and the "who buffs whom" highlights ----
  const focus = drag?.active ? null : (hovered ?? selected);
  const focusComputed = focus?.kind === 'piece' ? board.pieces[focus.id] : undefined;
  const givers = new Set(focusComputed?.bonuses.map((b) => b.sourceId).filter(Boolean) as string[]);
  const receivers = new Set(
    focus?.kind === 'piece' ? Object.values(board.pieces).filter((pc) => pc.bonuses.some((b) => b.sourceId === focus.id)).map((pc) => pc.id) : [],
  );
  const draggedId = drag?.active && drag.src.kind === 'piece' ? drag.src.id : null;

  const items = tankItems(state.player, board, (p) =>
    [
      p.id === draggedId ? 'lifted' : '',
      selected?.kind === 'piece' && selected.id === p.id ? 'selected' : '',
      focus?.kind === 'piece' && focus.id === p.id ? 'focus' : '',
      givers.has(p.id) ? 'gives' : '',
      receivers.has(p.id) ? 'receives' : '',
      'draggable',
    ].join(' '),
  );
  const opponentCount = Object.keys(opponentBoard.pieces).length;

  const bench = state.player.pieces.filter((p) => !p.pos);
  const reroll = rerollCost(state.rerolls);
  const canFight = board.totals.fish > 0;
  const dragDef = drag?.active ? getDef(drag.defId) : null;
  const draggedPiece = draggedId ? state.player.pieces.find((p) => p.id === draggedId) : undefined;
  const finalRound = state.round >= state.maxRounds;

  let inspector = <div className="details empty">Hover or tap a piece to see exactly where its stats come from.</div>;
  if (focus?.kind === 'piece') {
    const piece = state.player.pieces.find((p) => p.id === focus.id);
    if (piece) inspector = <PieceDetails defId={piece.defId} computed={board.pieces[piece.id]} note={piece.pos ? undefined : 'On the bench - drag it into the tank.'} />;
  } else if (focus?.kind === 'shop') {
    const item = state.shop[focus.index];
    if (item) inspector = <PieceDetails defId={item.defId} />;
  }
  const scouted = state.opponent.pieces.find((p) => p.id === scoutPiece && p.pos);

  return (
    <div className={`prep ${drag?.active ? 'is-dragging' : ''}`}>
      <section className="panel tank-panel">
        <div className="panel-head">
          <h2>Your tank</h2>
          <div className="totals">
            <span title="Total attack of your fish">⚔ {board.totals.attack}</span>
            <span title="Total health of everything in the tank">♥ {board.totals.health}</span>
            <span title="Fish in the tank">🐟 {board.totals.fish}</span>
          </div>
        </div>
        {finalRound && (
          <div className="final-banner">
            <b>🏁 Final round</b> Gold is worth nothing after this battle, so spend all of it.
          </div>
        )}
        <WaterMeter board={board} next={preview?.water} />
        <GridBoard
          items={items}
          ghost={preview?.ghost}
          deltas={preview?.deltas}
          innerRef={boardRef}
          className="main-board"
          onCellDown={(e, item, cellIndex) => {
            const piece = state.player.pieces.find((p) => p.id === item.id);
            if (piece) startDrag(e, { kind: 'piece', id: piece.id }, piece.defId, piece.rot, cellIndex);
          }}
          onEnter={(item) => setHovered({ kind: 'piece', id: item.id })}
          onLeave={() => setHovered(null)}
        />
        <div className="hint">Drag pieces to place them · <kbd>R</kbd>, right-click or scroll to rotate · bonuses apply to pieces that share an edge</div>

        <div className="bench-row">
          <div className="bench" data-drop="bench">
            <div className="bench-title">
              <b>📦 Bench</b> {bench.length}/{BENCH_MAX} · spare pieces wait here and do not fight
            </div>
            <div className="bench-items">
              {bench.map((p) => {
                const def = getDef(p.defId);
                return (
                  <div
                    key={p.id}
                    className={`bench-item ${def.type} ${selected?.kind === 'piece' && selected.id === p.id ? 'selected' : ''} ${draggedId === p.id ? 'lifted' : ''}`}
                    onPointerDown={(e) => startDrag(e, { kind: 'piece', id: p.id }, p.defId, p.rot, 0)}
                    onPointerEnter={() => setHovered({ kind: 'piece', id: p.id })}
                    onPointerLeave={() => setHovered(null)}
                  >
                    <span className="bench-emoji">{def.emoji}</span>
                    <ShapeIcon defId={p.defId} rot={p.rot} size={7} />
                  </div>
                );
              })}
              {Array.from({ length: BENCH_MAX - bench.length }, (_, i) => (
                <span key={i} className="bench-slot" />
              ))}
            </div>
          </div>
          <div className={`sell ${drag?.active && drag.src.kind === 'piece' ? 'armed' : ''} ${drag?.zone === 'sell' ? 'over' : ''}`} data-drop="sell">
            <span className="sell-icon">💰</span>
            <span>{draggedPiece ? `Sell +${resaleOf(draggedPiece)}g` : 'Drag here to sell'}</span>
          </div>
        </div>

        {board.poisoned && board.totals.fish > 0 && (
          <div className="toxic-warning">
            ☠ <b>Toxic water.</b> Your fish will deal 30% less damage and lose 1 HP every turn. Add a plant or filter, or bench a fish.
          </div>
        )}
        <button className="fight" disabled={!canFight} onClick={() => dispatch({ type: 'startBattle' })}>
          {!canFight ? 'Place a fish to battle' : finalRound ? '🏁 Start the final battle' : `⚔ Start battle - round ${state.round}`}
        </button>
        {!canFight && (
          <button
            className="link forfeit"
            onClick={() => {
              if (window.confirm('Forfeit this round? It counts as a loss, but you still collect your income.')) dispatch({ type: 'startBattle', forfeit: true });
            }}
          >
            No fish and no gold? Forfeit this round
          </button>
        )}
      </section>

      <aside className="side">
        <section className="panel shop-panel">
          <div className="panel-head">
            <h2>Shop</h2>
            <button className="reroll" disabled={state.gold < reroll} onClick={() => dispatch({ type: 'reroll' })}>
              🔄 Reroll {reroll}g
            </button>
          </div>
          <div className="shop">
            {state.shop.map((item, index) => {
              if (!item) return <div key={index} className="card sold">Sold</div>;
              const def = getDef(item.defId);
              const price = priceOf(item);
              const onSale = item.sale !== undefined;
              const affordable = state.gold >= price;
              return (
                <div
                  key={index}
                  className={`card ${def.type} ${affordable ? '' : 'poor'} ${item.locked ? 'locked' : ''} ${onSale ? 'sale' : ''} ${selected?.kind === 'shop' && selected.index === index ? 'selected' : ''}`}
                  onPointerDown={(e) => startDrag(e, { kind: 'shop', index }, def.id, 0, 0)}
                  onPointerEnter={() => setHovered({ kind: 'shop', index })}
                  onPointerLeave={() => setHovered(null)}
                  onDoubleClick={() => dispatch({ type: 'buy', index })}
                >
                  <div className="card-top">
                    <span className={`gem ${def.rarity}`} title={def.rarity} />
                    {item.locked && <span className="card-tag held">Locked</span>}
                    {onSale && !item.locked && <span className="card-tag">Sale</span>}
                    <span className="card-cost">
                      {onSale && <s>{def.cost}g</s>} {price}g
                    </span>
                  </div>
                  <div className="card-emoji">{def.emoji}</div>
                  <div className="card-name">{def.name}</div>
                  <div className="card-mid">
                    <StatChips defId={def.id} stats={def.stats} />
                    <ShapeIcon defId={def.id} size={8} />
                  </div>
                  <div className="card-text">{def.text[0]}</div>
                  <div className="card-actions" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <button disabled={!affordable} onClick={() => dispatch({ type: 'buy', index })} title="Buy it and put it on your bench">
                      Buy
                    </button>
                    <button className={item.locked ? 'on' : ''} onClick={() => dispatch({ type: 'lock', index })} title={item.locked ? 'Locked: stays in the shop through rerolls and into next round. Click to unlock.' : 'Lock: keep this item through rerolls and into next round'}>
                      {item.locked ? '🔒' : '🔓'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel inspector">
          {inspector}
          {selectedPiece && (!hovered || (hovered.kind === 'piece' && hovered.id === selectedPiece.id)) && (
            <div className="inspector-actions">
              {selectedPiece.pos && <button onClick={() => rotateInPlace(selectedPiece)}>⟳ Rotate</button>}
              {selectedPiece.pos && <button onClick={() => dispatch({ type: 'unplace', id: selectedPiece.id })}>To bench</button>}
              <button
                className="danger"
                onClick={() => {
                  dispatch({ type: 'sell', id: selectedPiece.id });
                  setSelected(null);
                }}
              >
                Sell +{resaleOf(selectedPiece)}g
              </button>
            </div>
          )}
        </section>

        <section className="panel opponent-panel">
          <div className="opponent-summary">
            <div>
              <div className="eyebrow">Next opponent · {difficultyInfo(state.difficulty).name}</div>
              <h2>
                {state.opponentInfo.emoji} {state.opponentInfo.name} <small>the {state.opponentInfo.personality}</small>
              </h2>
            </div>
            <button onClick={() => setScouting(true)}>🔍 Scout their tank</button>
          </div>
        </section>
      </aside>

      {scouting && (
        <div className="overlay" onClick={() => setScouting(false)}>
          <div className="panel scout" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <div>
                <div className="eyebrow">Scouting · the tank you fight in round {state.round}</div>
                <h2>
                  {state.opponentInfo.emoji} {state.opponentInfo.name} <small>the {state.opponentInfo.personality}</small>
                </h2>
              </div>
              <button className="ghost-btn" onClick={() => setScouting(false)}>
                Close
              </button>
            </div>
            <div className="scout-meta">
              <span className="opponent-blurb">{state.opponentInfo.blurb}</span>
              <div className="totals">
                <span title="Total attack of their fish">⚔ {opponentBoard.totals.attack}</span>
                <span title="Total health of everything in their tank">♥ {opponentBoard.totals.health}</span>
                <span title="Their fish">🐟 {opponentBoard.totals.fish}</span>
                <span title="Their water quality">💧 {opponentBoard.waterQuality}/10</span>
              </div>
            </div>
            <div className="scout-body">
              <GridBoard
                items={tankItems(state.opponent, opponentBoard, (p) => (p.id === scoutPiece ? 'focus' : ''))}
                className="enemy"
                onEnter={(item) => setScoutPiece(item.id)}
                onCellDown={(_, item) => setScoutPiece(item.id)}
              />
              <div className="scout-details">
                {scouted ? (
                  <PieceDetails defId={scouted.defId} computed={opponentBoard.pieces[scouted.id]} />
                ) : (
                  <div className="details empty">{opponentCount ? 'Hover or tap a piece for its details.' : 'Their tank is empty this round.'}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {drag?.active && dragDef && drag.zone !== 'board' && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {(() => {
            const shape = rotateShape(dragDef.shape, drag.rot);
            const g = shape[drag.grab] ?? shape[0];
            const size = drag.cellPx;
            return shape.map((c, i) => (
              <span
                key={i}
                className={`pc ${dragDef.type} et eb el er`}
                style={{ left: (c.x - g.x - 0.5) * size, top: (c.y - g.y - 0.5) * size, width: size, height: size, fontSize: size * 0.45 }}
              >
                {i === 0 && dragDef.emoji}
              </span>
            ));
          })()}
        </div>
      )}
    </div>
  );
}
