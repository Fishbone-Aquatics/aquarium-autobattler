# 🐠 Aquarium Auto-Battler - Development TODO

## 🔴 Critical Issues (Must Fix)

*All critical issues have been resolved! 🎉*

---

## 🟡 High Impact Features

### 1. Loss/Win Streak System Overhaul
- **Issue**: Loss bonus system needs rework, no win streak rewards
- **Impact**: Unbalanced progression, missing strategic comeback mechanics
- **Solution**: Redesign loss streak bonuses, implement win streak rewards system
- **Files**: `game.service.ts` - economy and progression logic
- **Status**: ✅ **Complete** - Simplified economy system with base 5g + streak bonuses only (L1-L6: 2/4/6/8/10/12g, W2-W5+: 1/2/3/4g)

### 2. Equipment System Expansion
- **Issue**: Only Basic Filter exists, equipment system needs more variety
- **Impact**: Limited strategic options beyond basic filter
- **Solution**: Add more equipment types with diverse effects (heaters, decorations, substrates)
- **Files**: `pieces.ts`, `game.service.ts` - new equipment definitions and effects
- **Status**: ✅ Filter bugs fixed - now applies flat +1 bonus to adjacent plant effects
- **Next**: Design and implement additional equipment types

### 3. Opponent AI Improvements
- **Issue**: AI hoards gold (sitting on 50g with losing streak), poor purchasing decisions, doesn't care about water quality, doesn't utilize reroll when standing on gold, doesnt group things for bonsues or use consumables properly.
We want to build this system in a way where it will be easy to add more - and they will have functions such as defensive() and aggressive() or frugal() which an be called and determined per round or w/e so we can create dynamic and mutliple bots "opponutes" quickely 
- **Impact**: Battles become too easy, poor game balance  
- **Solution**: Implement smarter AI that considers gold efficiency (interest, spending, rerolling), loss/win streaks, water quality, and power spikes
- **Files**: `game.service.ts` - `updateOpponentTank()` method

---

## 🔵 Medium Priority Fixes

### 4. Player Grid Logging System
- **Issue**: Need to collect player tank builds for future opponent matching
- **Impact**: Currently using AI opponents only, limiting strategic variety
- **Solution**: Log player grids/builds between rounds to temp table, queryable via API for faux opponents in "ranked" battles
- **Files**: `game.service.ts`, new debug endpoint, database/temp storage
- **Goal**: Enable real player builds as opponents instead of just AI strategies

### 5. Purchase Validation & Error Handling
- **Issue**: Buying items with insufficient gold causes WebSocket errors instead of client-side prevention
- **Impact**: Poor user experience, confusing error messages
- **Solution**: Add client-side gold validation before purchase, show user-friendly notifications
- **Files**: `Shop.tsx`, `GameContext.tsx` - purchase logic and UI feedback

### 6. Battle Start Validation
- **Issue**: Players can start battles with 0 pieces on board
- **Impact**: Instant losses, confusing gameplay
- **Solution**: Add validation to prevent battle start with empty tank, show warning message
- **Files**: `BattleView.tsx`, `game.service.ts` - battle initiation logic

### 7. Missing Items Investigation
- **Issue**: Some items seem missing from original piece library
- **Impact**: Reduced content variety
- **Solution**: Audit piece library, compare with design docs, add missing pieces
- **Files**: `pieces.ts`

### 8. Adjacency Bonus Tooltips
- **Issue**: Tooltips don't show specific stat values from adjacency bonuses
- **Impact**: Players can't see exact bonus amounts (+1 ATK, +2 HP, etc.)
- **Solution**: Display numeric values in bonus descriptions
- **Files**: `GameView.tsx`, `TankGrid.tsx` - tooltip sections

---

## 🟢 Low Priority Polish

### 9. Grid Screen Hover Tooltips
- **Issue**: Tank grid screen missing hover tooltips like those on shop screen
- **Impact**: Inconsistent UX, harder to inspect placed pieces
- **Solution**: Add hover tooltips to placed pieces in tank summary/grid view
- **Files**: `TankGrid.tsx`, `TankSummary.tsx` - tooltip integration

### 10. Shop Question Mark Hover
- **Issue**: Shop "?" icon has no hover tooltip or interaction
- **Impact**: Users can't get help about shop mechanics
- **Solution**: Add hover tooltip explaining shop mechanics, rerolls, locking
- **Files**: `Shop.tsx` - add tooltip to help icon

