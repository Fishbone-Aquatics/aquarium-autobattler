import { getDef } from './pieces';
import type { Cell, Piece, Rot } from './types';

export const GRID_W = 8;
export const GRID_H = 6;

export const cellKey = (x: number, y: number) => `${x},${y}`;

/**
 * Rotate a shape clockwise by `rot` quarter turns and normalise it so the
 * bounding box starts at 0,0. Cell order is preserved, so index i of the
 * result is the same physical cell as index i of the input.
 */
export function rotateShape(shape: readonly Cell[], rot: Rot): Cell[] {
  let cells = shape.map((c) => ({ x: c.x, y: c.y }));
  for (let i = 0; i < rot; i++) cells = cells.map((c) => ({ x: -c.y, y: c.x }));
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => ({ x: c.x - minX + 0, y: c.y - minY + 0 }));
}

/** Rotations that produce visibly different shapes (a 1x1 has one, a 2x2 has one, a bar has two...). */
export function uniqueRotations(shape: readonly Cell[]): Rot[] {
  const seen = new Set<string>();
  const out: Rot[] = [];
  for (const rot of [0, 1, 2, 3] as Rot[]) {
    const sig = rotateShape(shape, rot)
      .map((c) => cellKey(c.x, c.y))
      .sort()
      .join('|');
    if (!seen.has(sig)) {
      seen.add(sig);
      out.push(rot);
    }
  }
  return out;
}

export function shapeCells(defId: string, pos: Cell, rot: Rot): Cell[] {
  return rotateShape(getDef(defId).shape, rot).map((c) => ({ x: pos.x + c.x, y: pos.y + c.y }));
}

export function cellsOf(piece: Piece): Cell[] {
  return piece.pos ? shapeCells(piece.defId, piece.pos, piece.rot) : [];
}

/** Map of occupied cell -> piece id, derived from the pieces (there is no separately stored grid to drift out of sync). */
export function occupancy(pieces: readonly Piece[], ignoreId?: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const piece of pieces) {
    if (piece.id === ignoreId) continue;
    for (const c of cellsOf(piece)) map.set(cellKey(c.x, c.y), piece.id);
  }
  return map;
}

export function inBounds(c: Cell): boolean {
  return Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < GRID_W && c.y < GRID_H;
}

/** Can a piece of `defId` sit at pos/rot? `ignoreId` is the piece being moved, so it never collides with itself. */
export function canPlace(pieces: readonly Piece[], defId: string, pos: Cell, rot: Rot, ignoreId?: string): boolean {
  const occ = occupancy(pieces, ignoreId);
  return shapeCells(defId, pos, rot).every((c) => inBounds(c) && !occ.has(cellKey(c.x, c.y)));
}

const EDGES: Cell[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Edge adjacency between placed pieces. Two pieces are adjacent when any of
 * their cells share an edge; corners do not count. Each neighbour appears once
 * no matter how many cells touch.
 */
export function adjacencyMap(pieces: readonly Piece[]): Map<string, Set<string>> {
  const occ = occupancy(pieces);
  const adj = new Map<string, Set<string>>();
  for (const piece of pieces) {
    if (!piece.pos) continue;
    const set = new Set<string>();
    for (const c of cellsOf(piece)) {
      for (const d of EDGES) {
        const other = occ.get(cellKey(c.x + d.x, c.y + d.y));
        if (other && other !== piece.id) set.add(other);
      }
    }
    adj.set(piece.id, set);
  }
  return adj;
}
