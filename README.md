# 🐠 Aquarium Autobattler

A modern, scalable auto-battler game built with Next.js, NestJS, and WebSockets. Create your dream aquarium tank, strategically place aquatic creatures, and battle opponents in turn-based combat!

## ✨ Features

- 🎮 **Real-time Gameplay** - WebSocket-powered multiplayer experience
- 🐠 **Strategic Placement** - 8×6 grid-based tank management
- 💰 **Gold Economy** - Shop, buy, sell, and manage resources
- 🌊 **Water Quality System** - Dynamic quality affects combat bonuses, poison damage, and strategy  
- 🔄 **Session Persistence** - Your progress saves across page refreshes
- 🛠️ **Modular Architecture** - Clean, scalable codebase structure

## 🏗️ Architecture

This is an Nx monorepo with a modular architecture designed for scalability:

```
aquarium-autobattler-nx/
├── frontend/                # Next.js React application
├── game-engine/            # NestJS backend with service-oriented architecture
│   ├── src/game/           # Game orchestration and WebSocket endpoints
│   ├── src/tank/           # Tank operations, water quality, piece placement
│   ├── src/battle/         # Combat mechanics and battle simulation
│   ├── src/economy/        # Shop generation, gold rewards, interest
│   ├── src/ai/             # Opponent behavior and smart AI logic
│   ├── src/player/         # Player session management
│   ├── src/debug/          # Debug and admin tools
│   └── src/app/            # Main application module
├── libs/shared-types/      # Shared TypeScript interfaces
└── tools/                  # Build and configuration
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development (easy mode):**
   ```bash
   # Windows PowerShell
   ./start.ps1
   
   # Or manually start both services
   npm run dev
   ```

3. **Open your browser:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api
   - Debug Panel: http://localhost:3001/api/debug/sessions

### Quick Commands

```bash
# Development
npm run dev                    # Start both frontend and backend
npm run start:frontend        # Frontend only (Next.js)
npm run start:backend         # Backend only (NestJS)

# Building  
npm run build:all             # Build everything
npm run build:shared          # Build shared types

# Utilities
./stop.ps1                    # Stop all services (Windows)
npm run lint                  # Run linting
```

## 🎮 How to Play

1. **Buy Pieces** - Spend gold to purchase fish, plants, and equipment from the shop
2. **Build Your Tank** - Drag pieces onto the 8×6 grid to create strategic formations
3. **Manage Resources** - Earn interest on saved gold, reroll shop for better pieces
4. **Battle & Progress** - Fight opponents, earn rewards, advance through rounds
5. **Save Progress** - Click "Confirm Placement & Prepare for Battle" to save your state

### Game Mechanics

- 🏪 **Shop System** - 6 rotating pieces, 2g reroll cost, lock favorite pieces
- 💰 **Economy** - Earn interest (1g per 10g held, max 5g), sell for 50% value  
- 🐠 **Piece Types** - Fish (attackers), Plants (buffs), Equipment (utility), Consumables (one-time boosts)
- 🌊 **Water Quality** - Fish decrease quality (-1), plants increase (+1), affects combat damage (±30%)
- 🎯 **Strategy** - Adjacency bonuses, schooling synergies, water quality management
- 📊 **Persistence** - Server-side session storage survives page refreshes

## 📁 Project Structure

Each major component has its own README with detailed information:

- [`frontend/`](./frontend/README.md) - Next.js React frontend application
- [`game-engine/`](./game-engine/README.md) - NestJS backend with modular architecture
  - [`src/player/`](./game-engine/src/player/README.md) - Player session management
  - [`src/game/`](./game-engine/src/game/README.md) - Core game logic and mechanics  
  - [`src/debug/`](./game-engine/src/debug/README.md) - Debug tools and admin panel
- [`libs/shared-types/`](./libs/shared-types/README.md) - Shared TypeScript interfaces

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
- **NestJS** framework with service-oriented architecture
- **Modular Services**: Tank, Battle, Economy, AI, Player, Game orchestration
- **WebSocket Gateway** for real-time events
- **In-memory game state** with session persistence

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
- Turn-based combat with water quality bonuses/penalties
- Enhanced battle log with real-time event tracking
- Poison damage for fish in poor water quality (1-3)
- Reward calculation and loss streak bonuses

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

## 📋 Documentation

For detailed information about features, bugs, and development priorities:

- **[FEATURES.md](./FEATURES.md)** - Complete feature list with implementation status
- **[TODO.md](./TODO.md)** - Development roadmap, known issues, and bug tracker

---

*Built with ❤️ using Nx, Next.js, NestJS, and TypeScript*