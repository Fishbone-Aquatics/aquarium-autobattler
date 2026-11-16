import { randomInt } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { GameError, applyAction, newGame, parseAction, toClientView, type GameState } from '@aquarium/engine';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3101);
const WEB_DIST = resolve(here, '../../web/dist');
const DATA_FILE = resolve(process.env.DATA_FILE ?? join(here, '../data/sessions.json'));
const MAX_SESSIONS = 5000;

// ---- Sessions: in memory, mirrored to a JSON file so restarts do not lose games ----

const sessions = new Map<string, GameState>();
try {
  if (existsSync(DATA_FILE)) {
    const saved = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as Record<string, GameState>;
    for (const [id, state] of Object.entries(saved)) if (state?.version === 2) sessions.set(id, state);
    console.log(`Restored ${sessions.size} session(s)`);
  }
} catch (err) {
  console.warn('Could not read saved sessions, starting empty:', err);
}

let saveTimer: NodeJS.Timeout | null = null;
function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(dirname(DATA_FILE), { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(sessions)));
    } catch (err) {
      console.warn('Could not save sessions:', err);
    }
  }, 1000);
}

function sessionFor(playerId: string): GameState {
  let state = sessions.get(playerId);
  if (!state) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
    state = newGame(randomInt(0xffffffff));
    sessions.set(playerId, state);
    scheduleSave();
  }
  return state;
}

// ---- HTTP: health check plus the built web app (when it exists) ----

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const http = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (path === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, sessions: sessions.size }));
    return;
  }
  let file = normalize(join(WEB_DIST, path));
  if (!file.startsWith(WEB_DIST)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(WEB_DIST, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Aquarium Autobattle server is running. Build the web app (npm run build) or use the Vite dev server.');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

// ---- Game socket: the server owns the state; clients send actions and receive the new state ----

const io = new Server(http, { cors: { origin: true } });

io.on('connection', (socket) => {
  const raw = socket.handshake.auth?.playerId;
  if (typeof raw !== 'string' || !/^[\w-]{8,64}$/.test(raw)) {
    socket.emit('fatal', 'Invalid player id');
    socket.disconnect(true);
    return;
  }
  const playerId = raw;
  socket.join(playerId);
  socket.emit('state', toClientView(sessionFor(playerId)), 0);

  socket.on('action', (payload: unknown, seq: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (r: { ok: boolean; error?: string }) => void) : () => {};
    const n = typeof seq === 'number' ? seq : 0;
    try {
      const next = applyAction(sessionFor(playerId), parseAction(payload));
      sessions.set(playerId, next);
      scheduleSave();
      reply({ ok: true });
    } catch (err) {
      if (!(err instanceof GameError)) console.error('Unexpected error applying action', payload, err);
      reply({ ok: false, error: err instanceof GameError ? err.message : 'Server error' });
    }
    // Always send the authoritative state back: to this socket with its sequence number, to other tabs without.
    const view = toClientView(sessionFor(playerId));
    socket.emit('state', view, n);
    socket.to(playerId).emit('state', view, 0);
  });
});

http.listen(PORT, () => console.log(`Aquarium Autobattle v2 server listening on http://localhost:${PORT}`));
