import { WATER_BAD, WATER_GOOD, getDef, rotateShape, type BoardComputed, type PieceComputed, type Rot } from '@aquarium/engine';

export function ShapeIcon({ defId, rot = 0, size = 9 }: { defId: string; rot?: Rot; size?: number }) {
  const def = getDef(defId);
  const cells = rotateShape(def.shape, rot);
  const w = Math.max(...cells.map((c) => c.x)) + 1;
  const h = Math.max(...cells.map((c) => c.y)) + 1;
  return (
    <span className="shape-icon" style={{ width: w * size, height: h * size }} title={`${cells.length} cell${cells.length > 1 ? 's' : ''}`}>
      {cells.map((c, i) => (
        <span key={i} className={def.type} style={{ left: c.x * size, top: c.y * size, width: size - 1, height: size - 1 }} />
      ))}
    </span>
  );
}

export function WaterMeter({ board, next }: { board: BoardComputed; next?: number }) {
  const q = board.waterQuality;
  const tone = (v: number) => (v >= WATER_GOOD ? 'good' : v <= WATER_BAD ? 'bad' : 'ok');
  const effect = q >= WATER_GOOD ? 'Clean: +30% damage' : q <= WATER_BAD ? 'Toxic: -30% damage, fish take 1 poison per turn' : 'Neutral';
  return (
    <div className={`water ${tone(q)}`} title="Fish lower water quality, plants and filters raise it. 8+ gives +30% damage; 3 or less gives -30% damage and poisons your fish.">
      <span className="water-label">💧 Water {q}/10</span>
      <span className="water-pips">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className={i < q ? `on ${tone(q)}` : ''} />
        ))}
      </span>
      <span className="water-effect">{effect}</span>
      {next !== undefined && next !== q && <span className={`water-next ${tone(next)}`}>→ {next}</span>}
    </div>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Full, itemised explanation of a piece: what it is, and exactly where every stat point comes from. */
export function PieceDetails({ defId, computed, note }: { defId: string; computed?: PieceComputed; note?: string }) {
  const def = getDef(defId);
  const stats = computed?.final ?? def.stats;
  return (
    <div className="details">
      <div className="details-head">
        <span className="details-emoji">{def.emoji}</span>
        <div>
          <div className="details-name">{def.name}</div>
          <div className="details-sub">
            <span className={`rarity ${def.rarity}`}>{def.rarity}</span> {def.type} · {def.cost}g
          </div>
        </div>
        <ShapeIcon defId={defId} size={11} />
      </div>
      {def.type !== 'consumable' && (
        <div className="details-stats">
          {def.type === 'fish' && <span>⚔ {stats.attack}</span>}
          <span>♥ {stats.health}</span>
          {def.type === 'fish' && <span>⚡ {stats.speed}</span>}
        </div>
      )}
      <ul className="details-text">
        {def.text.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {computed && def.type === 'fish' && (
        <table className="breakdown">
          <tbody>
            <tr>
              <td>Base</td>
              <td>{def.stats.attack}</td>
              <td>{def.stats.health}</td>
              <td>{def.stats.speed}</td>
            </tr>
            {computed.bonuses.map((b, i) => (
              <tr key={i} className="bonus">
                <td>
                  {b.source}
                  {b.pending && <em> (eaten at battle start)</em>}
                </td>
                <td>{b.attack ? signed(b.attack) : ''}</td>
                <td>{b.health ? signed(b.health) : ''}</td>
                <td>{b.speed ? signed(b.speed) : ''}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td>⚔ {computed.final.attack}</td>
              <td>♥ {computed.final.health}</td>
              <td>⚡ {computed.final.speed}</td>
            </tr>
          </tbody>
        </table>
      )}
      {computed?.hints.map((hint) => (
        <div key={hint} className="details-note">
          {hint}
        </div>
      ))}
      {note && <div className="details-note">{note}</div>}
    </div>
  );
}
