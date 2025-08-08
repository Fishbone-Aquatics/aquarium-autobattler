# 🐠 Aquarium Auto-Battler - Features & Status

## 🎮 Current Features

### ✅ Core Gameplay
- **Turn-based Auto-battler**: Players build teams, battle automatically with speed-based initiative
- **Multi-phase Rounds**: Shop → Placement → Battle → Results cycle
- **Tank Grid System**: 8x6 grid with drag-and-drop piece placement
- **Real-time Multiplayer**: WebSocket-based live battles and updates

### ✅ Piece System
- **Multi-cell Shapes**: Complex piece shapes (L-shape Angelfish, 2x2 Java Fern, etc.)
- **4 Piece Types**: Fish (attackers), Plants (buffers), Equipment (utility), Consumables (permanent buffs)
- **Adjacency Bonuses**: Multi-cell aware adjacency detection and stat bonuses
- **Permanent Consumable Bonuses**: Brine Shrimp and other consumables provide permanent stat increases

### ✅ Battle System
- **Speed-based Initiative**: Fastest pieces attack first across both teams
- **Individual Combat**: Each piece attacks individually with detailed damage breakdown
- **Comprehensive Battle Logs**: Turn-by-turn attack logs with emoji indicators and damage details
- **HP-based Victory**: Battles continue until one side reaches 0 total HP
- **Plant Strategy**: Plants don't attack but provide defensive HP and adjacency bonuses

### ✅ Equipment Effects
- **Filter Enhancement**: Basic Filter boosts adjacent plant effects by 20%
- **Multi-cell Support**: Equipment effects work with complex piece shapes

### ✅ Economy & Progression  
- **Gold System**: Earn/spend gold on pieces, rerolls, shop management
- **Interest Mechanics**: Earn interest on banked gold
- **Loss Streak Bonuses**: Extra gold for consecutive losses
- **Shop Lock System**: Lock desired pieces between rounds
- **Persistent Opponents**: Opponents grow organically between rounds

### ✅ Quality of Life
- **Hover Tooltips**: Detailed piece stats, abilities, and adjacency bonuses
- **Visual Indicators**: Dead piece markers, stat highlighting, drag previews  
- **Session Management**: Save/restore game state, reset games, new player IDs
- **Build System**: NX monorepo with TypeScript, React, NestJS

---

## 🐛 Known Issues & Missing Features

### 🔴 High Priority
- **No Sell Functionality**: Can't sell pieces back for gold
- **Game End Missing**: Round 15 doesn't indicate final battle or reset game
- **Real-time Health Updates**: Health bars update per turn, not per attack (feels choppy)

### 🟡 Medium Priority  
- **Gold Transaction History**: No way to track gold income/expenses over time
- **Equipment Underutilized**: Only Basic Filter exists, needs more variety
- **Missing Pieces**: Some items seem to be missing from original piece library
- **Equipment Respawn**: Equipment doesn't respawn after battles like other pieces
- **Opponent AI**: Doesn't spend gold optimally, sometimes hoards large amounts

### 🔵 Low Priority
- **Adjacency Tooltips**: Don't show specific stat values provided by bonuses  
- **Battle Log UI**: Log section is very small and hard to read
- **New ID Shop Bug**: Getting new player ID doesn't regenerate shop (requires reroll)

---

## 🎯 Technical Architecture

### Frontend (`/frontend`)
- **React 18** with Next.js 15
- **TypeScript** with strict type checking
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **Drag & Drop** with HTML5 API

### Backend (`/game-engine`) 
- **NestJS** with TypeScript
- **Socket.IO Server** for WebSocket handling
- **In-memory Game State** with session management
- **Modular Services** for game logic separation

### Shared (`/libs/shared-types`)
- **Common Interfaces** for game state, pieces, battles
- **Type Safety** across frontend/backend boundary

### Build System
- **Nx Monorepo** for workspace management
- **Concurrent Development** with hot reload
- **TypeScript Compilation** with shared type checking

---

## 🚀 Gameplay Flow

1. **Shop Phase**: Purchase pieces, reroll shop, lock items
2. **Placement Phase**: Drag pieces onto tank grid, see adjacency bonuses
3. **Battle Phase**: Watch automatic combat with detailed logs
4. **Results Phase**: See battle outcome, gold rewards, progression
5. **Repeat**: Return to shop with respawned pieces and upgraded shop

---

## 📊 Battle Mechanics

### Combat Resolution
1. All alive pieces sorted by speed (highest first)
2. Each piece attacks random enemy target
3. Damage = Base Attack + Adjacency Bonuses + Water Quality Bonus
4. Dead pieces marked immediately, stop attacking
5. Battle continues until one side reaches 0 total HP

### Damage Calculation
```
Final Damage = Base Attack + Adjacency Bonuses + Water Quality Bonus
- Base Attack: Piece's natural attack stat + permanent consumable bonuses
- Adjacency Bonuses: Bonuses from adjacent plants/consumables
- Water Quality Bonus: 10% per water quality point above 5
```

### Adjacency System
- **8-directional**: Pieces affect all 8 surrounding positions
- **Multi-cell Aware**: Complex shapes provide/receive bonuses from all occupied cells
- **Equipment Enhanced**: Filters boost plant effects by 20%
- **Schooling Synergy**: Schooling fish gain +ATK per adjacent schooling fish

---

## 🎨 Visual Design

### Color Coding
- 🟢 **Player Pieces**: Green indicators
- 🔴 **Opponent Pieces**: Red indicators  
- 🔵 **Fish**: Blue gradient backgrounds
- 🟢 **Plants**: Green gradient backgrounds
- 🟠 **Consumables**: Orange gradient backgrounds
- ⚫ **Equipment**: Gray gradient backgrounds

### Status Indicators
- ✅ **Placed**: Green checkmark
- ⚠️ **Unplaced**: Yellow warning
- 💀 **Dead**: Skull emoji with grayscale
- 🔒 **Locked Shop**: Lock icon
- ⚡ **Speed Order**: Lightning for initiative

---

*Last Updated: 2025-08-08*
*Game Version: Alpha v0.1*