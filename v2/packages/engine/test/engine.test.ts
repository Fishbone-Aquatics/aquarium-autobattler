import { describe, expect, it } from 'vitest';
import {
  GRID_H, GRID_W, PIECES, adjacencyMap, applyAction, canPlace, cellsOf, computeBoard, getDef, interestFor,
  DIFFICULTIES, OPPONENTS, comebackBonus, priceOf, resaleOf, rollShop, saleChance, salePrice,
  lossStreakBonus, makeRng, newGame, parseAction, rerollCost, rotateShape, sellValue, simulateBattle,
  toClientView, uniqueRotations, winStreakBonus,
  type Action, type Cell, type GameState, type Piece, type Rot, type Tank,
} from '../src';

let n = 0;
const piece = (defId: string, x: number, y: number, rot: Rot = 0): Piece => ({
  id: `t${n++}`, defId, pos: { x, y }, rot, perm: { attack: 0, health: 0, speed: 0 },
});
const tank = (pieces: Piece[], baseWaterQuality = 7): Tank => ({ pieces, baseWaterQuality });
const stats = (t: Tank, p: Piece) => computeBoard(t).pieces[p.id].final;

describe('piece library', () => {
  it('has normalised shapes without duplicate cells', () => {
    for (const def of PIECES) {
      expect(Math.min(...def.shape.map((c) => c.x)), def.id).toBe(0);
      expect(Math.min(...def.shape.map((c) => c.y)), def.id).toBe(0);
      expect(new Set(def.shape.map((c) => `${c.x},${c.y}`)).size, def.id).toBe(def.shape.length);
      expect(def.text.length, def.id).toBeGreaterThan(0);
    }
  });
});

describe('grid', () => {
  it('rotates shapes clockwise, normalised and index preserving', () => {
    const bar: Cell[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    expect(rotateShape(bar, 1)).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }]);
    expect(rotateShape(bar, 2)).toEqual([{ x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]);
    const ell = getDef('angelfish').shape;
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const r = rotateShape(ell, rot);
      expect(r).toHaveLength(3);
      expect(Math.min(...r.map((c) => c.x))).toBe(0);
      expect(Math.min(...r.map((c) => c.y))).toBe(0);
    }
    expect(uniqueRotations(ell)).toHaveLength(4);
    expect(uniqueRotations(bar)).toHaveLength(2);
    expect(uniqueRotations(getDef('java-fern').shape)).toHaveLength(1);
  });

  it('rejects out of bounds and overlapping placements, but lets a piece overlap itself when moving', () => {
    const pike = piece('pike-cichlid', 0, 0);
    expect(canPlace([], 'pike-cichlid', { x: GRID_W - 3, y: GRID_H - 1 }, 0)).toBe(true);
    expect(canPlace([], 'pike-cichlid', { x: GRID_W - 2, y: 0 }, 0)).toBe(false);
    expect(canPlace([], 'pike-cichlid', { x: -1, y: 0 }, 0)).toBe(false);
    expect(canPlace([], 'pike-cichlid', { x: 0, y: GRID_H - 2 }, 1)).toBe(false);
    expect(canPlace([pike], 'neon-tetra', { x: 2, y: 0 }, 0)).toBe(false);
    expect(canPlace([pike], 'neon-tetra', { x: 3, y: 0 }, 0)).toBe(true);
    expect(canPlace([pike], 'pike-cichlid', { x: 1, y: 0 }, 0)).toBe(false);
    expect(canPlace([pike], 'pike-cichlid', { x: 1, y: 0 }, 0, pike.id)).toBe(true);
  });

  it('uses edge adjacency only - corners do not count', () => {
    const a = piece('neon-tetra', 0, 0);
    const diagonal = piece('neon-tetra', 1, 1);
    const edge = piece('neon-tetra', 1, 0);
    const adj = adjacencyMap([a, diagonal, edge]);
    expect([...adj.get(a.id)!]).toEqual([edge.id]);
    expect(adj.get(diagonal.id)!.has(a.id)).toBe(false);
    expect(adj.get(diagonal.id)!.has(edge.id)).toBe(true);
  });
});

