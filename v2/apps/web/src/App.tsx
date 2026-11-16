import { useState } from 'react';
import { DIFFICULTIES, OPPONENTS, type Difficulty } from '@aquarium/engine';
import { Battle } from './Battle';
import { useGame } from './net';
import { Prep } from './Prep';

export function App() {
  const { state, connected, toast, dispatch, notify } = useGame();
  const [showLog, setShowLog] = useState(false);
  const [setup, setSetup] = useState<{ opponent: string | undefined; difficulty: Difficulty } | null>(null);
  const openSetup = () => setSetup({ opponent: undefined, difficulty: state?.difficulty ?? 'normal' });

  if (!state) {
    return (
      <div className="splash">
        <div className="splash-fish">🐠</div>
        <h1>Aquarium Autobattle</h1>
        <p>{connected ? 'Loading your tank…' : 'Connecting to the game server…'}</p>
      </div>
    );
  }

  const streak = state.winStreak > 1 ? `🔥 ${state.winStreak} win streak` : state.lossStreak > 1 ? `🧊 ${state.lossStreak} loss streak` : '';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🐠 Aquarium Autobattle</div>
        <div className={`stat ${state.round >= state.maxRounds ? 'final' : ''}`}>
          {state.round >= state.maxRounds && '🏁 Final '}Round <b>{Math.min(state.round, state.maxRounds)}</b>/{state.maxRounds}
        </div>
        <button className="stat gold" onClick={() => setShowLog((v) => !v)} title="Show gold history">
          🪙 <b>{state.gold}</b>
        </button>
        <div className="stat">
          <b>{state.wins}</b>W <b>{state.losses}</b>L{state.draws > 0 && <> <b>{state.draws}</b>D</>}
        </div>
        {streak && <div className="stat streak">{streak}</div>}
        <div className="history">
          {state.history.map((h, i) => (
            <i key={i} className={h} title={`Round ${i + 1}: ${h === 'player' ? 'win' : h === 'opponent' ? 'loss' : 'draw'}`} />
          ))}
        </div>
        <div className="spacer" />
        <span className={`conn ${connected ? 'up' : 'down'}`} title={connected ? 'Connected' : 'Reconnecting…'} />
        <button className="ghost-btn" onClick={openSetup}>
          New game
        </button>
      </header>

      {state.phase === 'prep' && <Prep state={state} dispatch={dispatch} notify={notify} />}
      {state.phase === 'battle' && state.battle && <Battle key={state.round} state={state} dispatch={dispatch} />}
      {state.phase === 'gameover' && (
        <div className="overlay static">
          <div className="panel result">
            <h1>{state.wins > state.losses ? '🏆 Champion aquarist!' : state.wins === state.losses ? 'A balanced ecosystem' : 'The tank needs work…'}</h1>
            <p>
              Final record: {state.wins} wins, {state.losses} losses{state.draws ? `, ${state.draws} draws` : ''} against {state.opponentInfo.name} the{' '}
              {state.opponentInfo.personality}.
            </p>
            <div className="history big">
              {state.history.map((h, i) => (
                <i key={i} className={h} />
              ))}
            </div>
            <button className="fight" onClick={openSetup}>
              Play again
            </button>
          </div>
        </div>
      )}

      {showLog && (
        <div className="overlay" onClick={() => setShowLog(false)}>
          <div className="panel goldlog" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2>🪙 Gold history</h2>
              <button className="ghost-btn" onClick={() => setShowLog(false)}>
                Close
              </button>
            </div>
            <div className="goldlog-list">
              {[...state.goldLog].reverse().map((entry, i) => (
                <div key={i} className="goldlog-row">
                  <span className="muted">R{entry.round}</span>
                  <span>{entry.label}</span>
                  <b className={entry.amount >= 0 ? 'plus' : 'minus'}>
                    {entry.amount >= 0 ? '+' : ''}
                    {entry.amount}g
                  </b>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {setup && (
        <div className="overlay" onClick={() => setSetup(null)}>
          <div className="panel setup" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h2>New game</h2>
              <button className="ghost-btn" onClick={() => setSetup(null)}>
                Cancel
              </button>
            </div>
            <div className="eyebrow">Opponent</div>
            <div className="choices">
              <button className={`choice ${setup.opponent === undefined ? 'on' : ''}`} onClick={() => setSetup({ ...setup, opponent: undefined })}>
                <b>🎲 Surprise me</b>
                <span>A random opponent.</span>
              </button>
              {OPPONENTS.map((o) => (
                <button
                  key={o.personality}
                  className={`choice ${setup.opponent === o.personality ? 'on' : ''}`}
                  onClick={() => setSetup({ ...setup, opponent: o.personality })}
                >
                  <b>
                    {o.emoji} {o.name} <small>the {o.personality}</small>
                  </b>
                  <span>{o.blurb}</span>
                </button>
              ))}
            </div>
            <div className="eyebrow">Difficulty</div>
            <div className="choices three">
              {DIFFICULTIES.map((d) => (
                <button key={d.id} className={`choice ${setup.difficulty === d.id ? 'on' : ''}`} onClick={() => setSetup({ ...setup, difficulty: d.id })}>
                  <b>{d.name}</b>
                  <span>{d.blurb}</span>
                </button>
              ))}
            </div>
            <button
              className="fight"
              onClick={() => {
                dispatch({ type: 'newGame', opponent: setup.opponent, difficulty: setup.difficulty });
                setSetup(null);
              }}
            >
              {state.phase === 'gameover' ? 'Start' : 'Abandon this run and start'}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div key={toast.id} className="toast">
          {toast.text}
        </div>
      )}
    </div>
  );
}
