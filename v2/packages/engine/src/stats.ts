import { adjacencyMap, cellsOf } from './grid';
import { getDef } from './pieces';
import type { BoardComputed, BonusLine, Piece, PieceComputed, PieceDef, StatBlock, Tank } from './types';

export const WATER_MIN = 1;
export const WATER_MAX = 10;
export const WATER_GOOD = 8;
export const WATER_BAD = 3;

export function waterContribution(def: PieceDef): number {
  if (def.water !== undefined) return def.water;
  if (def.type === 'fish') return -1;
  if (def.type === 'plant') return 1;
  return 0;
}

export function waterQualityOf(tank: Tank): number {
  let quality = tank.baseWaterQuality;
  for (const piece of tank.pieces) {
    if (piece.pos) quality += waterContribution(getDef(piece.defId));
  }
  return Math.max(WATER_MIN, Math.min(WATER_MAX, quality));
}

export function waterMultiplier(quality: number): number {
  if (quality >= WATER_GOOD) return 1.3;
  if (quality <= WATER_BAD) return 0.7;
  return 1;
}

const zero = (): StatBlock => ({ attack: 0, health: 0, speed: 0 });

/**
 * The single source of truth for every number shown on the board and used in
 * battle. Returns base stats, final stats and an itemised list of bonuses for
 * every placed piece.
 */
export function computeBoard(tank: Tank): BoardComputed {
  const placed = tank.pieces.filter((p) => p.pos);
  const adj = adjacencyMap(placed);
  const byId = new Map(placed.map((p) => [p.id, p]));
  const neighborsOf = (p: Piece): Piece[] => [...(adj.get(p.id) ?? [])].map((id) => byId.get(id)!);

  // Rows that contain fish, for the Betta's "alone in its rows" check.
  const fishRows = new Map<number, Set<string>>();
  for (const p of placed) {
    if (getDef(p.defId).type !== 'fish') continue;
    for (const c of cellsOf(p)) {
      if (!fishRows.has(c.y)) fishRows.set(c.y, new Set());
      fishRows.get(c.y)!.add(p.id);
    }
  }

  const pieces: Record<string, PieceComputed> = {};
  for (const piece of placed) {
    const def = getDef(piece.defId);
    const neighbors = neighborsOf(piece);
    const bonuses: BonusLine[] = [];
    const hints: string[] = [];

    if (piece.perm.attack || piece.perm.health || piece.perm.speed) {
      bonuses.push({ source: 'Food eaten', ...piece.perm });
    }

    if (def.type === 'fish') {
      for (const n of neighbors) {
        const nd = getDef(n.defId);
        if (!nd.aura) continue;
        const aura = { ...zero(), ...nd.aura };
        let source = nd.name;
        if (nd.type === 'plant' && neighborsOf(n).some((x) => getDef(x.defId).traits.includes('filter'))) {
          if (aura.attack) aura.attack += 1;
          if (aura.health) aura.health += 1;
          if (aura.speed) aura.speed += 1;
          source = `${nd.name} (filtered)`;
        }
        bonuses.push({ source, sourceId: n.id, ...aura, pending: nd.type === 'consumable' || undefined });
      }

      const neighborDefs = neighbors.map((n) => getDef(n.defId));
      const adjacentFish = neighborDefs.filter((d) => d.type === 'fish').length;
      const adjacentPlants = neighborDefs.filter((d) => d.type === 'plant').length;

      if (def.school) {
        const school = neighborDefs.filter((d) => d.tags.includes('schooling')).length;
        const attack = school * (def.school.attackPer ?? 0);
        const health = school * (def.school.healthPer ?? 0);
        if (attack || health) bonuses.push({ source: `Schooling x${school}`, attack, health, speed: 0 });
        if (def.school.frenzyAt && school >= def.school.frenzyAt) {
          bonuses.push({ source: 'School frenzy', attack: 0, health: 0, speed: def.stats.speed });
        } else if (def.school.frenzyAt) {
          hints.push(`Double speed not active: ${school} of ${def.school.frenzyAt} schooling fish touching. It needs them on ${def.school.frenzyAt} of its 4 sides, so a straight line is never enough.`);
        }
      }
      if (def.traits.includes('loner-row')) {
        const alone = cellsOf(piece).every((c) => (fishRows.get(c.y)?.size ?? 0) <= 1);
        if (alone) bonuses.push({ source: 'Alone in its rows', attack: 2, health: 0, speed: 0 });
      }
      if (def.traits.includes('solitary') && neighbors.length === 0) {
        bonuses.push({ source: 'Solitary', attack: 3, health: 0, speed: 0 });
      }
      if (def.traits.includes('bully') && adjacentFish > 0) {
        bonuses.push({ source: `Bully x${adjacentFish}`, attack: adjacentFish, health: 0, speed: 0 });
      }
      if (def.traits.includes('algae-eater') && adjacentPlants > 0) {
        bonuses.push({ source: `Algae eater x${adjacentPlants}`, attack: 0, health: adjacentPlants, speed: 0 });
      }
    }

    const final = { ...def.stats };
    for (const b of bonuses) {
      final.attack += b.attack;
      final.health += b.health;
      final.speed += b.speed;
    }
    pieces[piece.id] = {
      id: piece.id,
      defId: piece.defId,
      base: { ...def.stats },
      final,
      bonuses,
      hints,
      neighbors: neighbors.map((n) => n.id),
    };
  }

  const waterQuality = waterQualityOf(tank);
  const totals = { attack: 0, health: 0, fish: 0 };
  for (const pc of Object.values(pieces)) {
    totals.health += pc.final.health;
    if (getDef(pc.defId).type === 'fish') {
      totals.attack += pc.final.attack;
      totals.fish += 1;
    }
  }

  return {
    pieces,
    waterQuality,
    waterMultiplier: waterMultiplier(waterQuality),
    poisoned: waterQuality <= WATER_BAD,
    totals,
  };
}