describe('stats', () => {
  it('gives a multi-cell plant aura once, however many cells touch', () => {
    const fern = piece('java-fern', 0, 0); // 2x2
    const pleco = piece('bristlenose-pleco', 0, 2); // 2 wide, touches both bottom cells of the fern
    const t = tank([fern, pleco]);
    const pc = computeBoard(t).pieces[pleco.id];
    expect(pc.bonuses.filter((b) => b.sourceId === fern.id)).toHaveLength(1);
    // base 1/7 +1/+1 fern, +1 HP algae eater
    expect(pc.final).toMatchObject({ attack: 2, health: 9 });
  });

  it('does not buff fish that only touch a plant diagonally', () => {
    const fern = piece('java-fern', 0, 0);
    const neon = piece('neon-tetra', 2, 2);
    expect(stats(tank([fern, neon]), neon)).toEqual(getDef('neon-tetra').stats);
  });

  it('handles different sized pieces touching: L-shape against a bar', () => {
    const sword = piece('amazon-sword', 2, 0); // 1x3 column at x=2
    const angel = piece('angelfish', 0, 0); // cells (0,0) (0,1) (1,0) - (1,0) touches (2,0)
    const t = tank([sword, angel]);
    expect(stats(t, angel).attack).toBe(4 + 2); // sword aura, no solitary bonus
    const far = piece('angelfish', 5, 3);
    expect(stats(tank([sword, far]), far).attack).toBe(4 + 3); // solitary
  });

  it('applies schooling bonuses per adjacent schooling fish', () => {
    const mid = piece('neon-tetra', 1, 1);
    const others = [piece('neon-tetra', 0, 1), piece('cardinal-tetra', 2, 1), piece('corydoras', 1, 0)];
    const t = tank([mid, ...others]);
    expect(stats(t, mid)).toEqual({ attack: 2 + 3, health: 3, speed: 12 }); // frenzy doubles speed at 3
    expect(stats(t, others[1]).attack).toBe(3 + 2);
    expect(stats(t, others[2]).health).toBe(5 + 2);
  });

  it('gives the Betta +2 ATK only when no other fish shares its rows', () => {
    const betta = piece('betta', 0, 0); // rows 0 and 1
    expect(stats(tank([betta]), betta).attack).toBe(7);
    expect(stats(tank([betta, piece('neon-tetra', 7, 1)]), betta).attack).toBe(5);
    expect(stats(tank([betta, piece('neon-tetra', 7, 2)]), betta).attack).toBe(7);
    expect(stats(tank([betta, piece('moss-ball', 7, 1)]), betta).attack).toBe(7);
  });

  it('boosts plants next to a filter', () => {
    const fern = piece('java-fern', 1, 0);
    const neon = piece('neon-tetra', 0, 0);
    const filter = piece('basic-filter', 3, 0);
    expect(stats(tank([fern, neon]), neon)).toMatchObject({ attack: 3, health: 4 });
    expect(stats(tank([fern, neon, filter]), neon)).toMatchObject({ attack: 4, health: 5 });
  });

  it('computes water quality from placed pieces only', () => {
    const benched: Piece = { ...piece('neon-tetra', 0, 0), pos: null };
    const t = tank([piece('neon-tetra', 0, 0), piece('oscar', 2, 0), piece('bristlenose-pleco', 5, 0), piece('basic-filter', 7, 0), piece('moss-ball', 7, 2), benched], 7);
    expect(computeBoard(t).waterQuality).toBe(7 - 1 - 2 + 0 + 1 + 1);
    expect(computeBoard(tank([], 7)).waterMultiplier).toBe(1);
    expect(computeBoard(tank([piece('moss-ball', 0, 0)], 7)).waterMultiplier).toBe(1.3);
    const dirty = computeBoard(tank([piece('neon-tetra', 0, 0), piece('neon-tetra', 2, 0), piece('neon-tetra', 4, 0), piece('neon-tetra', 6, 0)], 6));
    expect(dirty.waterQuality).toBe(2);
    expect(dirty.poisoned).toBe(true);
    expect(dirty.waterMultiplier).toBe(0.7);
  });

  it('shows the same numbers the battle uses', () => {
    const t = tank([piece('java-fern', 0, 0), piece('neon-tetra', 2, 0), piece('neon-tetra', 2, 1)]);
    const report = simulateBattle(t, tank([piece('neon-tetra', 0, 0)]), makeRng(1));
    const board = computeBoard(t);
    for (const unit of report.units.filter((u) => u.side === 'player')) {
      expect(unit.attack).toBe(board.pieces[unit.id].final.attack);
      expect(unit.maxHealth).toBe(board.pieces[unit.id].final.health);
      expect(unit.speed).toBe(board.pieces[unit.id].final.speed);
    }
  });
});

