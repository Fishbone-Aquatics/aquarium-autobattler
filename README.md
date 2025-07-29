# 🐠 Aquarium Autobattler - Modern Full-Stack Rebuild

A modern, scalable rebuild of the Aquarium Autobattler game using Next.js, NestJS, and WebSockets.

## 🏗️ Architecture

This project follows a microservices architecture with an Nx monorepo:

```
/workspace
├─ apps/
│   ├─ frontend/             # Next.js + React + Tailwind
│   └─ game-engine/          # NestJS microservice for game logic
├─ libs/
│   └─ shared-types/         # Shared TypeScript interfaces
└─ tools/                    # Nx configurations
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development servers:

```bash
# Start the game engine (backend)
npx nx serve game-engine

# Start the frontend (in another terminal)
npx nx serve frontend
```

The frontend will be available at `http://localhost:3000` and the game engine at `http://localhost:3001`.

## 🎮 Game Features

### Current Implementation
- ✅ Shop system with gold economy
- ✅ 8×6 grid-based tank placement
- ✅ Real-time WebSocket communication
- ✅ Piece types: Fish, Plants, Equipment, Consumables
- ✅ Round-based gameplay (15 rounds)
- ✅ Water quality mechanics
- ✅ Interest system (1g per 10g held, max 5g)
- ✅ Loss streak tracking

### Planned Features
- [ ] Battle animation system
- [ ] AI opponent strategies
- [ ] Piece synergies and abilities
- [ ] Campaign progression
- [ ] Player authentication
- [ ] Leaderboards

## 🔧 Development

### Available Commands

```bash
# Development
npx nx serve frontend          # Start frontend dev server
npx nx serve game-engine      # Start backend dev server

# Building
npx nx build frontend       # Build frontend for production
npx nx build game-engine   # Build backend for production

# Testing
npx nx test frontend        # Run frontend tests
npx nx test game-engine    # Run backend tests
npx nx test shared-types   # Run shared types tests

# Linting
npx nx lint frontend        # Lint frontend code
npx nx lint game-engine    # Lint backend code
```

### Project Structure

#### Frontend (`apps/frontend/`)
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication

#### Game Engine (`apps/game-engine/`)
- **NestJS** framework
- **WebSocket Gateway** for real-time events
- **In-memory game state** (Redis integration planned)

#### Shared Types (`libs/shared-types/`)
- Common TypeScript interfaces
- WebSocket event definitions
- Game state types

## 🎯 Core Game Mechanics

### Shop System
- 6 shop slots with dynamic piece generation
- Reroll system (2g cost)
- Shop locking mechanism
- Rarity-weighted piece distribution

### Tank Management
- 8×6 grid placement system
- Drag-and-drop piece positioning
- Water quality affects piece performance
- Shape-based piece placement validation

### Battle System
- Turn-based combat simulation
- Stat comparison system
- Reward calculation based on performance
- Loss streak bonus system

### Economy
- Gold-based purchase system
- Interest accumulation (1g per 10g, max 5g)
- Sell pieces for 50% value
- Battle rewards and bonuses

## 🔮 Extensibility

The architecture is designed for easy extension:

### Adding New Pieces
1. Add piece definition to `game-engine/src/app/data/pieces.ts`
2. Update shared types if needed
3. Add UI icons/styling to frontend components

### Adding New Game Modes
1. Create new service in game-engine
2. Add WebSocket events to shared-types
3. Create new frontend components

### Adding Persistence
1. Replace in-memory storage with Redis/Database
2. Add user authentication
3. Implement save/load functionality

## 🤝 Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Submit PRs with clear descriptions

## 📝 License

This project is for educational purposes and demonstrates modern full-stack architecture patterns.

---

*Built with ❤️ using Nx, Next.js, NestJS, and TypeScript*