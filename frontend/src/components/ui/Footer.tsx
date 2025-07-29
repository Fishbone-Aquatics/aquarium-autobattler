'use client';

import React from 'react';

interface FooterProps {
  phase: string;
  waterQuality: number;
}

export function Footer({ phase, waterQuality }: FooterProps) {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Build your dream aquarium and dominate the competition!</p>
          <div className="flex items-center gap-4">
            <span className="text-xs">Phase: <strong className="capitalize">{phase}</strong></span>
            <span className="text-xs">Tank Health: <strong>{waterQuality}/10</strong></span>
          </div>
        </div>
      </div>
    </footer>
  );
}