describe('battle', () => {
  const army = () => tank([piece('neon-tetra', 0, 0), piece('neon-tetra', 1, 0), piece('betta', 4, 2), piece('java-fern', 6, 0)]);

  it('is deterministic for a seed and always terminates with a verdict', () => {
    const a = army();
    const b = army();
    const r1 = simulateBattle(a, b, makeRng(42));
    const r2 = simulateBattle(a, b, makeRng(42));
    expect(r1).toEqual(r2);
    expect(r1.events[r1.events.length - 1]).toMatchObject({ t: 'end', winner: r1.winner });
    expect(r1.turns).toBeLessThanOrEqual(30);
  });

  it('keeps HP in events consistent with damage dealt', () => {
    const report = simulateBattle(army(), army(), makeRng(7));
    const hp = new Map(report.units.map((u) => [u.id, u.maxHealth]));
    for (const e of report.events) {
      if (e.t === 'attack' || e.t === 'spines') {
        const next = Math.max(0, hp.get(e.target)! - e.dmg);
        expect(e.hp).toBe(next);
        expect(e.died).toBe(next === 0);
        hp.set(e.target, next);
      } else if (e.t === 'poison') {
        const next = Math.max(0, hp.get(e.id)! - e.dmg);
        expect(e.hp).toBe(next);
        hp.set(e.id, next);
      } else if (e.t === 'heal') {
        hp.set(e.id, hp.get(e.id)! + e.amount);
        expect(e.hp).toBe(hp.get(e.id));
      }
    }
  });

  it('a side with no fish loses; two such sides draw', () => {
    const plantsOnly = tank([piece('java-fern', 0, 0)]);
    expect(simulateBattle(army(), plantsOnly, makeRng(1)).winner).toBe('player');
    expect(simulateBattle(plantsOnly, army(), makeRng(1)).winner).toBe('opponent');
    expect(simulateBattle(plantsOnly, tank([]), makeRng(1)).winner).toBe('draw');
  });

  it('never lets dead fish attack and never targets dead pieces', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const report = simulateBattle(army(), army(), makeRng(seed));
      const dead = new Set<string>();
      for (const e of report.events) {
        if (e.t === 'attack') {
          expect(dead.has(e.id)).toBe(false);
          expect(dead.has(e.target)).toBe(false);
        }
        if ((e.t === 'attack' || e.t === 'spines') && e.died) dead.add(e.target);
        if (e.t === 'poison' && e.died) dead.add(e.id);
      }
    }
  });

  it('gives first strike on turn 1 and pricks attackers of a puffer', () => {
    const slow = tank([piece('betta', 0, 0)]);
    const fast = tank([piece('pufferfish', 0, 0), piece('basic-filter', 5, 5)]);
    const report = simulateBattle(slow, fast, makeRng(3));
    const first = report.events.find((e) => e.t === 'attack');
    expect(first && first.t === 'attack' && report.units.find((u) => u.id === first.id)!.defId).toBe('betta');
    const hitPuffer = report.events.findIndex((e) => e.t === 'attack' && report.units.find((u) => u.id === e.target)!.defId === 'pufferfish');
    if (hitPuffer >= 0) expect(report.events[hitPuffer + 1].t).toBe('spines');
  });
});

