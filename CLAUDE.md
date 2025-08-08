# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is an **Nx monorepo** containing a full-stack aquarium auto-battler game:

- **frontend/** - Next.js 15 + React 19 + TypeScript frontend with Tailwind CSS
- **game-engine/** - NestJS backend with WebSocket real-time communication
- **libs/shared-types/** - Shared TypeScript interfaces for type safety across frontend/backend
- **PowerShell scripts** - `start.ps1` and `stop.ps1` for Windows development workflow

### Key Technologies
- **Nx workspace** for monorepo management and coordinated builds
- **WebSocket (Socket.IO)** for real-time multiplayer game state
- **In-memory session storage** for game state (no database required)
- **Drag & Drop HTML5 API** for game piece placement

## Development Commands

### Starting/Stopping Services
```bash
# Windows PowerShell (preferred)
./start.ps1                    # Start both services with colored output
./stop.ps1                     # Stop services on ports 3000/3001

# Manual start
npm run dev                    # Start both frontend + backend
npm run start:frontend         # Next.js dev server (port 3000)
npm run start:backend          # NestJS server (port 3001)

# Individual Nx commands  
npx nx dev frontend            # Frontend only
npx nx serve game-engine       # Backend only
```

### Building
```bash
npm run build:shared          # Build shared types library first
npm run build:all             # Build shared types + game-engine + frontend
npx nx build shared-types      # Build shared library
npx nx build game-engine       # Build NestJS backend
npx nx build frontend          # Build Next.js frontend
```

### Testing & Quality
```bash
npm run test:comprehensive     # Custom integration test suite (test-setup.js)
npm run test:unit              # All unit tests
npm run test:e2e               # E2E tests with Playwright
npx nx test                    # Run all Jest tests
npx nx test --watch            # Watch mode for tests
npm run lint                   # Lint all projects
npm run lint:fix               # Auto-fix linting issues
```

## Game Engine Architecture (NestJS)

The backend is modularly structured with dedicated services:

- **src/player/** - Session management, player state persistence 
- **src/game/** - Core game logic, battle mechanics, WebSocket events
- **src/debug/** - Debug endpoints, admin tools, API documentation
- **src/app/data/pieces.ts** - Game piece definitions and stats

### WebSocket Events
Game state synchronization uses Socket.IO events defined in `libs/shared-types/src/lib/events.types.ts`.

## Frontend Architecture (Next.js)

- **src/app/** - Next.js App Router pages and API routes
- **src/components/game/** - Game-specific React components (GameView, Shop, TankGrid, BattleView)
- **src/components/ui/** - Reusable UI components  
- **src/contexts/GameContext.tsx** - React context for game state management
- **src/utils/** - Game logic utilities and calculations

### Key Components
- **GameView** - Main game interface orchestration
- **TankGrid** - 8×6 grid drag-and-drop piece placement  
- **Shop** - Piece purchasing, reroll mechanics, gold management
- **BattleView** - Real-time combat visualization

## Game Mechanics Context

Understanding the game helps when debugging or adding features:

- **8×6 tank grid** with complex multi-cell piece shapes
- **4 piece types**: Fish (attackers), Plants (buffers), Equipment (utility), Consumables (permanent buffs)
- **Adjacency bonuses** - pieces affect neighbors with stat bonuses
- **Real-time battles** with speed-based initiative order
- **Session persistence** - game state survives page refreshes

## Known Issues & Priorities

Critical issues (from TODO.md):
1. **No sell functionality** - can't sell pieces for gold
2. **Game end missing** - Round 15 doesn't reset or show victory  
3. **Real-time health updates** - health bars update per turn, not per attack

## Testing Strategy

Run comprehensive tests with `npm run test:comprehensive` which validates:
- Backend API health (port 3001)
- Frontend loading (port 3000) 
- WebSocket connectivity
- CSS compilation with Tailwind
- Component file presence
- Development dependencies

## URLs During Development
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api  
- Debug panel: http://localhost:3001/api/debug/sessions
- WebSocket endpoint: http://localhost:3001/socket.io/