### 11. Interest Display in Gold Tracker
- **Issue**: Interest info clutters main UI, should be in gold tracker modal
- **Impact**: UI feels cluttered, interest info not with other gold details
- **Solution**: Move interest display to gold tracker modal, remove from main UI
- **Files**: `Header.tsx`, `GoldTrackerModal.tsx` - relocate interest display

### 12. Gold Hover Information Restoration  
- **Issue**: Hovering over gold used to show interest/bonus breakdown, feature missing
- **Impact**: Players can't easily see where their gold is coming from
- **Solution**: Restore gold hover tooltip showing: "Base + Interest + Loss Streak = Total"
- **Files**: `Header.tsx` - add hover breakdown tooltip

### 13. Loss/Win Streak Indicator Tooltips
- **Issue**: L2/L3/L4 indicators next to gold have no hover explanation
- **Impact**: Players don't understand what streak bonuses mean
- **Solution**: Add hover tooltips explaining "Loss Streak: 3 rounds (+1g bonus)" 
- **Files**: `Header.tsx` - add streak indicator tooltips



---

## 🧪 Testing & Quality Assurance

### Regression Testing Needed
- [ ] **Multi-cell Adjacency**: Verify all complex shapes work correctly
- [ ] **Equipment Effects**: Test filter +20% boost with various plant combinations  
- [ ] **Battle Logic**: Ensure dead fish can't attack (recent fix)
- [ ] **Consumable Bonuses**: Verify permanent bonuses persist through respawns
- [ ] **Session Management**: Test save/restore, reset game, new ID flows

#### Recent Session Fixes (2025-08-09) - Critical Regression Tests
- [ ] **Water Quality Calculation**: Verify fish decrease quality by 1, plants increase by 1, based on baseWaterQuality not current quality
- [ ] **Water Quality Damage**: Confirm 30% damage bonus for quality 8-10, 30% penalty for quality 1-3 (not 10% per point)
- [ ] **Poison Damage**: Test that fish in quality 1-3 water take 1 poison damage per turn during battles
- [ ] **Water Quality UI Indicators**: Verify "+30%" and "-30%" badges appear correctly in tank summary and stat comparison
- [ ] **Reset Game Shop Generation**: Confirm "Reset Game" button generates full shop instead of empty array
- [ ] **GameService.generateShop**: Verify DebugService uses GameService.generateShop() instead of duplicate logic
- [ ] **Battle Log UI**: Check battle log height is 700px max, 500px min, with gradient header and event counter
- [ ] **Base Water Quality**: Verify new games start with random quality 6-8 and baseWaterQuality field is set correctly
- [ ] **Equipment Filter Bonuses**: Test that Sponge Filter gives +1 flat bonus to adjacent plant effects (not double bonus)
- [ ] **Precise Filter Adjacency**: Verify only plants directly touching filters get boosted, not all plants near fish
- [ ] **Multi-cell Filter Logic**: Test L-shaped pieces touching filters don't get multiple bonuses from same source

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
- **Loss/Win Streak Economy Overhaul** - Removed confusing double bonuses (win+streak), simplified to base 5g + streak-only bonuses, proper transaction logging, double-loss scenario handling
- Game End System - Round 15 final battle UI and automatic campaign reset
- Sell Functionality - 75% value sell buttons on placed pieces
- Real-time Battle Health Updates - Health bars update after each individual attack
- Gold Transaction Tracker - Modal-based transaction history with clickable header icon
- Equipment Respawn Fix - Equipment now properly respawns after battles
- Equipment Attack Prevention - Equipment no longer participates in attacks (passive only)
- Reroll Cost Scaling - Rerolls cost 2g for first 5, then +1g per additional reroll
- Water Quality System - Fish decrease quality (-1), plants increase (+1), damage bonuses/penalties at extremes, poison damage for dirty water
- Battle Log UI Enhancement - Expanded log area with gradient header, proper sizing (700px max height), better formatting and scroll controls
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

*Last Updated: 2025-08-09*  
*Priority Order: Critical → High → Medium → Low → Future*

## 💡 Quick Implementation Guide

**For immediate work**, tackle items in this order:
1. **Equipment System Expansion** (add variety and strategic depth)
2. **Opponent AI Improvements** (game balance and challenge)
3. **Player Grid Logging** (enable real opponent builds)
4. **Purchase Validation** (UX improvements)

**For next session**, consider:
- Pick one critical issue and implement fully
- Test thoroughly with build system
- Update this TODO with progress notes
- Add any new bugs discovered to the list