describe('economy', () => {
  it('matches the documented numbers', () => {
    expect([0, 9, 10, 35, 99].map(interestFor)).toEqual([0, 0, 1, 3, 5]);
    expect([0, 1, 2, 6, 9].map(lossStreakBonus)).toEqual([0, 2, 4, 12, 12]);
    expect([0, 1, 2, 3, 5, 8].map(winStreakBonus)).toEqual([0, 0, 1, 2, 4, 4]);
    expect([0, 4, 5, 6].map(rerollCost)).toEqual([2, 2, 3, 4]);
    expect([1, 2, 4, 8].map(sellValue)).toEqual([1, 1, 3, 6]);
    expect([0, 1, 2, 4, 9].map(comebackBonus)).toEqual([0, 0, 4, 8, 10]);
    expect([2, 3, 6, 12].map(salePrice)).toEqual([1, 2, 4, 8]);
    expect(saleChance(5)).toBeGreaterThan(saleChance(0));
  });

  it('puts items on sale, more often on a losing streak, and resells at what was paid', () => {
    const sales = (streak: number) => {
      const rng = makeRng(42);
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const count = rollShop(5, rng, [], streak).filter((item) => item?.sale !== undefined).length;
        expect(count).toBeLessThanOrEqual(1);
        n += count;
      }
      return n;
    };
    expect(sales(0)).toBeGreaterThan(0);
    expect(sales(5)).toBeGreaterThan(sales(0) * 2);
    const held = { defId: 'arowana', locked: true, sale: 8 };
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) expect(rollShop(5, rng, [held], 5).filter((item) => item?.sale !== undefined)).toEqual([held]);

    let s = newGame(3);
    s.shop[0] = { defId: 'arowana', locked: false, sale: 8 };
    s.gold = 8;
    expect(priceOf(s.shop[0]!)).toBe(8);
    s = applyAction(s, { type: 'buy', index: 0 });
    expect(s.gold).toBe(0);
    expect(resaleOf(s.player.pieces[0])).toBe(6); // 75% of the 8g paid, not of the 12g list price
    s = applyAction(s, { type: 'sell', id: s.player.pieces[0].id });
    expect(s.gold).toBe(6);
  });

  it('pays a victory bonus, and a comeback bonus for ending a losing streak', () => {
    let s = newGame(8);
    s.lossStreak = 4;
    s.opponent.pieces = [];
    s.shop[0] = { defId: 'neon-tetra', locked: false };
    s = applyAction(s, { type: 'buy', index: 0, pos: { x: 0, y: 0 } });
    s = applyAction(s, { type: 'startBattle' });
    expect(s.battle!.winner).toBe('player');
    expect(s.lossStreak).toBe(0);
    expect(s.rewards.map((r) => r.amount)).toEqual([5, 1, 8, 2]); // income, victory, comeback, interest on 22g
    expect(s.rewards[2].label).toMatch(/Comeback/);
  });
});

