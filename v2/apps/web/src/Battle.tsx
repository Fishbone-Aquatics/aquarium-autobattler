import { useEffect, useMemo, useRef, useState } from 'react';
import { getDef, type BattleEvent, type GameState, type Side } from '@aquarium/engine';
import { GridBoard, type BoardItem } from './GridBoard';
import type { Dispatch } from './net';

const STEP_MS: Record<BattleEvent['t'], number> = { turn: 450, attack: 700, poison: 400, spines: 450, heal: 450, end: 300 };

export function Battle({ state, dispatch }: { state: GameState; dispatch: Dispatch }) {
  const report = state.battle!;
  const { events, units } = report;
  const [played, setPlayed] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  /** After the battle: the result dialog is hidden so the boards and the log can be read. */
  const [reviewing, setReviewing] = useState(false);
  /** The log follows new lines only while it is scrolled to the bottom. */
  const follow = useRef(true);
  const arenaRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const done = played >= events.length;
  const current = played > 0 ? events[played - 1] : null;

  useEffect(() => {
    if (done || paused) return;
    const timer = setTimeout(() => setPlayed((n) => n + 1), STEP_MS[events[played].t] / speed);
    return () => clearTimeout(timer);
  }, [played, speed, done, paused, events]);

  // HP of every unit after the events played so far.
  const hp = useMemo(() => {
    const map = new Map(units.map((u) => [u.id, u.maxHealth]));
    for (const e of events.slice(0, played)) {
      if (e.t === 'attack' || e.t === 'spines') map.set(e.target, e.hp);
      else if (e.t === 'poison' || e.t === 'heal') map.set(e.id, e.hp);
    }
    return map;
  }, [units, events, played]);

  const turn = useMemo(() => {
    let t = 0;
    for (const e of events.slice(0, played)) if (e.t === 'turn') t = e.turn;
    return t;
  }, [events, played]);

  // A little projectile from attacker to target.
  useEffect(() => {
    if (!current || current.t !== 'attack' || !arenaRef.current) return;
    const arena = arenaRef.current;
    const from = arena.querySelector(`[data-piece="${current.id}"]`)?.getBoundingClientRect();
    const to = arena.querySelector(`[data-piece="${current.target}"]`)?.getBoundingClientRect();
    if (!from || !to) return;
    const dot = document.createElement('div');
    dot.className = 'projectile';
    document.body.appendChild(dot);
    const animation = dot.animate(
      [
        { transform: `translate(${from.left + from.width / 2}px, ${from.top + from.height / 2}px) scale(0.6)`, opacity: 1 },
        { transform: `translate(${to.left + to.width / 2}px, ${to.top + to.height / 2}px) scale(1.2)`, opacity: 0.9 },
      ],
      { duration: 320 / speed, easing: 'ease-in' },
    );
    animation.onfinish = () => dot.remove();
    return () => dot.remove();
  }, [current, speed]);

  useEffect(() => {
    if (follow.current) logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [played]);

  const itemsFor = (side: Side): BoardItem[] =>
    units
      .filter((u) => u.side === side)
      .map((u) => {
        const now = hp.get(u.id) ?? 0;
        const classes = [now <= 0 ? 'dead' : ''];
        let float: BoardItem['float'];
        if (current) {
          if (current.t === 'attack' && current.id === u.id) classes.push('attacking');
          if ((current.t === 'attack' || current.t === 'spines') && current.target === u.id) {
            classes.push('hit');
            float = { key: played, text: `-${current.dmg}`, kind: 'dmg' };
          }
          if (current.t === 'poison' && current.id === u.id) {
            classes.push('hit');
            float = { key: played, text: `-${current.dmg}☠`, kind: 'dmg' };
          }
          if (current.t === 'heal' && current.id === u.id) float = { key: played, text: `+${current.amount}`, kind: 'heal' };
        }
        return {
          id: u.id,
          defId: u.defId,
          cells: u.cells,
          stats: { attack: u.attack, health: now, speed: u.speed },
          hp: { now, max: u.maxHealth },
          className: classes.join(' '),
          float,
        };
      });

  const teamHp = (side: Side) => {
    const fish = units.filter((u) => u.side === side && getDef(u.defId).type === 'fish');
    return { now: fish.reduce((sum, u) => sum + (hp.get(u.id) ?? 0), 0), max: fish.reduce((sum, u) => sum + u.maxHealth, 0) || 1 };
  };
  const mine = teamHp('player');
  const theirs = teamHp('opponent');
  const waterNote = (side: Side) => {
    const w = report.water[side];
    return `💧 ${w.quality}${w.multiplier > 1 ? ' · +30% dmg' : w.multiplier < 1 ? ' · -30% dmg, poison' : ''}`;
  };

  const total = state.rewards.reduce((sum, r) => sum + r.amount, 0);
  const lastRound = state.round >= state.maxRounds;
  const title = report.winner === 'player' ? 'Victory!' : report.winner === 'opponent' ? 'Defeat' : 'Draw';
  const continueLabel = lastRound ? 'See final results' : `Continue to round ${state.round + 1}`;
  const replay = () => {
    follow.current = true;
    setReviewing(false);
    setPaused(false);
    setPlayed(0);
  };

  return (
    <div className="battle">
      <div className="battle-bar panel">
        <strong>
          Round {state.round} · {done ? title : turn ? `Turn ${turn}` : 'Get ready'}
        </strong>
        <div className="battle-controls">
          {[1, 2, 4].map((s) => (
            <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
          <button className={paused ? 'on' : ''} onClick={() => setPaused((p) => !p)} disabled={done}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button onClick={() => setPlayed(events.length)} disabled={done}>
            Skip ⏭
          </button>
          {done && reviewing && (
            <>
              <button onClick={replay}>Watch again</button>
              <button className="primary" onClick={() => dispatch({ type: 'nextRound' })}>
                {continueLabel}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="arena" ref={arenaRef}>
        {(['player', 'opponent'] as Side[]).map((side) => {
          const team = side === 'player' ? mine : theirs;
          return (
            <section key={side} className={`panel arena-side ${side}`}>
              <div className="panel-head">
                <h2>{side === 'player' ? 'Your tank' : `${state.opponentInfo.emoji} ${state.opponentInfo.name}`}</h2>
                <span className="totals">{waterNote(side)}</span>
              </div>
              <div className="teambar" title="Total HP of living fish">
                <span style={{ width: `${(team.now / team.max) * 100}%` }} />
                <em>
                  {team.now} / {team.max} fish HP
                </em>
              </div>
              <GridBoard items={itemsFor(side)} className={side === 'opponent' ? 'enemy' : ''} />
            </section>
          );
        })}
      </div>

      <div
        className={`panel log ${reviewing ? 'tall' : ''}`}
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {events.slice(0, played).map((e, i) => (
          <div key={i} className={`log-line ${e.t}`}>
            {e.text}
          </div>
        ))}
      </div>

      {done && !reviewing && (
        <div className="overlay">
          <div className={`panel result ${report.winner}`}>
            <h1>{title}</h1>
            <p>
              Record {state.wins}W - {state.losses}L{state.draws ? ` - ${state.draws}D` : ''}
            </p>
            {state.rewards.length > 0 && (
              <table className="rewards">
                <tbody>
                  {state.rewards.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>+{r.amount}g</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Gold next round</td>
                    <td>{state.gold + total}g</td>
                  </tr>
                </tbody>
              </table>
            )}
            <button className="fight" onClick={() => dispatch({ type: 'nextRound' })}>
              {continueLabel}
            </button>
            <div className="result-links">
              <button className="link" onClick={() => setReviewing(true)}>
                Read the battle log
              </button>
              <button className="link" onClick={replay}>
                Watch again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
