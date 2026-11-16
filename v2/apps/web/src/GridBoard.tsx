import type { PointerEvent, ReactNode, Ref } from 'react';
import { GRID_H, GRID_W, cellKey, getDef, type Cell, type StatBlock } from '@aquarium/engine';

export interface BoardItem {
  id: string;
  defId: string;
  cells: Cell[];
  /** Final stats to show. */
  stats: StatBlock;
  /** Base stats, used to colour buffed numbers. */
  base?: StatBlock;
  /** Battle only: remaining / max HP bar. */
  hp?: { now: number; max: number };
  className?: string;
  float?: { key: number; text: string; kind: 'dmg' | 'heal' };
}

export interface BoardGhost {
  cells: Cell[];
  valid: boolean;
  defId: string;
  stats?: StatBlock;
}

interface Props {
  items: BoardItem[];
  ghost?: BoardGhost | null;
  deltas?: Record<string, StatBlock>;
  innerRef?: Ref<HTMLDivElement>;
  className?: string;
  onCellDown?: (e: PointerEvent, item: BoardItem, cellIndex: number) => void;
  onEnter?: (item: BoardItem) => void;
  onLeave?: (item: BoardItem) => void;
  children?: ReactNode;
}

const cellStyle = (c: Cell) => ({
  left: `${(c.x * 100) / GRID_W}%`,
  top: `${(c.y * 100) / GRID_H}%`,
  width: `${100 / GRID_W}%`,
  height: `${100 / GRID_H}%`,
});

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function StatChips({ defId, stats, base }: { defId: string; stats: StatBlock; base?: StatBlock }) {
  const def = getDef(defId);
  if (def.type === 'consumable') return <span className="chips"><span className="chip">food</span></span>;
  const cls = (now: number, was?: number) => (was === undefined || now === was ? 'chip' : now > was ? 'chip up' : 'chip down');
  return (
    <span className="chips">
      {def.type === 'fish' && <span className={cls(stats.attack, base?.attack)}>⚔{stats.attack}</span>}
      <span className={cls(stats.health, base?.health)}>♥{stats.health}</span>
      {def.type === 'fish' && <span className={cls(stats.speed, base?.speed)}>⚡{stats.speed}</span>}
    </span>
  );
}

function DeltaChip({ delta }: { delta: StatBlock }) {
  const parts = [
    delta.attack ? `${signed(delta.attack)}⚔` : '',
    delta.health ? `${signed(delta.health)}♥` : '',
    delta.speed ? `${signed(delta.speed)}⚡` : '',
  ].filter(Boolean);
  const bad = delta.attack < 0 || delta.health < 0 || delta.speed < 0;
  return <span className={`delta ${bad ? 'bad' : ''}`}>{parts.join(' ')}</span>;
}

/** Renders pieces cell by cell so L-shapes and rotations look exactly like what the engine thinks they are. */
export function GridBoard({ items, ghost, deltas, innerRef, className, onCellDown, onEnter, onLeave, children }: Props) {
  return (
    <div className={`board ${className ?? ''}`}>
      <div className="board-inner" ref={innerRef}>
        {items.map((item) => {
          const def = getDef(item.defId);
          const own = new Set(item.cells.map((c) => cellKey(c.x, c.y)));
          return item.cells.map((c, i) => {
            const t = !own.has(cellKey(c.x, c.y - 1));
            const b = !own.has(cellKey(c.x, c.y + 1));
            const l = !own.has(cellKey(c.x - 1, c.y));
            const r = !own.has(cellKey(c.x + 1, c.y));
            const R = '18%';
            const radius = `${t && l ? R : 0} ${t && r ? R : 0} ${b && r ? R : 0} ${b && l ? R : 0}`;
            const edges = `${t ? 'et ' : ''}${b ? 'eb ' : ''}${l ? 'el ' : ''}${r ? 'er' : ''}`;
            return (
              <div
                key={`${item.id}:${i}`}
                data-piece={i === 0 ? item.id : undefined}
                className={`pc ${def.type} ${edges} ${i === 0 ? 'label-cell' : ''} ${item.className ?? ''}`}
                style={{ ...cellStyle(c), borderRadius: radius }}
                onPointerDown={onCellDown && ((e) => onCellDown(e, item, i))}
                onPointerEnter={onEnter && (() => onEnter(item))}
                onPointerLeave={onLeave && (() => onLeave(item))}
              >
                {i === 0 && (
                  <div className="pc-label">
                    <span className="pc-emoji">{def.emoji}</span>
                    <StatChips defId={item.defId} stats={item.stats} base={item.base} />
                    {item.hp && (
                      <span className="hpbar">
                        <span style={{ width: `${(item.hp.now / item.hp.max) * 100}%` }} />
                      </span>
                    )}
                    {deltas?.[item.id] && <DeltaChip delta={deltas[item.id]} />}
                    {item.float && (
                      <span key={item.float.key} className={`float ${item.float.kind}`}>
                        {item.float.text}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          });
        })}
        {ghost?.cells.map((c, i) => (
          <div key={`ghost:${i}`} className={`ghost-cell ${ghost.valid ? 'ok' : 'bad'}`} style={cellStyle(c)}>
            {i === 0 && (
              <div className="pc-label">
                <span className="pc-emoji">{getDef(ghost.defId).emoji}</span>
                {ghost.valid && ghost.stats && <StatChips defId={ghost.defId} stats={ghost.stats} base={getDef(ghost.defId).stats} />}
              </div>
            )}
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
