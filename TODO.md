# 🐠 Aquarium Auto-Battler - Development TODO

## 🔴 Critical Issues (Must Fix)

*All critical issues have been resolved! 🎉*

---

## 🟡 High Impact Features

### 1. Player Grid Logging System
- **Issue**: Need to collect player tank builds for future opponent matching
- **Impact**: Currently using AI opponents only, limiting strategic variety
- **Solution**: Log player grids/builds between rounds to temp table, queryable via API for faux opponents in "ranked" battles
- **Files**: `game.service.ts`, new debug endpoint, database/temp storage
- **Goal**: Enable real player builds as opponents instead of just AI strategies

### 2. Opponent AI Improvements
- **Issue**: AI hoards gold (sitting on 50g with losing streak), poor purchasing decisions
- **Impact**: Battles become too easy, poor game balance  
- **Solution**: Implement smarter AI that considers gold efficiency, loss streaks, and power spikes
- **Files**: `game.service.ts` - `updateOpponentTank()` method

### 3. Equipment System Expansion
- **Issue**: Only Basic Filter exists, equipment underutilized  
- **Impact**: Limited strategic options, equipment feels pointless
- **Solution**: Add more equipment types with diverse effects
- **Files**: `pieces.ts`, `game.service.ts`, equipment effect system

---

## 🔵 Medium Priority Fixes


### 4. Missing Items Investigation
- **Issue**: Some items seem missing from original piece library
- **Impact**: Reduced content variety
- **Solution**: Audit piece library, compare with design docs, add missing pieces
- **Files**: `pieces.ts`

### 5. Adjacency Bonus Tooltips
- **Issue**: Tooltips don't show specific stat values from adjacency bonuses
- **Impact**: Players can't see exact bonus amounts (+1 ATK, +2 HP, etc.)
- **Solution**: Display numeric values in bonus descriptions
- **Files**: `GameView.tsx`, `TankGrid.tsx` - tooltip sections

---

## 🟢 Low Priority Polish

### 6. Battle Log UI Enhancement
- **Issue**: Log section is tiny and hard to read
- **Impact**: Poor UX for following combat details
- **Solution**: Expand log area, better formatting, scroll controls
- **Files**: `BattleView.tsx`




---

## 🧪 Testing & Quality Assurance

### Regression Testing Needed
- [ ] **Multi-cell Adjacency**: Verify all complex shapes work correctly
- [ ] **Equipment Effects**: Test filter +20% boost with various plant combinations  
- [ ] **Battle Logic**: Ensure dead fish can't attack (recent fix)
- [ ] **Consumable Bonuses**: Verify permanent bonuses persist through respawns
- [ ] **Session Management**: Test save/restore, reset game, new ID flows

### Performance Testing
- [ ] **Large Battles**: Test with many pieces, complex adjacencies
- [ ] **WebSocket Stress**: Multiple concurrent battles
- [ ] **Memory Leaks**: Long game sessions, repeated battles

### Cross-browser Testing
- [ ] **Chrome, Firefox, Safari**: Core gameplay
- [ ] **Mobile**: Touch drag-and-drop, responsive design
- [ ] **Accessibility**: Screen readers, keyboard navigation

---

## 🚀 Future Enhancements (Post-MVP)

### Advanced Features
- **Tournament Mode**: Bracket-style multi-player competitions
- **Piece Upgrade System**: Evolve pieces with repeated purchases  
- **Special Abilities**: Active abilities triggered manually
- **Environmental Effects**: Different tank biomes with unique bonuses
- **Deck Building**: Pre-constructed teams vs random shop

### Technical Improvements  
- **Database Persistence**: Replace in-memory state with database
- **Replay System**: Save and replay interesting battles
- **Statistics Tracking**: Win rates, favorite pieces, meta analysis
- **Spectator Mode**: Watch other players' battles
- **Mobile App**: Native iOS/Android versions

---

## 📝 Development Notes

### Recent Completions ✅
- **Game End System** - Round 15 final battle UI and automatic campaign reset
- **Sell Functionality** - 75% value sell buttons on placed pieces
- **Real-time Battle Health Updates** - Health bars update after each individual attack
- **Gold Transaction Tracker** - Modal-based transaction history with clickable header icon
- **Equipment Respawn Fix** - Equipment now properly respawns after battles
- **Equipment Attack Prevention** - Equipment no longer participates in attacks (passive only)
- **Reroll Cost Scaling** - Rerolls cost 2g for first 5, then +1g per additional reroll
- **Water Quality System** - Fish decrease quality (-1), plants increase (+1), damage bonuses/penalties at extremes, poison damage for dirty water
- Multi-cell adjacency detection for all piece types
- Equipment effects (filter +20% plant boost) 
- Dead fish attack prevention fix
- Permanent consumable bonus system
- Session management with save/restore
- Comprehensive battle logging with detailed damage breakdowns

### Code Quality Priorities
1. **Type Safety**: Maintain strict TypeScript usage
2. **Component Modularity**: Keep components focused and reusable  
3. **WebSocket Reliability**: Handle connection drops gracefully
4. **Error Handling**: Proper error boundaries and user feedback
5. **Performance**: Optimize battle calculations and UI updates

### Architecture Decisions
- **Monorepo**: Nx workspace for shared types and coordinated builds
- **WebSocket**: Real-time battles over HTTP polling
- **In-memory State**: Simple session storage over database complexity
- **Drag & Drop**: HTML5 API over third-party libraries

---

*Last Updated: 2025-08-08*  
*Priority Order: Critical → High → Medium → Low → Future*

## 💡 Quick Implementation Guide

**For immediate work**, tackle items in this order:
1. **Game End System** (prevents player confusion)
2. **Sell Functionality** (core gameplay feature) 
3. **Real-time Health Updates** (UX improvement)
4. **Opponent AI** (game balance)

**For next session**, consider:
- Pick one critical issue and implement fully
- Test thoroughly with build system
- Update this TODO with progress notes
- Add any new bugs discovered to the list