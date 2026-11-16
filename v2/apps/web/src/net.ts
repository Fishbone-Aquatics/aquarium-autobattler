import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { applyAction, type Action, type GameState } from '@aquarium/engine';

function playerId(): string {
  const KEY = 'aquarium-v2-player';
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Actions with no randomness: the client predicts them with the shared engine for instant feedback. */
const PREDICTABLE = new Set<Action['type']>(['buy', 'place', 'unplace', 'sell', 'lock']);

export type Dispatch = (action: Action) => void;

export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sync = useRef({ sent: 0, pending: 0 });

  const commit = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const socket = io({ auth: { playerId: playerId() } });
    socketRef.current = socket;
    socket.on('connect', () => {
      sync.current.pending = 0;
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('fatal', (message: string) => notify(message));
    socket.on('state', (next: GameState, seq: number) => {
      // While newer actions are still in flight, skip stale snapshots so predictions do not flicker.
      if (sync.current.pending > 0 && seq !== sync.current.sent) return;
      commit(next);
    });
    return () => {
      socket.disconnect();
    };
  }, [commit, notify]);

  const dispatch = useCallback<Dispatch>(
    (action) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        notify('Not connected to the server');
        return;
      }
      if (PREDICTABLE.has(action.type) && stateRef.current) {
        try {
          commit(applyAction(stateRef.current, action));
        } catch (err) {
          notify(err instanceof Error ? err.message : 'That is not allowed');
          return;
        }
      }
      const seq = ++sync.current.sent;
      sync.current.pending++;
      socket.emit('action', action, seq, (result: { ok: boolean; error?: string }) => {
        sync.current.pending = Math.max(0, sync.current.pending - 1);
        if (!result.ok) notify(result.error ?? 'That is not allowed');
      });
    },
    [commit, notify],
  );

  return { state, connected, toast, dispatch, notify };
}
