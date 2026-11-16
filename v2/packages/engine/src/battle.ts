import { cellsOf } from './grid';
import { getDef } from './pieces';
import type { Rng } from './rng';
import { computeBoard } from './stats';
import type { BattleEvent, BattleReport, BattleUnit, BattleWinner, PieceDef, Side, Tank } from './types';

export const MAX_TURNS = 30;
export const POISON_DAMAGE = 1;
export const SPINES_DAMAGE = 2;
export const PREDATOR_HEAL = 2;

interface Live {
  unit: BattleUnit;
  def: PieceDef;
  hp: number;
}

function buildUnits(tank: Tank, side: Side): BattleUnit[] {
  const board = computeBoard(tank);
  return tank.pieces
    .filter((p) => p.pos && getDef(p.defId).type !== 'consumable')
    .map((p) => {
      const stats = board.pieces[p.id].final;
      return {
        id: p.id,
        side,
        defId: p.defId,
        cells: cellsOf(p),
        attack: stats.attack,
        maxHealth: Math.max(1, stats.health),
        speed: stats.speed,
      };
    });
}

/**
 * Resolve a whole battle up front. The result is a list of events the client
 * replays; nothing here mutates the tanks.
 *
 * Rules: each turn every living fish attacks once, fastest first. Targets are
 * random living enemy pieces (plants and equipment soak hits). A side loses
 * when it has no living fish.
 */
export function simulateBattle(player: Tank, opponent: Tank, rng: Rng): BattleReport {
  const boards = { player: computeBoard(player), opponent: computeBoard(opponent) };
  const water = {
    player: { quality: boards.player.waterQuality, multiplier: boards.player.waterMultiplier },
    opponent: { quality: boards.opponent.waterQuality, multiplier: boards.opponent.waterMultiplier },
  };
  const units = [...buildUnits(player, 'player'), ...buildUnits(opponent, 'opponent')];
  const live = new Map<string, Live>(units.map((u) => [u.id, { unit: u, def: getDef(u.defId), hp: u.maxHealth }]));
  const events: BattleEvent[] = [];

  const label = (l: Live) => `${l.unit.side === 'player' ? 'Your' : 'Enemy'} ${l.def.name}`;
  const living = (side: Side) => [...live.values()].filter((l) => l.unit.side === side && l.hp > 0);
  const livingFish = (side: Side) => living(side).filter((l) => l.def.type === 'fish');
  const other = (side: Side): Side => (side === 'player' ? 'opponent' : 'player');
  const hit = (target: Live, dmg: number) => {
    target.hp = Math.max(0, target.hp - dmg);
    return target.hp === 0;
  };
  const verdict = (): BattleWinner | null => {
    const p = livingFish('player').length;
    const o = livingFish('opponent').length;
    if (!p && !o) return 'draw';
    if (!p) return 'opponent';
    if (!o) return 'player';
    return null;
  };

  let winner = verdict();
  let turn = 0;

  while (!winner && turn < MAX_TURNS) {
    turn++;
    events.push({ t: 'turn', turn, text: `Turn ${turn}` });

    for (const side of ['player', 'opponent'] as Side[]) {
      if (!boards[side].poisoned) continue;
      for (const fish of livingFish(side)) {
        const died = hit(fish, POISON_DAMAGE);
        events.push({
          t: 'poison', id: fish.unit.id, dmg: POISON_DAMAGE, hp: fish.hp, died,
          text: `${label(fish)} takes ${POISON_DAMAGE} poison damage from toxic water${died ? ' and is KO\'d' : ''}`,
        });
      }
    }
    winner = verdict();
    if (winner) break;

    const order = [...livingFish('player'), ...livingFish('opponent')]
      .map((l) => ({
        l,
        first: turn === 1 && l.def.traits.includes('first-strike') ? 1 : 0,
        tie: rng.next(),
      }))
      .sort((a, b) => b.first - a.first || b.l.unit.speed - a.l.unit.speed || a.tie - b.tie)
      .map((o) => o.l);

    for (const attacker of order) {
      if (attacker.hp <= 0) continue;
      const enemySide = other(attacker.unit.side);
      const enemies = living(enemySide);
      const enemyFish = enemies.filter((l) => l.def.type === 'fish');
      if (enemyFish.length === 0) break;

      const target = attacker.def.traits.includes('hunter')
        ? enemyFish.reduce((weakest, l) => (l.hp < weakest.hp ? l : weakest))
        : rng.weighted(enemies, (l) => (l.def.traits.includes('decoy') ? 2 : 1));

      const mult = water[attacker.unit.side].multiplier;
      const dmg = Math.max(1, Math.floor(attacker.unit.attack * mult));
      const died = hit(target, dmg);
      const firstStrike = turn === 1 && attacker.def.traits.includes('first-strike');
      const speedNote = firstStrike ? 'first strike' : `speed ${attacker.unit.speed}`;
      const waterNote = mult > 1 ? ' (clean water +30%)' : mult < 1 ? ' (toxic water -30%)' : '';
      events.push({
        t: 'attack', id: attacker.unit.id, target: target.unit.id, dmg, hp: target.hp, died,
        text: `${label(attacker)} (${speedNote}) hits ${label(target)} for ${dmg}${waterNote}${died ? ' - KO!' : ''}`,
      });

      if (target.def.traits.includes('spines')) {
        const attackerDied = hit(attacker, SPINES_DAMAGE);
        events.push({
          t: 'spines', id: target.unit.id, target: attacker.unit.id, dmg: SPINES_DAMAGE, hp: attacker.hp, died: attackerDied,
          text: `${label(attacker)} is pricked for ${SPINES_DAMAGE}${attackerDied ? ' - KO!' : ''}`,
        });
      }

      if (
        died && attacker.hp > 0 && attacker.def.traits.includes('predator') &&
        target.def.type === 'fish' && target.unit.cells.length < attacker.unit.cells.length
      ) {
        const amount = Math.min(PREDATOR_HEAL, attacker.unit.maxHealth - attacker.hp);
        if (amount > 0) {
          attacker.hp += amount;
          events.push({ t: 'heal', id: attacker.unit.id, amount, hp: attacker.hp, text: `${label(attacker)} feeds and heals ${amount}` });
        }
      }

      winner = verdict();
      if (winner) break;
    }
  }

  if (!winner) {
    const hp = (side: Side) => livingFish(side).reduce((sum, l) => sum + l.hp, 0);
    const p = hp('player');
    const o = hp('opponent');
    winner = p > o ? 'player' : o > p ? 'opponent' : 'draw';
  }

  const text = winner === 'draw' ? 'The battle is a draw' : winner === 'player' ? 'You win the battle!' : 'Your tank is defeated';
  events.push({ t: 'end', winner, text });
  return { units, events, winner, turns: turn, water };
}
