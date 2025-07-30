# 🎨 Frontend - Aquarium Autobattler

The client-side React application providing the user interface for the Aquarium Autobattler game.

## 🛠️ Tech Stack

- **Next.js 15** - React framework with App Router
- **React 18** - UI library with hooks and context
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Socket.IO Client** - Real-time WebSocket communication

## 🏗️ Architecture

```
frontend/src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout component
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── game/              # Game-specific components
│   │   ├── GameView.tsx   # Main game interface
│   │   ├── Shop.tsx       # Shopping interface
│   │   ├── TankGrid.tsx   # Drag-and-drop tank grid
│   │   ├── PieceCard.tsx  # Individual piece display
│   │   └── TankSummary.tsx # Tank statistics
│   └── ui/                # Shared UI components
│       ├── Header.tsx     # App header
│       └── Footer.tsx     # App footer with session info
├── contexts/              # React Context providers
│   └── GameContext.tsx    # Game state management
├── utils/                 # Utility functions and helpers
│   ├── bonusConfig.ts     # Piece bonus configurations
│   ├── tankAnalysis.ts    # Tank analysis logic
│   └── draftStateManager.ts # Local draft state utilities
└── hooks/                 # Custom React hooks (empty)
```

## 🚀 Getting Started

### Development

```bash
# Start development server
npm run start:frontend
# or
npx nx dev frontend

# Visit http://localhost:3000
```

### Building

```bash
# Build for production
npx nx build frontend

# The build output will be in dist/frontend/
```

## 🎮 Key Components

### GameView.tsx
The main game interface that orchestrates all game components:
- Manages drag-and-drop interactions
- Handles piece placement and movement
- Coordinates with GameContext for state management

### Shop.tsx
Shopping interface component:
- Displays available pieces for purchase
- Handles buy/sell actions
- Manages shop rerolls and locking

### TankGrid.tsx
Interactive 8×6 grid for piece placement:
- Drag-and-drop functionality
- Visual feedback for valid/invalid placements
- Real-time stat calculations and bonus displays

### GameContext.tsx
Central state management using React Context:
- WebSocket connection management
- Game state synchronization
- Player session persistence
- Action dispatching to backend

## 🔌 Real-time Communication

The frontend communicates with the game-engine via WebSocket events:

```typescript
// Example WebSocket events
SOCKET_EVENTS.SHOP_BUY          // Purchase piece from shop
SOCKET_EVENTS.TANK_UPDATE       // Place/move pieces in tank
SOCKET_EVENTS.SAVE_DRAFT_STATE  // Save current game state
SOCKET_EVENTS.GAME_STATE_UPDATE // Receive state updates
```

## 📱 Features

### Session Persistence
- **Persistent Player ID** - Stored in localStorage, survives page refreshes
- **Server-side State** - Game state persists on backend reconnection
- **Draft System** - Save progress with "Confirm Placement & Prepare for Battle"

### Drag & Drop
- **Intuitive Placement** - Drag pieces from shop or inventory onto tank grid
- **Visual Feedback** - Hover effects, valid/invalid placement indicators
- **Shape Validation** - Multi-cell pieces respect grid boundaries and collisions

### Real-time Updates
- **Live Statistics** - Piece stats update based on adjacency bonuses
- **Instant Feedback** - Purchases, sales, and placements reflected immediately
- **Synchronized State** - Multiple tabs/windows stay in sync

## 🎨 Styling

### Tailwind CSS
The project uses Tailwind CSS for styling with a custom configuration:

```css
/* Key design patterns */
.piece-card     /* Individual piece styling */
.tank-grid      /* Game board styling */  
.shop-slot      /* Shop interface styling */
.stat-display   /* Stat visualization */
```

### Responsive Design
- **Mobile-first** - Designed to work on tablets and desktops
- **Flexible Grid** - Tank grid scales appropriately
- **Touch-friendly** - Drag interactions work on touch devices

## 🔧 Configuration

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001  # Backend API URL
```

### Next.js Configuration
See `next.config.js` for:
- Webpack configurations
- API routes (currently unused)
- Build optimizations

## 🧪 Development Tools

### Debug Features
- **Player ID Display** - Footer shows current player ID
- **Session Inspector** - Click player ID to view session data
- **Draft State Info** - Visual indicators for saved/unsaved state
- **Console Logging** - Detailed WebSocket event logging

### Local Storage
```typescript
// Stored data
'aquarium-player-id'  // Persistent player identifier
```

## 📋 Common Tasks

### Adding New Piece Types
1. Update shared types for new piece interface
2. Add styling in `TankGrid.tsx` and `PieceCard.tsx`
3. Update bonus calculations in `bonusConfig.ts`

### Adding New Game Features
1. Add WebSocket events to shared types
2. Update `GameContext.tsx` for new actions
3. Create/update components for new UI
4. Update backend handlers accordingly

### Customizing UI
1. Modify Tailwind classes in components
2. Update global styles in `globals.css`
3. Add new UI components in `components/ui/`

## 🔍 Troubleshooting

### Common Issues

**WebSocket Connection Fails**
- Check that backend is running on port 3001
- Verify NEXT_PUBLIC_API_URL environment variable

**Drag & Drop Not Working**
- Ensure pieces have proper shape data
- Check console for validation errors
- Verify WebSocket connection is active

**State Not Persisting**
- Check localStorage for player ID
- Verify backend session storage
- Check network tab for draft save events

**Build Errors**
- Run `npm run build:shared` to rebuild shared types
- Check for TypeScript errors in components
- Verify all imports are correctly typed

## 🔗 Related Documentation

- [Main Project README](../README.md)
- [Game Engine README](../game-engine/README.md)
- [Shared Types README](../libs/shared-types/README.md)
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Client Documentation](https://socket.io/docs/v4/client-api/)