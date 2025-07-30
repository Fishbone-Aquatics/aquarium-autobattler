'use client';

import React, { useEffect, useRef } from 'react';
import { BattleEvent } from '@aquarium/shared-types';
import { Scroll, Swords, Heart, Shield, Skull, Play } from 'lucide-react';

interface BattleLogProps {
  events: BattleEvent[];
  maxHeight?: string;
}

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'attack':
      return <Swords className="text-red-500" size={16} />;
    case 'heal':
      return <Heart className="text-green-500" size={16} />;
    case 'status':
      return <Shield className="text-blue-500" size={16} />;
    case 'death':
      return <Skull className="text-gray-500" size={16} />;
    case 'round_start':
      return <Play className="text-purple-500" size={16} />;
    case 'ability':
      return <span className="text-yellow-500">✨</span>;
    default:
      return <span className="text-gray-500">•</span>;
  }
};

const getEventColor = (eventType: string) => {
  switch (eventType) {
    case 'attack':
      return 'border-red-200 bg-red-50';
    case 'heal':
      return 'border-green-200 bg-green-50';
    case 'status':
      return 'border-blue-200 bg-blue-50';
    case 'death':
      return 'border-gray-200 bg-gray-50';
    case 'round_start':
      return 'border-purple-200 bg-purple-50';
    case 'ability':
      return 'border-yellow-200 bg-yellow-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
};

const formatEventTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { minute: '2-digit', second: '2-digit', fractionalSecondDigits: 1 });
};

export function BattleLog({ events, maxHeight = '400px' }: BattleLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events are added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 text-center">
        <Scroll className="mx-auto mb-4 text-gray-400" size={48} />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">Battle Log</h3>
        <p className="text-gray-500">Battle events will appear here...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Scroll className="text-gray-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-800">Battle Log</h3>
          <div className="ml-auto text-sm text-gray-500">
            {events.length} events
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={logRef}
        className="overflow-y-auto p-4 space-y-2"
        style={{ maxHeight }}
      >
        {events.map((event, index) => (
          <div
            key={event.id || index}
            className={`p-3 rounded-lg border-l-4 transition-all duration-300 ${getEventColor(event.type)}`}
          >
            {/* Event Header */}
            <div className="flex items-center gap-2 mb-1">
              {getEventIcon(event.type)}
              <span className="text-xs font-mono text-gray-500">
                R{event.round}T{event.turn}
              </span>
              <span className="text-xs text-gray-500">
                {formatEventTime(event.timestamp)}
              </span>
              <div className="ml-auto">
                {event.type === 'attack' && event.value > 0 && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                    -{event.value} HP
                  </span>
                )}
                {event.type === 'heal' && event.value > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                    +{event.value} HP
                  </span>
                )}
                {event.type === 'status' && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                    Status
                  </span>
                )}
              </div>
            </div>

            {/* Event Description */}
            <div className="text-sm text-gray-700">
              {event.description}
            </div>

            {/* Participants */}
            {(event.sourceName || event.targetName) && (
              <div className="text-xs text-gray-500 mt-1">
                {event.sourceName && (
                  <span className="font-medium">{event.sourceName}</span>
                )}
                {event.sourceName && event.targetName && (
                  <span className="mx-1">→</span>
                )}
                {event.targetName && (
                  <span className="font-medium">{event.targetName}</span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Scroll indicator */}
        {events.length > 10 && (
          <div className="text-center py-2">
            <div className="text-xs text-gray-400">
              ↑ Scroll up to see earlier events ↑
            </div>
          </div>
        )}
      </div>

      {/* Footer with battle summary */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-600">Attacks</div>
            <div className="font-semibold text-red-600">
              {events.filter(e => e.type === 'attack').length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Heals</div>
            <div className="font-semibold text-green-600">
              {events.filter(e => e.type === 'heal').length}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600">Deaths</div>
            <div className="font-semibold text-gray-600">
              {events.filter(e => e.type === 'death').length}
            </div>
          </div>
        </div>
        
        {/* Total damage dealt */}
        <div className="text-center mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-600">Total Damage</div>
          <div className="font-semibold text-red-700">
            {events
              .filter(e => e.type === 'attack')
              .reduce((sum, e) => sum + e.value, 0)} HP
          </div>
        </div>
      </div>
    </div>
  );
}