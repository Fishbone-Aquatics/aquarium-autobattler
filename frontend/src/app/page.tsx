'use client';

import React from 'react';
import { GameProvider } from '../contexts/GameContext';
import { GameView } from '../components/game/GameView';

export default function Home() {
  return (
    <GameProvider>
      <GameView />
    </GameProvider>
  );
}