describe('opponents and difficulty', () => {
  it('lets the player choose the opponent and difficulty, and validates the choice', () => {
    for (const o of OPPONENTS) expect(newGame(1, { opponent: o.personality }).opponentInfo).toEqual(o);
    expect(OPPONENTS.map((o) => o.personality)).toEqual(expect.arrayContaining(['Aggressor', 'Defender', 'Gardener', 'Feeder']));
    const hard = newGame(1, { difficulty: 'hard' });
    expect(hard.difficulty).toBe('hard');
    expect(newGame(1).difficulty).toBe('normal');
    expect(() => parseAction({ type: 'newGame', opponent: 'Nobody' })).toThrow();
    expect(() => parseAction({ type: 'newGame', difficulty: 'impossible' })).toThrow();
    const next = applyAction(hard, parseAction({ type: 'newGame', opponent: 'Feeder' }));
    expect(next.opponentInfo.personality).toBe('Feeder');
    expect(next.difficulty).toBe('hard'); // carried over unless changed
  });

  it('always fields at least one fish in round 1', () => {
    for (const o of OPPONENTS) {
      for (const d of DIFFICULTIES) {
        for (let seed = 1; seed <= 25; seed++) {
          const s = newGame(seed, { opponent: o.personality, difficulty: d.id });
          expect(computeBoard(s.opponent).totals.fish, `${o.personality} ${d.id} seed ${seed}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never has the opponent stack decoys', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let s = newGame(seed, { opponent: 'Defender', difficulty: 'hard' });
      for (let round = 1; round < 8; round++) {
        s = applyAction(s, { type: 'startBattle', forfeit: true });
        s = applyAction(s, { type: 'nextRound' });
      }
      expect(s.opponent.pieces.filter((p) => p.defId === 'driftwood').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('game reducer', () => {
  const firstFishSlot = (s: GameState) => s.shop.findIndex((i) => i && getDef(i.defId).type === 'fish' && getDef(i.defId).cost <= s.gold);

  it('never mutates its input and validates actions', () => {
    const s = newGame(123);
    const snapshot = JSON.stringify(s);
    expect(() => applyAction(s, { type: 'startBattle' })).toThrow(/at least one fish/);
    expect(() => applyAction(s, { type: 'nextRound' })).toThrow();
    expect(() => applyAction(s, { type: 'place', id: 'nope', pos: { x: 0, y: 0 }, rot: 0 })).toThrow();
    applyAction(s, { type: 'reroll' });
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(() => parseAction({ type: 'buy', index: 99 })).toThrow();
    expect(() => parseAction({ type: 'place', id: 'x', pos: { x: 1.5, y: 0 }, rot: 0 })).toThrow();
    expect(() => parseAction({ type: 'hack' })).toThrow();
    expect(parseAction({ type: 'buy', index: 1, pos: { x: 1, y: 2 }, rot: 3, junk: 1 })).toEqual({ type: 'buy', index: 1, pos: { x: 1, y: 2 }, rot: 3 });
  });

  it('buys, places, moves, rotates, benches and sells', () => {
    let s = newGame(5);
    const index = s.shop.findIndex((i) => i && getDef(i.defId).cost <= s.gold);
    const def = getDef(s.shop[index]!.defId);
    s = applyAction(s, { type: 'buy', index });
    expect(s.gold).toBe(10 - def.cost);
    expect(s.shop[index]).toBeNull();
    const id = s.player.pieces[0].id;
    expect(s.player.pieces[0].pos).toBeNull();
    s = applyAction(s, { type: 'place', id, pos: { x: 2, y: 2 }, rot: 0 });
    s = applyAction(s, { type: 'place', id, pos: { x: 3, y: 2 }, rot: 1 });
    expect(s.player.pieces[0]).toMatchObject({ pos: { x: 3, y: 2 }, rot: 1 });
    expect(() => applyAction(s, { type: 'place', id, pos: { x: 99, y: 0 }, rot: 0 })).toThrow(/fit/);
    s = applyAction(s, { type: 'unplace', id });
    expect(s.player.pieces[0].pos).toBeNull();
    s = applyAction(s, { type: 'sell', id });
    expect(s.player.pieces).toHaveLength(0);
    expect(s.gold).toBe(10 - def.cost + sellValue(def.cost));
  });

  it('always offers at least one fish, and lets a fishless player forfeit the round', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = newGame(seed);
      expect(s.shop.some((i) => i && getDef(i.defId).type === 'fish'), `seed ${seed}`).toBe(true);
    }
    let s = newGame(11);
    expect(() => applyAction(s, { type: 'startBattle' })).toThrow();
    s = applyAction(s, parseAction({ type: 'startBattle', forfeit: true }));
    expect(s.phase).toBe('battle');
    expect(s.battle!.winner).not.toBe('player');
    s = applyAction(s, { type: 'nextRound' });
    expect(s.round).toBe(2);
    expect(s.gold).toBeGreaterThan(10);
  });

  it('keeps locked shop items through a reroll', () => {
    let s = newGame(9);
    s = applyAction(s, { type: 'lock', index: 2 });
    const locked = s.shop[2]!.defId;
    for (let i = 0; i < 3; i++) s = applyAction(s, { type: 'reroll' });
    expect(s.shop[2]).toEqual({ defId: locked, locked: true });
    expect(s.gold).toBe(10 - 6);
  });

  it('feeds food to adjacent fish permanently, exactly once', () => {
    let s = newGame(77);
    s.shop = [{ defId: 'neon-tetra', locked: false }, { defId: 'brine-shrimp', locked: false }, { defId: 'bloodworms', locked: false }, null, null, null];
    s = applyAction(s, { type: 'buy', index: 0, pos: { x: 0, y: 0 } });
    s = applyAction(s, { type: 'buy', index: 1, pos: { x: 1, y: 0 } });
    s = applyAction(s, { type: 'buy', index: 2, pos: { x: 5, y: 5 } }); // touches nothing
    const neon = s.player.pieces[0];
    const before = computeBoard(s.player).pieces[neon.id];
    expect(before.final.attack).toBe(3);
    expect(before.bonuses[0].pending).toBe(true);
    s = applyAction(s, { type: 'startBattle' });
    const unit = s.battle!.units.find((u) => u.id === neon.id)!;
    expect(unit.attack).toBe(3);
    expect(s.player.pieces.map((p) => p.defId).sort()).toEqual(['bloodworms', 'neon-tetra']);
    expect(s.player.pieces.find((p) => p.defId === 'bloodworms')!.pos).toBeNull();
    expect(s.player.pieces.find((p) => p.id === neon.id)!.perm).toEqual({ attack: 1, health: 0, speed: 0 });
    expect(computeBoard(s.player).pieces[neon.id].final.attack).toBe(3);
  });

  it('plays a full 15 round campaign with consistent bookkeeping', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let s = newGame(seed);
      const rng = makeRng(seed * 1000);
      while (s.phase !== 'gameover') {
        expect(s.phase).toBe('prep');
        // spend gold on anything that fits
        for (let guard = 0; guard < 40; guard++) {
          const index = s.shop.findIndex((i) => i && getDef(i.defId).cost <= s.gold);
          if (index < 0) break;
          const defId = s.shop[index]!.defId;
          const rot = rng.int(4) as Rot;
          const spots: Cell[] = [];
          for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (canPlace(s.player.pieces, defId, { x, y }, rot)) spots.push({ x, y });
          if (!spots.length) break;
          s = applyAction(s, { type: 'buy', index, pos: rng.pick(spots), rot });
        }
        if (computeBoard(s.player).totals.fish === 0) {
          // make sure we can always fight: reroll until a fish shows up
          while (firstFishSlot(s) < 0 && s.gold >= rerollCost(s.rerolls)) s = applyAction(s, { type: 'reroll' });
          const index = firstFishSlot(s);
          if (index >= 0) s = applyAction(s, { type: 'buy', index, pos: { x: 0, y: 0 } });
        }
        // no overlaps, everything in bounds
        const seen = new Set<string>();
        for (const p of [...s.player.pieces, ...s.opponent.pieces].filter((p) => p.pos)) {
          const owner = s.player.pieces.includes(p) ? 'P' : 'O';
          for (const c of cellsOf(p)) {
            const k = `${owner}${c.x},${c.y}`;
            expect(seen.has(k)).toBe(false);
            seen.add(k);
            expect(c.x >= 0 && c.x < GRID_W && c.y >= 0 && c.y < GRID_H).toBe(true);
          }
        }
        if (computeBoard(s.player).totals.fish === 0) break; // truly broke on turn 1 with no fish offered; fine
        const goldBefore = s.gold;
        s = applyAction(s, { type: 'startBattle' });
        expect(s.phase).toBe('battle');
        expect(s.battle).not.toBeNull();
        const expected = goldBefore + s.rewards.reduce((sum, r) => sum + r.amount, 0);
        const round = s.round;
        s = applyAction(s, { type: 'nextRound' });
        if (s.phase === 'prep') {
          expect(s.round).toBe(round + 1);
          expect(s.gold).toBe(expected);
        }
        expect(s.gold).toBe(s.goldLog.reduce((sum, e) => sum + e.amount, 0));
        expect(s.opponentGold).toBeGreaterThanOrEqual(0);
      }
      if (s.phase === 'gameover') {
        expect(s.wins + s.losses + s.draws).toBe(15);
        expect(s.history).toHaveLength(15);
      }
    }
  });

  it('hides the RNG from the client view, and client-side prediction matches the server for non-random actions', () => {
    const server = newGame(31);
    const client = toClientView(server);
    expect(client.rng).toBe(0);
    const index = server.shop.findIndex((i) => i && getDef(i.defId).cost <= server.gold);
    const action: Action = { type: 'buy', index, pos: { x: 0, y: 0 } };
    expect(applyAction(client, action)).toEqual(toClientView(applyAction(server, action)));
  });
});
